// Guiones de reels con cara: generar (con los datos frescos), guardar uno por doc en `guiones`, editar,
// regenerar uno y mandarlos por mail. Lo usan el cron (/api/cron/guiones/), el admin (/api/guiones/)
// y el MCP (tools/contenido.js). La IA es la misma cadena con respaldo del bot de contenido.
import { FieldValue } from 'firebase-admin/firestore';
import {
  buildPromptGuiones, parseGuiones, guionesHtml, normalizarGuion, ESTADOS_GUION, FORMATOS, MAX_GUIONES,
  GUIONES_CONFIG_DEFAULT,
} from '@/lib/guiones';
import { generarConRespaldo, loadContenidoConfig, CONTENIDOS } from '@/lib/contenidoRun';
import { statsAuditorias } from '@/lib/contenido';
import { sendViaResend } from '@/lib/bizEmail';

export const GUIONES = 'guiones';
const ADMIN_URL = 'https://marianoaliandri.com.ar/admin/';

export async function loadGuionesConfig(db) {
  const snap = await db.collection('contenido_config').doc('settings').get();
  return { ...GUIONES_CONFIG_DEFAULT, ...(snap.exists ? snap.data()?.guiones : null) };
}

export function guionResumen(id, d) {
  return {
    id, ...normalizarGuion(d), tema: d.tema || null, estado: d.estado || 'pendiente', proveedor: d.proveedor || null,
    origen: d.origen || null, lote: d.lote || null, createdAtMs: d.createdAtMs || null, editadoAtMs: d.editadoAtMs || null,
  };
}

async function contexto(db) {
  const [config, auds, dem, prev, piezas] = await Promise.all([
    loadContenidoConfig(db),
    db.collection('auditorias').orderBy('createdAt', 'desc').limit(25).get(),
    db.collection('demanda_reportes').orderBy('createdAtMs', 'desc').limit(1).get(),
    db.collection(GUIONES).orderBy('createdAtMs', 'desc').limit(15).get(),
    db.collection(CONTENIDOS).orderBy('createdAtMs', 'desc').limit(5).get(),
  ]);
  const d = dem.docs[0]?.data();
  return {
    series: config.series,
    auditorias: statsAuditorias(auds.docs.map(x => x.data())),
    demanda: d ? { zona: d.zona, top: d.top.slice(0, 5).map(t => t.label), frase: d.top[0]?.ejemplos?.[0] } : null,
    recientes: prev.docs.map(x => x.data().titulo).filter(Boolean),
    piezas: piezas.docs.map(x => x.data()).filter(c => c.estado === 'publicado').map(c => c.titulo),
  };
}

// Genera `cantidad` guiones (opcional: sobre un tema / con un formato), los guarda y si `mail`, los manda.
export async function generarGuiones(db, { cantidad = 3, tema = '', formato = '', mail = false, origen = 'admin', now = Date.now() } = {}) {
  const n = Math.max(1, Math.min(MAX_GUIONES, Number(cantidad) || 3));
  if (formato && !FORMATOS[formato]) throw new Error(`Formato desconocido: ${formato}`);
  const ctx = await contexto(db);
  const { guiones, proveedor } = await generarConRespaldo(
    buildPromptGuiones({ ...ctx, cantidad: n, tema: String(tema || '').slice(0, 500), formato }),
    (raw) => parseGuiones(raw, { cantidad: n }),
  );
  const lote = `${now}`;
  const ids = [];
  for (const g of guiones) {
    const ref = await db.collection(GUIONES).add({
      ...g, tema: tema || null, estado: 'pendiente', proveedor, origen, lote, createdAtMs: now, createdAt: FieldValue.serverTimestamp(),
    });
    ids.push(ref.id);
  }
  let enviado = false;
  if (mail) {
    const to = process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL;
    if (!to) throw new Error('Falta ADMIN_EMAIL para mandar los guiones');
    const fecha = new Date(now).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
    await sendViaResend({
      to, subject: `🎬 ${guiones.length} reels para grabar (${fecha})${tema ? ` · ${String(tema).slice(0, 40)}` : ''}`,
      html: guionesHtml(guiones, { adminUrl: ADMIN_URL }),
    });
    enviado = true;
  }
  return { guiones: guiones.map((g, i) => ({ id: ids[i], ...g, estado: 'pendiente', proveedor })), proveedor, enviado };
}

// Rehace un guion con la IA (mismo tema y formato) y pisa el contenido; el estado vuelve a pendiente.
export async function regenerarGuion(db, id, { now = Date.now() } = {}) {
  const ref = db.collection(GUIONES).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`No existe el guion ${id}`);
  const viejo = snap.data();
  const ctx = await contexto(db);
  const { guiones, proveedor } = await generarConRespaldo(
    buildPromptGuiones({
      ...ctx, cantidad: 1, formato: viejo.formato,
      tema: viejo.tema || `Mismo tema que "${viejo.titulo}" (${viejo.gancho}), con otro enfoque y otro gancho`,
      recientes: [...ctx.recientes, viejo.titulo],
    }),
    (raw) => parseGuiones(raw, { cantidad: 1 }),
  );
  await ref.update({ ...guiones[0], estado: 'pendiente', proveedor, editadoAtMs: now });
  return guionResumen(id, { ...viejo, ...guiones[0], estado: 'pendiente', proveedor, editadoAtMs: now });
}

// Edición a mano desde el admin o el MCP: solo los campos de texto y el estado.
export function validateGuionPatch(body = {}) {
  const update = {};
  if ('estado' in body) {
    if (!ESTADOS_GUION.includes(body.estado)) return { error: `estado: ${ESTADOS_GUION.join(', ')}` };
    update.estado = body.estado;
  }
  const textos = ['titulo', 'gancho', 'textoEnPantalla', 'cierre', 'caption', 'musica', 'edicion', 'duracion'];
  if (textos.some(k => k in body) || 'tomas' in body || 'formato' in body) {
    const n = normalizarGuion({ ...body, tomas: body.tomas ?? [{ decir: 'x' }] });
    for (const k of textos) if (k in body) update[k] = n[k];
    if ('formato' in body) update.formato = n.formato;
    if ('tomas' in body) {
      if (!n.tomas.length) return { error: 'El guion necesita al menos una toma' };
      update.tomas = n.tomas;
    }
    if ('titulo' in body && !update.titulo) return { error: 'El título no puede quedar vacío' };
  }
  if (!Object.keys(update).length) return { error: 'Nada para actualizar' };
  return { update };
}

export async function actualizarGuion(db, id, body, { now = Date.now() } = {}) {
  const { update, error } = validateGuionPatch(body);
  if (error) throw new Error(error);
  const ref = db.collection(GUIONES).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`No existe el guion ${id}`);
  await ref.update({ ...update, editadoAtMs: now });
  return guionResumen(id, { ...snap.data(), ...update, editadoAtMs: now });
}

export async function listarGuiones(db, { estado = null, limit = 40 } = {}) {
  const snap = await db.collection(GUIONES).orderBy('createdAtMs', 'desc').limit(200).get();
  return snap.docs.map(d => guionResumen(d.id, d.data())).filter(g => !estado || g.estado === estado).slice(0, limit);
}
