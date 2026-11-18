import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getGeminiKeys } from '@/lib/geminiClient';

// Gemini para el AI SDK con la misma rotación de keys que el resto del sitio (geminiClient.js): si una
// key está saturada, bloqueada o sin cuota, se prueba la siguiente. El reintento del SDK va apagado
// (maxRetries: 0) porque reintentar con la MISMA key saturada solo come tiempo.
export const MODELO_CHAT = 'gemini-3.8-flash';

// Errores de ESA key o de saturación del modelo: vale probar con otra key. El resto (pedido mal
// armado, tool que falla) fallaría igual con todas.
export function esErrorDeKey(e) {
  const status = e?.statusCode ?? e?.status;
  if ([401, 403, 404, 429, 500, 502, 503, 504].includes(status)) return true; // 404: modelo no disponible para ESA cuenta
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return false; // el tiempo total se agotó: no insistir
  return /quota|overload|unavailable|no longer available|api key|rate limit|resource.?exhausted/i.test(String(e?.message || ''));
}

// Keys en orden rotado a partir de un punto al azar (reparte la carga entre cuentas).
export function clavesRotadas(keys, start = Math.floor(Math.random() * keys.length)) {
  return keys.map((_, i) => keys[(start + i) % keys.length]);
}

// Cadena de modelos: el principal y, si está saturado o colgado, el de respaldo. Medido el 2026-11-17:
// gemini-3.8-flash tardaba 24 s en devolver "high demand" mientras gemini-2.5-flash respondía en 1,5 s.
// Se puede cambiar sin tocar código con AI_MODELS="modelo1,modelo2" (env de Vercel).
export const MODELOS_DEFAULT = ['gemini-3.8-flash', 'gemini-2.5-flash'];
export function modelosConfigurados(env = process.env.AI_MODELS) {
  const lista = String(env || '').split(',').map(s => s.trim()).filter(Boolean);
  return lista.length ? lista : MODELOS_DEFAULT;
}

// Corre fn(model, timeout) con cada modelo de la cadena hasta que uno responde. `timeouts[i]` es la config de
// timeout del SDK para el modelo i ({ stepMs, totalMs }): corta a un modelo colgado sin esperar a que se
// agote todo el tiempo de la función. `puedeReintentar(error)` permite frenar el cambio de modelo cuando
// repetir tendría efectos (ej. un agente que ya lanzó una búsqueda de Google Places).
export async function conRespaldo(fn, {
  modelos = modelosConfigurados(), timeouts = [], puedeReintentar = () => true, ...opts
} = {}) {
  let ultimo;
  const motivos = [];
  for (const [i, modelo] of modelos.entries()) {
    const timeout = timeouts[i] ?? timeouts.at(-1) ?? { stepMs: 20000, totalMs: 50000 };
    try {
      return await conClaves(model => fn(model, timeout), { ...opts, modelo });
    } catch (e) {
      ultimo = e;
      motivos.push(`${modelo}: ${String(e.message).slice(0, 200)}`);
      if (!puedeReintentar(e)) throw e;
    }
  }
  // Si se probó más de un modelo, el error cuenta qué pasó con cada uno (antes solo quedaba el último).
  if (motivos.length > 1) throw new Error(motivos.join(' || '));
  throw ultimo;
}

// Corre fn(model) con una key; si falla por la key, sigue con la próxima (hasta maxKeys).
export async function conClaves(fn, { maxKeys = 3, keys = getGeminiKeys(), modelo = MODELO_CHAT } = {}) {
  if (!keys.length) throw new Error('No hay ninguna GEMINI_API_KEY configurada');
  const motivos = [];
  for (const [i, apiKey] of clavesRotadas(keys).slice(0, maxKeys).entries()) {
    try {
      return await fn(createGoogleGenerativeAI({ apiKey })(modelo));
    } catch (e) {
      if (!esErrorDeKey(e)) throw e;
      motivos.push(`key ${i + 1}: ${e.statusCode ? `${e.statusCode} ` : ''}${String(e.message).slice(0, 90)}`);
    }
  }
  // Un motivo por intento: así una alerta dice si fue saturación, cuota o una key bloqueada.
  throw new Error(`Todas las Gemini API keys fallaron con ${modelo} (cuota agotada, sobrecarga o key bloqueada/inválida) [${motivos.join(' | ')}]`);
}
