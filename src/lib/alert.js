// Alertas por mail a Mariano cuando algo se rompe en el servidor (errores de rutas, webhooks de pago,
// tokens por vencer). Antes no había ninguna: los fallos se veían solo cuando un cliente se quejaba.
// - Nunca tira: una alerta que falla no puede romper el webhook que la llama.
// - Una misma alerta (`key`) sale como máximo una vez por hora; las repeticiones se cuentan y se
//   informan en el próximo mail (colección `alertas`).
// - Todo pasa por redactSecrets antes de salir: un error de un tercero puede traer un token adentro.
import { getDb } from '@/lib/firebase-admin';
import { redactSecrets } from '@/lib/mcp/redact';
import { sendViaResend } from '@/lib/bizEmail';

export const ALERT_INTERVAL_MS = 60 * 60 * 1000;

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const docId = key => String(key).replace(/[^\w.-]+/g, '_').slice(0, 140) || 'sin_clave';

// Decide si se manda y lleva la cuenta. Devuelve { send, repetidas }.
export async function claimAlert(db, key, now = Date.now()) {
  const ref = db.collection('alertas').doc(docId(key));
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : {};
    const total = (d.total || 0) + 1;
    if (d.ultimoEnvio && now - d.ultimoEnvio < ALERT_INTERVAL_MS) {
      tx.set(ref, { key, total, suprimidas: (d.suprimidas || 0) + 1, ultimaVez: now }, { merge: true });
      return { send: false };
    }
    tx.set(ref, { key, total, suprimidas: 0, ultimaVez: now, ultimoEnvio: now }, { merge: true });
    return { send: true, repetidas: d.suprimidas || 0 };
  });
}

export function alertHtml({ titulo, detalle, contexto = {}, repetidas = 0 }) {
  const filas = Object.entries(contexto)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td style="padding:4px 0"><code>${esc(typeof v === 'string' ? v : JSON.stringify(v))}</code></td></tr>`)
    .join('');
  return `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111">
<h2 style="margin:0 0 12px;font-size:18px">⚠️ ${esc(titulo)}</h2>
<pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px;font-size:13px">${esc(detalle)}</pre>
${filas ? `<table style="font-size:13px;margin-top:8px">${filas}</table>` : ''}
${repetidas ? `<p style="color:#b45309">Se repitió ${repetidas} ${repetidas === 1 ? 'vez' : 'veces'} desde el último aviso (se avisa como máximo una vez por hora).</p>` : ''}
<p style="color:#888;font-size:12px;margin-top:16px">marianoaliandri.com.ar · alertas automáticas (src/lib/alert.js)</p>
</div>`;
}

export async function sendAlert({ key, titulo, detalle, contexto } = {}, deps = {}) {
  try {
    const to = process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL;
    if (!to) return { sent: false, reason: 'sin destinatario' };
    const db = deps.db ?? getDb();
    const send = deps.send ?? sendViaResend;
    const claim = db ? await claimAlert(db, key || titulo, deps.now) : { send: true, repetidas: 0 };
    if (!claim.send) return { sent: false, reason: 'repetida' };
    const clean = redactSecrets({ titulo: String(titulo || 'Error'), detalle: String(detalle || ''), contexto: contexto || {} });
    await send({ to, subject: `[Alerta sitio] ${clean.titulo}`.slice(0, 150), html: alertHtml({ ...clean, repetidas: claim.repetidas }) });
    return { sent: true };
  } catch (e) {
    console.error('[alert] no se pudo mandar la alerta:', e?.message);
    return { sent: false, reason: 'error' };
  }
}

// Atajo para los catch: alerta con el mensaje y el stack del error.
export function alertError(key, titulo, err, contexto) {
  return sendAlert({ key, titulo, detalle: `${err?.message || err}\n\n${String(err?.stack || '').split('\n').slice(1, 6).join('\n')}`, contexto });
}
