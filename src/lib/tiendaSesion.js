// Visitas de la tienda y aviso a Telegram cuando alguien arma en serio (venta por consulta, 2026-11-25).
// Cada visita es anónima: un id que genera el navegador. Se guarda lo marcado, la última pregunta al asistente y la
// ciudad aproximada (header de Vercel). NO se guarda la IP. Un aviso por visita al cruzar el umbral (transacción),
// y otro cuando pide presupuesto.
import { FieldValue } from 'firebase-admin/firestore';
import { sendTelegram } from '@/lib/telegram';
import { PRESUPUESTOS } from '@/lib/tiendaCheckout';

export const SESIONES = 'tienda_sesiones';
const TTL_MS = 30 * 86400000;
const ID = /^[A-Za-z0-9_-]{8,64}$/;
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|lighthouse|headless|python|curl|wget/i;
const SITE = 'https://marianoaliandri.com.ar';

export const esBot = (ua = '') => !ua || BOT.test(ua);

export function debeAvisar(prev = {}, next = {}) {
  if (prev.avisado) return null;
  if ((next.servicios || []).length >= 2 || String(next.ultimaPregunta || '').trim()) return 'interes';
  return null;
}

export function textoAviso(sesion = {}, { labels = {} } = {}) {
  const nombres = (sesion.servicios || []).map(id => labels[id] || id);
  const lineas = [`🛒 Alguien${sesion.ciudad ? ` en ${sesion.ciudad}` : ''} está armando en la tienda:`];
  lineas.push(nombres.length ? `   ${nombres.join(' + ')}` : '   (todavía sin marcar servicios)');
  if (sesion.ultimaPregunta) lineas.push(`💬 Preguntó: "${String(sesion.ultimaPregunta).slice(0, 300)}"`);
  return lineas.join('\n');
}

const horaArt = (iso) => new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

export function textoSolicitud(d = {}) {
  const lineas = [`✅ ${d.clientName || 'Alguien'}${d.clientCompany ? ` (${d.clientCompany})` : ''} pidió presupuesto en la tienda:`];
  lineas.push(`   ${(d.selectedServices || []).join(' + ') || '—'}`);
  if (d.meet?.estado === 'pedido' && d.meet.inicio) lineas.push(`📅 Pidió Meet: ${horaArt(d.meet.inicio)} (hora AR) — confirmalo en el admin`);
  else lineas.push('💬 Sin Meet: prefiere que lo contactes');
  if (d.clientPhone) lineas.push(`📱 ${d.clientPhone}`);
  if (d.projectDescription) lineas.push(`📝 ${String(d.projectDescription).slice(0, 300)}`);
  return lineas.join('\n');
}

const avisarTelegram = (texto) => sendTelegram({ texto, botones: [{ texto: 'Ver en el admin', url: `${SITE}/admin/` }] });

// Registra la visita; si cruza el umbral por primera vez, avisa (fuera de la transacción, una sola vez).
export async function registrarSesion(db, { id, servicios = [], ultimaPregunta = '', ciudad = '', ua = '' } = {}, {
  avisar = (s) => avisarTelegram(textoAviso(s)),
  now = Date.now(),
} = {}) {
  if (esBot(ua) || !ID.test(String(id || ''))) return { avisado: false };
  const ref = db.collection(SESIONES).doc(String(id));
  const next = {
    servicios: [...new Set(servicios.map(String))].slice(0, 60),
    ultimaPregunta: String(ultimaPregunta || '').trim().slice(0, 500),
    ciudad: String(ciudad || '').slice(0, 80),
  };
  let disparar = false;
  let snapshot = null;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data() : {};
    disparar = debeAvisar(prev, next) === 'interes';
    snapshot = { ...prev, ...next, ultimaPregunta: next.ultimaPregunta || prev.ultimaPregunta || '' };
    tx.set(ref, {
      ...snapshot,
      inicioMs: prev.inicioMs || now,
      ultimoMs: now,
      avisado: prev.avisado || disparar,
      expiraEn: new Date(now + TTL_MS),
    });
  });
  if (disparar) await Promise.resolve(avisar(snapshot)).catch(() => {});
  return { avisado: disparar };
}

// Aviso cuando la visita pide presupuesto (lo llama crearSolicitud). Marca la sesión con la solicitud.
export async function avisarSolicitud(db, solicitudId, { send = avisarTelegram } = {}) {
  const snap = await db.collection(PRESUPUESTOS).doc(String(solicitudId)).get();
  if (!snap.exists) return;
  const d = snap.data();
  if (d.sesionId && ID.test(d.sesionId)) {
    await db.collection(SESIONES).doc(d.sesionId).set({ solicitudId: String(solicitudId), ultimoMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
  }
  await send(textoSolicitud(d));
}
