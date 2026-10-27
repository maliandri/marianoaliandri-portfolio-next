import { z } from 'zod';
import { loadConfig as loadAuditConfig } from '@/lib/autoAuditRun';
import { loadDemandaConfig } from '@/lib/demandaAutoRun';
import { defineTool } from '../defineTool';

// "¿Anda todo bien?": estado de las automatizaciones en una sola llamada. Cada parte se lee por
// separado: si una falla, las demás igual se devuelven (con `error` en la que falló).
const DIA_MS = 24 * 60 * 60 * 1000;
const iso = (ts) => ts?.toDate?.()?.toISOString?.() || (typeof ts === 'number' ? new Date(ts).toISOString() : null);

async function seguro(fn) {
  try { return await fn(); } catch { return { error: 'No se pudo leer' }; }
}

async function ultimaCorrida(db, coleccion) {
  const snap = await db.collection(coleccion).orderBy('createdAt', 'desc').limit(3).get();
  return snap.docs.map(d => {
    const r = d.data();
    return {
      estado: r.estado, cuando: iso(r.createdAt), error: r.error || null,
      detalle: r.zona || (r.combo ? `${r.combo.rubro} · ${r.combo.ciudad}` : null),
    };
  });
}

export const getAutomationStatusTool = defineTool({
  name: 'get_automation_status',
  title: 'Estado de las automatizaciones',
  description:
    'Resumen de todo lo que corre solo en el sitio, para contestar "¿anda todo bien?": bot de noticias (prendido, '
    + 'publicadas y fallidas en las últimas 24 h), auditoría automática e informes de demanda (prendidos y últimas '
    + 'corridas), presupuestos pendientes de responder y las últimas alertas por mail (errores del servidor, '
    + 'webhooks de pago, tokens por vencer).',
  inputSchema: z.object({}),
  annotations: { readOnlyHint: true },
  async handler(_args, { db, now = new Date() }) {
    const desde = now.getTime() - DIA_MS;
    const [noticias, auditoria, demanda, presupuestos, alertas] = await Promise.all([
      seguro(async () => {
        const [cfg, snap] = await Promise.all([
          db.collection('noticias_config').doc('settings').get(),
          db.collection('noticias').orderBy('publishedAt', 'desc').limit(60).get(),
        ]);
        const ult = snap.docs.map(d => d.data()).filter(n => (n.publishedAt?.toMillis?.() ?? 0) >= desde);
        const fallidas = ult.filter(n => n.status === 'error' || n.makeError);
        return {
          prendido: cfg.exists ? cfg.data().active !== false : true,
          topeDiario: cfg.exists ? cfg.data().dailyCap ?? null : null,
          publicadas24h: ult.filter(n => n.status === 'published' && !n.makeError).length,
          fallidas24h: fallidas.length,
          ultimosErrores: fallidas.slice(0, 3).map(n => ({ titulo: n.title || null, error: n.makeError || 'error' })),
          ultima: snap.docs[0] ? { titulo: snap.docs[0].data().title || null, cuando: iso(snap.docs[0].data().publishedAt) } : null,
        };
      }),
      seguro(async () => ({ prendida: (await loadAuditConfig(db)).activo, corridas: await ultimaCorrida(db, 'auditoria_auto_runs') })),
      seguro(async () => {
        const cfg = await loadDemandaConfig(db);
        return { prendida: cfg.activo, zonas: cfg.zonas.length, corridas: await ultimaCorrida(db, 'demanda_auto_runs') };
      }),
      seguro(async () => {
        const snap = await db.collection('presupuestos').where('status', '==', 'pending').get();
        return { pendientes: snap.size };
      }),
      seguro(async () => {
        const snap = await db.collection('alertas').orderBy('ultimaVez', 'desc').limit(5).get();
        return snap.docs.map(d => {
          const a = d.data();
          return { clave: a.key, ultimaVez: iso(a.ultimaVez), vecesTotal: a.total || 1, sinAvisarDesdeElUltimoMail: a.suprimidas || 0 };
        });
      }),
    ]);

    const problemas = [];
    if (noticias.fallidas24h) problemas.push(`${noticias.fallidas24h} noticias fallidas en 24 h`);
    for (const [nombre, x] of [['auditoría automática', auditoria], ['informes de demanda', demanda]]) {
      const u = x.corridas?.[0];
      if (u && !['ok', 'guardado', 'sin_resultados'].includes(u.estado)) problemas.push(`última ${nombre}: ${u.estado}`);
    }
    const alertasHoy = Array.isArray(alertas) ? alertas.filter(a => a.ultimaVez && Date.parse(a.ultimaVez) >= desde) : [];
    if (alertasHoy.length) problemas.push(`${alertasHoy.length} alertas en 24 h`);
    for (const [k, v] of Object.entries({ noticias, auditoria, demanda, presupuestos, alertas })) if (v?.error) problemas.push(`no se pudo leer ${k}`);

    const pend = presupuestos.pendientes ? ` ${presupuestos.pendientes} presupuestos sin responder.` : '';
    return {
      summary: (problemas.length ? `Ojo: ${problemas.join('; ')}.` : 'Todo en orden en las últimas 24 h.') + pend,
      data: { noticias, auditoriaAutomatica: auditoria, informesDemanda: demanda, presupuestos, alertas },
    };
  },
});

export const STATUS_TOOLS = [getAutomationStatusTool];
