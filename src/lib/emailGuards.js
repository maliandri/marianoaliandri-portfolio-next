import { createHmac, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { baseUrl } from '@/lib/mcp/config';

// Frenos de los mails a negocios (ver docs/superpowers/specs/2026-10-26-mcp-server-design.md, 6.4).
// La lista de bloqueo (bajas + rebotes) aplica a todos los envíos; los 30 días y el tope diario
// solo al servidor MCP (en el admin Mariano aprieta el botón a conciencia).

const BAJAS = 'email_bajas';
const SENT = 'sent_emails';
const COUNTER = 'mcp_email_counter';

const cleanEmail = (e) => String(e || '').trim().toLowerCase();

export function normalizeDomain(url) {
  const raw = String(url || '').trim().toLowerCase();
  if (!raw) return null;
  const host = raw.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/^www\./, '');
  return host || null;
}

function sign(email) {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('EMAIL_UNSUBSCRIBE_SECRET no configurada');
  return createHmac('sha256', secret).update(cleanEmail(email)).digest('base64url');
}

export function unsubscribeUrl(email) {
  const e = cleanEmail(email);
  return `${baseUrl()}/baja/?e=${encodeURIComponent(e)}&t=${sign(e)}`;
}

export function verifyUnsubscribe(email, token) {
  try {
    const a = Buffer.from(sign(email));
    const b = Buffer.from(String(token || ''));
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// sent_emails es chica (envíos de un solo admin) y los registros viejos no guardan `dominio`:
// se lee entera y se compara normalizando email y dominio de la web en memoria.
async function sentRows(db) {
  const snap = await db.collection(SENT).get();
  return snap.docs.map(d => {
    const x = d.data();
    return {
      email: cleanEmail(x.email),
      dominio: x.dominio || normalizeDomain(x.siteUrl),
      status: x.status || 'sent',
      at: x.createdAt?.toDate?.() || null,
    };
  });
}

// null si se puede escribir; 'baja' si pidió no recibir más (dirección o dominio); 'rebotado' si
// esa dirección rebotó o marcó spam.
export async function checkBlocked(db, { email, dominio }) {
  const e = cleanEmail(email);
  const byEmail = await db.collection(BAJAS).where('email', '==', e).limit(1).get();
  if (!byEmail.empty) return 'baja';
  if (dominio) {
    const byDom = await db.collection(BAJAS).where('dominios', 'array-contains', dominio).limit(1).get();
    if (!byDom.empty) return 'baja';
  }
  const rows = await sentRows(db);
  if (rows.some(r => r.email === e && (r.status === 'bounced' || r.status === 'complained'))) return 'rebotado';
  return null;
}

// Fecha del último envío a ese negocio, por dirección o por dominio de la web.
export async function lastContactAt(db, { email, dominio }) {
  const e = cleanEmail(email);
  let last = null;
  for (const r of await sentRows(db)) {
    if (!r.at) continue;
    if (r.email === e || (dominio && r.dominio === dominio)) {
      if (!last || r.at > last) last = r.at;
    }
  }
  return last;
}

const LOCKS = 'mcp_email_locks';
const lockId = (kind, v) => `${kind}_${createHmac('sha256', 'lock').update(v).digest('hex').slice(0, 40)}`;

// Reserva un envío del MCP en UNA transacción, antes de llamar a Resend: candado por negocio
// (email y dominio de la web, último envío), cupo diario (día UTC) y, si viene, el borrador.
// Así dos rutinas en paralelo (o un reintento de Claude) no le mandan dos mails al mismo negocio.
// Devuelve { ok: true, release } o { ok: false, motivo }. release() deshace todo si el envío falla.
export async function reserveSend(db, { email, dominio, cap, days, now = new Date(), draftRef = null }) {
  const nowMs = now.getTime();
  const locks = [lockId('e', cleanEmail(email)), ...(dominio ? [lockId('d', dominio)] : [])]
    .map(id => db.collection(LOCKS).doc(id));
  const counterRef = db.collection(COUNTER).doc(now.toISOString().slice(0, 10));

  const res = await db.runTransaction(async tx => {
    const lockSnaps = await Promise.all(locks.map(r => tx.get(r)));
    const counter = await tx.get(counterRef);
    const draft = draftRef ? await tx.get(draftRef) : null;
    if (draft && (draft.data()?.sentAt || draft.data()?.sending)) return { ok: false, motivo: 'borrador_enviado' };
    const prev = lockSnaps.map(s => (s.exists ? s.data().lastSentAt || null : null));
    if (prev.some(t => t && nowMs - t < days * 86400000)) return { ok: false, motivo: 'ya_contactado' };
    const n = counter.exists ? counter.data().n || 0 : 0;
    if (n >= cap) return { ok: false, motivo: 'tope_diario' };
    locks.forEach((r, i) => tx.set(r, { lastSentAt: nowMs, prevSentAt: prev[i] }, { merge: true }));
    tx.set(counterRef, { n: n + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (draftRef) tx.update(draftRef, { sending: true });
    return { ok: true, prev };
  });
  if (!res.ok) return res;

  const release = () => db.runTransaction(async tx => {
    const counter = await tx.get(counterRef);
    locks.forEach((r, i) => (res.prev[i] ? tx.set(r, { lastSentAt: res.prev[i] }, { merge: true }) : tx.delete(r)));
    tx.set(counterRef, { n: Math.max(0, (counter.exists ? counter.data().n || 0 : 1) - 1) }, { merge: true });
    if (draftRef) tx.update(draftRef, { sending: false });
  });
  return { ok: true, release };
}

// Baja permanente: la dirección y los dominios de las webs a las que se le escribió.
export async function addBaja(db, email) {
  const e = cleanEmail(email);
  const dominios = [...new Set((await sentRows(db)).filter(r => r.email === e && r.dominio).map(r => r.dominio))];
  const id = createHmac('sha256', 'baja').update(e).digest('hex').slice(0, 40);
  await db.collection(BAJAS).doc(id).set({ email: e, dominios, createdAt: FieldValue.serverTimestamp() }, { merge: true });
}
