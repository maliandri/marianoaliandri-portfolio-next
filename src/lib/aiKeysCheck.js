// Comprobador de claves de IA (admin → Marketing → Claves de IA, 2026-11-26). Prueba cada clave de Gemini que
// haya en el entorno (GEMINI_API_KEY, GEMINI_API_KEY_1..N y la de Firebase, que geminiClient usa de respaldo)
// contra cada modelo de la cadena (AI_MODELS o el default), y la de Groq. Hace un pedido mínimo (unas pocas
// palabras): sirve para ver cuál anda, cuál se quedó sin cuota, cuál está bloqueada o inválida y cuál tarda.
// Nunca devuelve una clave: solo el nombre de la variable y los últimos 4 caracteres.
import { modelosConfigurados } from '@/lib/ai/gemini';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_MODELS = 'https://api.groq.com/openai/v1/models';
export const TIMEOUT_MS = 15000;

// Orden igual al de geminiClient (las satélite primero, la compartida y la de Firebase al final).
function ordenGemini(nombre) {
  if (nombre === 'NEXT_PUBLIC_FIREBASE_API_KEY') return 1e6;
  if (nombre === 'GEMINI_API_KEY') return 1e5;
  const n = Number(nombre.replace('GEMINI_API_KEY_', ''));
  return Number.isFinite(n) ? n : 1e4;
}

export function listarClaves(env = process.env) {
  const gemini = Object.keys(env)
    .filter(k => /^GEMINI_API_KEY(_\w+)?$/.test(k) || k === 'NEXT_PUBLIC_FIREBASE_API_KEY')
    .filter(k => String(env[k] || '').trim())
    .sort((a, b) => ordenGemini(a) - ordenGemini(b))
    .map(k => ({ nombre: k, proveedor: 'gemini', valor: String(env[k]).trim() }));
  const groq = String(env.GROQ_API_KEY || '').trim()
    ? [{ nombre: 'GROQ_API_KEY', proveedor: 'groq', valor: String(env.GROQ_API_KEY).trim() }]
    : [];
  const vistas = new Map();
  return [...gemini, ...groq].map(c => {
    const igualA = vistas.get(c.valor) || null;
    if (!igualA) vistas.set(c.valor, c.nombre);
    return { ...c, final: c.valor.slice(-4), duplicadaDe: igualA };
  });
}

// Estado de una respuesta: ok | cuota | saturado | invalida | bloqueada | modelo_no_disponible | colgada | error.
export function clasificar(status, mensaje = '') {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 429 || /quota|exhausted|rate limit/i.test(mensaje)) return 'cuota';
  if (status === 503 || status === 500 || /overloaded|high demand|unavailable/i.test(mensaje)) return 'saturado';
  if (status === 401 || (status === 400 && /api key|api_key/i.test(mensaje))) return 'invalida';
  if (status === 403) return 'bloqueada';
  if (status === 404) return 'modelo_no_disponible';
  return 'error';
}

const corto = (s) => String(s || '').replace(/key=[\w-]+/gi, 'key=…').slice(0, 180);

async function medir(fn, fetchImpl, now) {
  const t0 = now();
  try {
    const res = await fn(fetchImpl);
    const data = await res.json().catch(() => ({}));
    const mensaje = data?.error?.message || (typeof data?.error === 'string' ? data.error : '') || '';
    return { estado: clasificar(res.status, mensaje), http: res.status, ms: now() - t0, detalle: res.ok ? null : corto(mensaje || `HTTP ${res.status}`) };
  } catch (e) {
    const colgada = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return { estado: colgada ? 'colgada' : 'error', http: null, ms: now() - t0, detalle: colgada ? `No respondió en ${TIMEOUT_MS / 1000} s` : corto(e?.message) };
  }
}

export function probarGemini(key, modelo, { fetchImpl = fetch, now = Date.now } = {}) {
  return medir(f => f(`${GEMINI_BASE}/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Respondé solo: ok' }] }], generationConfig: { maxOutputTokens: 16 } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }), fetchImpl, now);
}

export function probarGroq(key, { fetchImpl = fetch, now = Date.now } = {}) {
  return medir(f => f(GROQ_MODELS, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(TIMEOUT_MS) }), fetchImpl, now);
}

// Corre todas las pruebas en paralelo. Las claves duplicadas no se vuelven a probar.
export async function comprobarClaves({ env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  const modelos = modelosConfigurados(env.AI_MODELS);
  const claves = listarClaves(env);
  const resultados = await Promise.all(claves.map(async c => {
    const base = { nombre: c.nombre, proveedor: c.proveedor, final: c.final, duplicadaDe: c.duplicadaDe };
    if (c.duplicadaDe) return { ...base, pruebas: [] };
    const pruebas = c.proveedor === 'groq'
      ? [{ modelo: 'API de Groq', ...(await probarGroq(c.valor, { fetchImpl, now })) }]
      : await Promise.all(modelos.map(async m => ({ modelo: m, ...(await probarGemini(c.valor, m, { fetchImpl, now })) })));
    return { ...base, pruebas };
  }));
  const probadas = resultados.filter(r => r.pruebas.length);
  return {
    modelos,
    claves: resultados,
    resumen: {
      total: resultados.length,
      andan: probadas.filter(r => r.pruebas.some(p => p.estado === 'ok')).length,
      sinNinguna: probadas.filter(r => !r.pruebas.some(p => p.estado === 'ok')).length,
      duplicadas: resultados.filter(r => r.duplicadaDe).length,
    },
    probadoEn: new Date(now()).toISOString(),
  };
}
