// Google Calendar de Mariano para los Meet de la venta por consulta (2026-11-25). OAuth delegado a SU cuenta
// (una cuenta de servicio no puede crear eventos con Meet en un Gmail personal). El refresh token vive en
// `integrations/google_calendar`. REST directo (sin googleapis) para no sumar peso.
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. La app de Google Cloud tiene que estar PUBLICADA: en modo
// "testing" el refresh token vence a los 7 días.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { PRESUPUESTOS } from '@/lib/tiendaCheckout';

export const INTEGRACION = ['integrations', 'google_calendar'];
export const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.freebusy'];
const API = 'https://www.googleapis.com/calendar/v3';
const STATE_TTL_MS = 10 * 60000;

export const redirectUri = (base = process.env.MCP_BASE_URL || 'https://marianoaliandri.com.ar') => `${base}/api/google-calendar-auth/`;

// ── OAuth ────────────────────────────────────────────────────────────────────────────────────────────────
// state = "<ms>.<hmac>": evita que alguien complete el callback con un código propio.
export function firmarState(secreto, now = Date.now()) {
  const ms = String(now);
  return `${ms}.${createHmac('sha256', secreto).update(ms).digest('base64url')}`;
}
export function verificarState(state, secreto, now = Date.now()) {
  const [ms, firma] = String(state || '').split('.');
  if (!ms || !firma || !secreto) return false;
  const esperada = createHmac('sha256', secreto).update(ms).digest('base64url');
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return now - Number(ms) <= STATE_TTL_MS && now >= Number(ms);
}

export function urlConsentimiento({ clientId = process.env.GOOGLE_CLIENT_ID, secreto = process.env.GOOGLE_CLIENT_SECRET, redirect = redirectUri(), now = Date.now() } = {}) {
  const p = new URLSearchParams({
    client_id: clientId, redirect_uri: redirect, response_type: 'code', access_type: 'offline', prompt: 'consent',
    include_granted_scopes: 'true', scope: SCOPES.join(' '), state: firmarState(secreto, now),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function token(params, fetchImpl = fetch) {
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...params }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google token: ${d.error || res.status}`);
  return d;
}

// Callback: cambia el código por tokens y guarda el refresh token.
export async function conectar(db, code, { fetchImpl = fetch, now = Date.now() } = {}) {
  const d = await token({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() }, fetchImpl);
  if (!d.refresh_token) throw new Error('Google no devolvió refresh token (volvé a conectar con prompt=consent)');
  await db.collection(INTEGRACION[0]).doc(INTEGRACION[1]).set({ refreshToken: d.refresh_token, scope: d.scope || '', conectadoMs: now, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true };
}

// Access token fresco a partir del refresh guardado; null si no está conectado.
export async function getCalendarAuth(db, { fetchImpl = fetch } = {}) {
  const snap = await db.collection(INTEGRACION[0]).doc(INTEGRACION[1]).get();
  const refresh = snap.exists ? snap.data()?.refreshToken : null;
  if (!refresh) return null;
  const d = await token({ grant_type: 'refresh_token', refresh_token: refresh }, fetchImpl);
  return { accessToken: d.access_token };
}

// ── Calendario ───────────────────────────────────────────────────────────────────────────────────────────
export async function ocupados({ accessToken, desde, hasta, fetchImpl = fetch }) {
  const res = await fetchImpl(`${API}/freeBusy`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin: desde, timeMax: hasta, items: [{ id: 'primary' }] }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google freeBusy: ${d.error?.message || res.status}`);
  return (d.calendars?.primary?.busy || []).map(b => ({ inicio: b.start, fin: b.end }));
}

export async function crearEventoMeet({ accessToken, inicio, fin, titulo, descripcion, invitado, requestId, fetchImpl = fetch }) {
  const res = await fetchImpl(`${API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: titulo, description: descripcion,
      start: { dateTime: inicio }, end: { dateTime: fin },
      attendees: invitado ? [{ email: invitado }] : [],
      conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google events: ${d.error?.message || res.status}`);
  return { eventId: d.id, meetUrl: d.hangoutLink || d.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null };
}

// ── Solicitudes ──────────────────────────────────────────────────────────────────────────────────────────
// Acepta el turno pedido: vuelve a mirar el calendario (pudo ocuparse) y crea el evento con Meet.
export async function aceptarMeet(db, id, { accessToken, fetchImpl = fetch } = {}) {
  const ref = db.collection(PRESUPUESTOS).doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, error: 'No existe la solicitud' };
  const d = snap.data();
  const meet = d.meet || {};
  if (!meet.inicio || !meet.fin) return { status: 400, error: 'Esta solicitud no pidió reunión' };
  if (meet.estado === 'aceptado') return { status: 200, meetUrl: meet.meetUrl || null };
  if (!accessToken) return { status: 503, error: 'Google Calendar no está conectado' };

  const busy = await ocupados({ accessToken, desde: meet.inicio, hasta: meet.fin, fetchImpl });
  const ini = Date.parse(meet.inicio);
  const fin = Date.parse(meet.fin);
  if (busy.some(b => ini < Date.parse(b.fin) && fin > Date.parse(b.inicio))) {
    return { status: 409, error: 'Ese horario ya se ocupó, coordiná otro por WhatsApp' };
  }
  const servicios = (d.selectedServices || []).join(', ');
  const ev = await crearEventoMeet({
    accessToken, fetchImpl, inicio: meet.inicio, fin: meet.fin, invitado: d.clientEmail, requestId: String(id),
    titulo: `Charla con ${d.clientName || 'cliente'} — Mariano Aliandri`,
    descripcion: `Presupuesto de tu web/sistema.\nLo que marcaste: ${servicios || '—'}\n\nCualquier cosa: WhatsApp +54 9 299 541-4422`,
  });
  await ref.update({ meet: { ...meet, estado: 'aceptado', eventId: ev.eventId, meetUrl: ev.meetUrl }, updatedAt: FieldValue.serverTimestamp() });
  return { status: 200, meetUrl: ev.meetUrl };
}

export async function rechazarMeet(db, id) {
  const ref = db.collection(PRESUPUESTOS).doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, error: 'No existe la solicitud' };
  await ref.update({ meet: { ...(snap.data().meet || {}), estado: 'rechazado' }, updatedAt: FieldValue.serverTimestamp() });
  return { status: 200 };
}
