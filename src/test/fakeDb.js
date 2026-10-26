// Firestore fake en memoria para tests: docs por path string ('col/doc/sub/doc').
// Cubre lo que usa el repo: doc/collection anidados, add, where/orderBy/limit/startAfter,
// update/delete y runTransaction (serial). Para usar los sentinels de FieldValue, mockear:
//   vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);

let tsCounter = 0;
function fakeTimestamp() {
  const ms = Date.now() * 1000 + (tsCounter++); // estrictamente creciente aunque sea el mismo ms
  return { __ts: ms, toDate: () => new Date(Math.floor(ms / 1000)), toMillis: () => Math.floor(ms / 1000) };
}

export const firestoreMock = {
  FieldValue: {
    increment: (n) => ({ __op: 'increment', n }),
    serverTimestamp: () => ({ __op: 'serverTimestamp' }),
    delete: () => ({ __op: 'delete' }),
  },
  Timestamp: {
    fromDate: (d) => ({ __ts: d.getTime() * 1000, toDate: () => d, toMillis: () => d.getTime() }),
  },
};

export function resolveFieldValues(data, prev) {
  const out = { ...prev };
  for (const [k, v] of Object.entries(data)) {
    if (v && v.__op === 'increment') out[k] = (prev[k] || 0) + v.n;
    else if (v && v.__op === 'serverTimestamp') out[k] = fakeTimestamp();
    else if (v && v.__op === 'delete') delete out[k];
    else out[k] = v;
  }
  return out;
}

// Valor comparable: Timestamp → número, Date → ms, el resto tal cual.
const cmpVal = (v) => (v && typeof v === 'object' && '__ts' in v ? v.__ts / 1000 : v instanceof Date ? v.getTime() : v);

const OPS = {
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  in: (a, b) => b.includes(a),
  'array-contains': (a, b) => Array.isArray(a) && a.includes(b),
};

let autoId = 0;

export function createFakeDb(initialDocs = {}) {
  const docs = { ...initialDocs };
  const writes = [];
  let txQueue = Promise.resolve();

  function snapOf(path) {
    const data = docs[path];
    return { id: path.split('/').pop(), ref: makeDocRef(path), exists: data !== undefined, data: () => data };
  }

  function makeDocRef(path) {
    return {
      id: path.split('/').pop(),
      path,
      async get() { return snapOf(path); },
      async set(data, opts) {
        const prev = docs[path] || {};
        docs[path] = opts?.merge ? resolveFieldValues(data, prev) : resolveFieldValues(data, {});
        writes.push({ path, data, opts });
      },
      async update(data) {
        if (docs[path] === undefined) throw new Error(`NOT_FOUND: ${path}`);
        docs[path] = resolveFieldValues(data, docs[path]);
        writes.push({ path, data, opts: { update: true } });
      },
      async delete() {
        delete docs[path];
        writes.push({ path, data: null, opts: { delete: true } });
      },
      collection(subName) { return makeCollectionRef(`${path}/${subName}`); },
    };
  }

  function makeQuery(path, { filters = [], order = [], lim = null, after = null } = {}) {
    const q = { filters, order, lim, after };
    const next = (patch) => makeQuery(path, { ...q, ...patch });
    return {
      where: (field, op, value) => next({ filters: [...filters, { field, op, value }] }),
      orderBy: (field, dir = 'asc') => next({ order: [...order, { field, dir }] }),
      limit: (n) => next({ lim: n }),
      startAfter: (...values) => next({ after: values }),
      async get() {
        const depth = path.split('/').length + 1;
        let rows = Object.keys(docs)
          .filter(p => p.startsWith(`${path}/`) && p.split('/').length === depth)
          .map(snapOf);
        for (const f of filters) {
          rows = rows.filter(r => {
            const a = f.field === '__name__' ? r.id : cmpVal(r.data()[f.field]);
            return OPS[f.op](a, f.op === 'in' ? f.value : cmpVal(f.value));
          });
        }
        if (order.length) {
          rows.sort((x, y) => {
            for (const { field, dir } of order) {
              const a = field === '__name__' ? x.id : cmpVal(x.data()[field]);
              const b = field === '__name__' ? y.id : cmpVal(y.data()[field]);
              if (a === b) continue;
              const r = a > b ? 1 : -1;
              return dir === 'desc' ? -r : r;
            }
            return 0;
          });
        }
        if (after && order.length) {
          const { field, dir } = order[0];
          const v = cmpVal(after[0]);
          rows = rows.filter(r => {
            const a = field === '__name__' ? r.id : cmpVal(r.data()[field]);
            return dir === 'desc' ? a < v : a > v;
          });
        }
        if (lim !== null) rows = rows.slice(0, lim);
        return { docs: rows, empty: rows.length === 0, size: rows.length, forEach: (fn) => rows.forEach(fn) };
      },
    };
  }

  function makeCollectionRef(path) {
    return {
      ...makeQuery(path),
      doc: (id) => makeDocRef(`${path}/${id ?? `auto${++autoId}`}`),
      async add(data) {
        const ref = makeDocRef(`${path}/auto${++autoId}`);
        await ref.set(data);
        return ref;
      },
    };
  }

  return {
    db: {
      collection: (name) => makeCollectionRef(name),
      // Las transacciones corren de a una (cola), como si Firestore reintentara las que chocan.
      runTransaction(fn) {
        const run = txQueue.then(() => fn(makeTx()));
        txQueue = run.catch(() => {});
        return run;
      },
    },
    docs,
    writes,
  };

  function makeTx() {
    return {
      get: (ref) => ref.get(),
      set: (ref, data, opts) => ref.set(data, opts),
      update: (ref, data) => ref.update(data),
      delete: (ref) => ref.delete(),
    };
  }
}
