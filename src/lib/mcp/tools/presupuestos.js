import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import {
  ESTADOS_PRESUPUESTO, ESTADO_LABEL, presupuestoResumen, mensajePresupuesto, whatsappUrl, crearLinkPagoPresupuesto,
} from '@/lib/presupuestos';
import { calcularTotales, numeroPresupuesto, buildHtml, datosPresupuesto } from '@/lib/presupuestoEmail';
import { generarPdfPresupuesto, pdfNombre, pdfUrl, tokenPdf } from '@/lib/presupuestoPdf';
import { catalogoEfectivo } from '@/lib/tienda';
import { loadOverrides } from '@/lib/tiendaCheckout';
import { dolarOficialVenta } from '@/lib/dolar';
import { defineTool, ToolError } from '../defineTool';
import { pageArray } from '../paginate';

// Solicitudes de presupuesto (formulario /presupuesto + las que arma el admin). Nada de esto le
// escribe al cliente: el mensaje sale por el link de WhatsApp que toca Mariano.
const ESTADOS_TXT = ESTADOS_PRESUPUESTO.map(e => `${e} (${ESTADO_LABEL[e]})`).join(', ');

async function getPresupuesto(db, id) {
  const snap = await db.collection('presupuestos').doc(id).get();
  if (!snap.exists) throw new ToolError(`No existe el presupuesto ${id}. Usá list_budget_requests para ver los ids.`);
  return presupuestoResumen(snap.id, snap.data());
}

const conLinks = (p) => ({ ...p, whatsappUrl: whatsappUrl(p), mensajeSugerido: mensajePresupuesto(p) });

export const listBudgetRequestsTool = defineTool({
  name: 'list_budget_requests',
  title: 'Solicitudes de presupuesto',
  description:
    'Pedidos de presupuesto que entraron por el formulario de marianoaliandri.com.ar/presupuesto (y los que armó '
    + 'Mariano en el admin), del más nuevo al más viejo: cliente, contacto, servicios pedidos, descripción, estado, '
    + `montos y link de pago. Filtrable por estado: ${ESTADOS_TXT}. Para ver qué hay que contestar, filtrá por pending.`,
  inputSchema: z.object({
    estado: z.enum(ESTADOS_PRESUPUESTO).optional().describe('Filtrar por estado.'),
    cursor: z.string().optional().describe('nextCursor de la llamada anterior.'),
    limit: z.number().int().min(1).max(50).optional().describe('Cuántos (default 20, máx 50).'),
  }),
  annotations: { readOnlyHint: true },
  async handler(args, { db }) {
    const snap = await db.collection('presupuestos').orderBy('createdAt', 'desc').limit(200).get();
    const todos = snap.docs.map(d => presupuestoResumen(d.id, d.data()));
    const lista = args.estado ? todos.filter(p => p.estado === args.estado) : todos;
    const page = pageArray(lista, { cursor: args.cursor, limit: args.limit ?? 20 });
    const pendientes = todos.filter(p => p.estado === 'pending').length;
    return {
      summary: `${page.total} presupuestos${args.estado ? ` en estado ${args.estado}` : ''}; ${pendientes} pendientes de responder.`,
      data: page,
    };
  },
});

export const getBudgetRequestTool = defineTool({
  name: 'get_budget_request',
  title: 'Ver un presupuesto',
  description:
    'Un pedido de presupuesto completo (contacto, servicios, descripción, montos, pagos recibidos) + el mensaje '
    + 'sugerido para mandarle al cliente y el link de WhatsApp con ese mensaje ya escrito (whatsappUrl; null si el '
    + 'cliente no dejó teléfono).',
  inputSchema: z.object({ id: z.string().min(1).max(100).describe('Id del presupuesto.') }),
  annotations: { readOnlyHint: true },
  async handler(args, { db }) {
    const p = await getPresupuesto(db, args.id);
    return { summary: `${p.cliente || p.id}: ${ESTADO_LABEL[p.estado] || p.estado}.`, data: conLinks(p) };
  },
});

export const quoteBudgetRequestTool = defineTool({
  name: 'quote_budget_request',
  title: 'Cotizar un presupuesto',
  description:
    'Le pone monto a un pedido de presupuesto y (por default) genera el link de pago de MercadoPago por el monto en '
    + 'pesos. Guarda todo en el presupuesto (queda como "Enviado" si hay link, "Revisado" si no) y devuelve el mensaje '
    + 'para el cliente con el link de WhatsApp ya escrito: el mensaje lo manda Mariano tocando ese link, esta tool no '
    + 'le escribe a nadie. Cuando el cliente paga, el presupuesto pasa solo a "Aceptado" y a Mariano le llega un mail. '
    + 'Usá dry_run: true para ver el mensaje sin guardar ni crear el link, y confirmá los montos con Mariano antes.',
  inputSchema: z.object({
    id: z.string().min(1).max(100).describe('Id del presupuesto.'),
    monto_ars: z.number().positive().max(1e10).describe('Total en pesos (es lo que se cobra por MercadoPago).'),
    monto_usd: z.number().positive().max(1e8).optional().describe('Total en dólares, solo informativo.'),
    notas: z.string().max(1000).optional().describe('Nota para el cliente (alcance, plazos, forma de pago). Va en el mensaje.'),
    link_pago: z.boolean().optional().describe('Generar link de MercadoPago (default true).'),
    dry_run: z.boolean().optional().describe('true = solo muestra cómo quedaría, sin guardar ni crear el link.'),
  }),
  annotations: { readOnlyHint: false, openWorldHint: true },
  async handler(args, { db }) {
    const actual = await getPresupuesto(db, args.id);
    const conLink = args.link_pago !== false;
    const p = { ...actual, montoARS: args.monto_ars, montoUSD: args.monto_usd ?? actual.montoUSD, notas: args.notas ?? actual.notas };

    if (args.dry_run) {
      const preview = { ...p, linkPago: conLink ? '<se genera al confirmar>' : actual.linkPago };
      return { summary: `Vista previa para ${p.cliente || p.id} (no se guardó nada).`, data: { dryRun: true, ...conLinks(preview) } };
    }

    if (conLink) {
      try {
        p.linkPago = await crearLinkPagoPresupuesto(p, args.monto_ars);
      } catch {
        throw new ToolError('MercadoPago no generó el link de pago. Probá de nuevo o generalo desde el admin (Presupuestos).');
      }
    }
    await db.collection('presupuestos').doc(p.id).update({
      budgetARS: p.montoARS,
      budgetUSD: p.montoUSD ?? null,
      adminNotes: p.notas || '',
      paymentLink: p.linkPago || null,
      status: p.linkPago ? 'sent' : 'reviewed',
      updatedAt: FieldValue.serverTimestamp(),
    });
    const final = { ...p, estado: p.linkPago ? 'sent' : 'reviewed' };
    const out = conLinks(final);
    return {
      summary: `Presupuesto de ${p.cliente || p.id} cotizado en ARS ${p.montoARS.toLocaleString('es-AR')}${p.linkPago ? ' con link de pago' : ''}. `
        + (out.whatsappUrl ? 'Falta que Mariano toque el link de WhatsApp para mandarlo.' : 'El cliente no dejó teléfono: mandalo por mail.'),
      data: out,
    };
  },
});

export const setBudgetStatusTool = defineTool({
  name: 'set_budget_status',
  title: 'Cambiar el estado de un presupuesto',
  description: `Cambia el estado de un pedido de presupuesto (${ESTADOS_TXT}), por ejemplo cuando el cliente dijo que no o aceptó por otro medio.`,
  inputSchema: z.object({
    id: z.string().min(1).max(100).describe('Id del presupuesto.'),
    estado: z.enum(ESTADOS_PRESUPUESTO).describe('Estado nuevo.'),
  }),
  annotations: { readOnlyHint: false, idempotentHint: true },
  async handler(args, { db }) {
    const p = await getPresupuesto(db, args.id);
    await db.collection('presupuestos').doc(p.id).update({ status: args.estado, updatedAt: FieldValue.serverTimestamp() });
    return { summary: `${p.cliente || p.id}: ${ESTADO_LABEL[p.estado]} → ${ESTADO_LABEL[args.estado]}.`, data: { id: p.id, estado: args.estado } };
  },
});

const redondear = (n) => Math.round(n * 100) / 100;

async function presupuestoConMonto(db, id, now) {
  const snap = await db.collection('presupuestos').doc(id).get();
  if (!snap.exists) throw new ToolError(`No existe el presupuesto ${id}. Usá list_budget_requests para ver los ids.`);
  const d = snap.data();
  const datos = datosPresupuesto(id, d, now);
  if (!datos) throw new ToolError('El presupuesto no tiene monto todavía: cotizalo con quote_budget_request.');
  return { snap, d, datos };
}

export const listBudgetServicesTool = defineTool({
  name: 'list_budget_services',
  title: 'Catálogo de servicios para presupuestos',
  description:
    'Los servicios del catálogo de Mariano (los mismos del armador de presupuestos del admin y de la tienda) con id, '
    + 'nombre, descripción y precio en USD vigente (con los precios editados en el admin). Usala antes de '
    + 'create_budget para proponer ítems con servicio_id; lo que no esté en el catálogo (ej. "Base de datos en '
    + 'Supabase", "Imágenes con Cloudinary") va como ítem libre con nombre y precio.',
  inputSchema: z.object({ buscar: z.string().max(100).optional().describe('Filtrar por texto (nombre o descripción).') }),
  annotations: { readOnlyHint: true },
  async handler(args, { db }) {
    const q = (args.buscar || '').toLowerCase();
    const categorias = catalogoEfectivo(await loadOverrides(db))
      .map(c => ({
        categoria: c.category,
        items: c.items
          .filter(s => !q || `${s.label} ${s.desc}`.toLowerCase().includes(q))
          .map(s => ({ id: s.id, nombre: s.label, descripcion: s.desc, precioUSD: s.priceUSD })),
      }))
      .filter(c => c.items.length);
    return { summary: `${categorias.reduce((t, c) => t + c.items.length, 0)} servicios.`, data: { categorias } };
  },
});

const itemSchema = z.object({
  servicio_id: z.string().max(50).optional().describe('Id del catálogo (list_budget_services). Completa nombre, descripción y precio si no los pasás.'),
  nombre: z.string().max(120).optional().describe('Nombre del ítem. Obligatorio si no hay servicio_id.'),
  descripcion: z.string().max(400).optional().describe('Qué incluye.'),
  precio_usd: z.number().min(0).max(1e6).optional().describe('Precio en USD. Obligatorio si no hay servicio_id; si hay, pisa el del catálogo.'),
  descuento_pct: z.number().min(0).max(100).optional().describe('Bonificación de este ítem, en %.'),
});

export const createBudgetTool = defineTool({
  name: 'create_budget',
  title: 'Armar un presupuesto nuevo',
  description:
    'Arma un presupuesto desde cero para un cliente (igual que el armador del admin): ítems del catálogo o libres '
    + '(ej. "Base de datos en Supabase", "Imágenes con Cloudinary"), descuentos, IVA, cotización del dólar, notas y '
    + 'validez; lo guarda en presupuestos y (por default) genera el link de pago de MercadoPago. Devuelve número, '
    + 'totales, el link de WhatsApp con el mensaje ya escrito (whatsappUrl) y el id para mandarlo por mail con '
    + 'send_budget_email. ANTES de llamarla pedile a Mariano lo que falte, todo junto en un solo mensaje: nombre del '
    + 'cliente, empresa, email y/o teléfono (WhatsApp), los ítems con precio en USD (proponé los del catálogo con '
    + 'list_budget_services), descuentos, si lleva IVA, alcance/plazos/forma de pago para las notas, días de validez y '
    + 'si quiere link de pago (por el total o por una seña). Mostrale el resultado con dry_run: true y recién con su OK '
    + 'llamala de verdad. Al final preguntale si lo manda por mail, por WhatsApp o por los dos.',
  inputSchema: z.object({
    cliente: z.string().min(1).max(120).describe('Nombre de la persona.'),
    empresa: z.string().max(120).optional().describe('Empresa o negocio.'),
    email: z.string().email().max(200).optional().describe('Email del cliente (para send_budget_email).'),
    telefono: z.string().max(40).optional().describe('Teléfono / WhatsApp del cliente.'),
    items: z.array(itemSchema).min(1).max(30).describe('Ítems del presupuesto.'),
    iva: z.boolean().optional().describe('Sumar IVA (default false).'),
    iva_pct: z.number().min(0).max(50).optional().describe('Alícuota de IVA (default 21).'),
    cotizacion_ars: z.number().positive().max(1e6).optional().describe('Pesos por dólar. Default: dólar oficial venta de hoy.'),
    notas: z.string().max(2000).optional().describe('Alcance, plazos, forma de pago, etc. Van en el mail y en el WhatsApp.'),
    validez_dias: z.number().int().min(1).max(365).optional().describe('Días de validez (default 15).'),
    link_pago: z.boolean().optional().describe('Generar link de MercadoPago (default true).'),
    monto_link_ars: z.number().positive().max(1e10).optional().describe('Monto del link en pesos (ej. una seña). Default: el total.'),
    dry_run: z.boolean().optional().describe('true = calcula y muestra, sin guardar ni crear el link.'),
  }),
  annotations: { readOnlyHint: false, openWorldHint: true },
  async handler(args, { db, now = new Date() }) {
    if (!args.email && !args.telefono) throw new ToolError('Falta cómo mandarlo: pedile a Mariano el email o el teléfono del cliente.');
    const catalogo = Object.fromEntries(catalogoEfectivo(await loadOverrides(db)).flatMap(c => c.items).map(s => [s.id, s]));
    const items = args.items.map((it, i) => {
      const base = it.servicio_id ? catalogo[it.servicio_id] : null;
      if (it.servicio_id && !base) throw new ToolError(`El servicio ${it.servicio_id} no está en el catálogo (list_budget_services).`);
      const label = it.nombre || base?.label;
      const priceUSD = it.precio_usd ?? base?.priceUSD;
      if (!label || priceUSD == null) throw new ToolError(`Al ítem ${i + 1} le falta nombre o precio_usd.`);
      return {
        id: it.servicio_id || `libre_${i + 1}`, label, desc: it.descripcion ?? base?.desc ?? '',
        benefit: base?.benefit || '', priceUSD, discount: it.descuento_pct || 0,
      };
    });

    let arsRate = args.cotizacion_ars;
    if (!arsRate) {
      try { arsRate = (await dolarOficialVenta()).cotizacion; } catch { throw new ToolError('No pude leer el dólar oficial de hoy: pasame cotizacion_ars.'); }
    }
    const showIVA = args.iva === true;
    const ivaRate = args.iva_pct ?? 21;
    const totals = calcularTotales(items, { arsRate, ivaRate, showIVA });
    const totalARS = Math.round(totals.totalARS);
    const montoLink = args.monto_link_ars ?? totalARS;
    const conLink = args.link_pago !== false && montoLink > 0;
    const validDays = args.validez_dias ?? 15;
    const quoteNumber = numeroPresupuesto(now);

    const ref = db.collection('presupuestos').doc();
    const p = {
      id: ref.id, cliente: args.cliente, empresa: args.empresa || null, email: args.email || null, telefono: args.telefono || null,
      servicios: items.map(i => i.label), montoUSD: redondear(totals.totalUSD), montoARS: totalARS, notas: args.notas || null, linkPago: null,
    };
    const resumen = {
      numero: quoteNumber,
      items: items.map(i => ({ nombre: i.label, precioUSD: i.priceUSD, descuentoPct: i.discount })),
      cotizacion: arsRate,
      totales: { netoUSD: redondear(totals.netoUSD), ivaUSD: redondear(totals.ivaUSD), totalUSD: p.montoUSD, totalARS },
      montoLinkARS: conLink ? montoLink : null,
      validezDias: validDays,
    };
    const montos = `USD ${p.montoUSD.toLocaleString('es-AR')} / ARS ${totalARS.toLocaleString('es-AR')}`;

    if (args.dry_run) {
      return {
        summary: `Vista previa para ${args.cliente}: ${montos} (no se guardó nada).`,
        data: { dryRun: true, ...resumen, ...conLinks({ ...p, linkPago: conLink ? '<se genera al confirmar>' : null }) },
      };
    }

    if (conLink) {
      try { p.linkPago = await crearLinkPagoPresupuesto(p, montoLink); } catch { throw new ToolError('MercadoPago no generó el link de pago. Probá de nuevo o con link_pago: false.'); }
    }
    await ref.set({
      clientName: args.cliente, clientEmail: args.email || '', clientCompany: args.empresa || '', clientPhone: args.telefono || '',
      projectDescription: args.notas || '', selectedServices: items.map(i => i.id), status: 'reviewed',
      budgetUSD: p.montoUSD, budgetARS: totalARS, paymentLink: p.linkPago, paymentId: null, adminNotes: args.notas || '',
      source: 'mcp', quoteNumber, validDays, arsRate, ivaRate, showIVA, items, totals, cuotas: null,
      montoLinkARS: conLink ? montoLink : null,
      createdAt: FieldValue.serverTimestamp(),
    });
    const out = conLinks(p);
    return {
      summary: `Presupuesto ${quoteNumber} para ${args.cliente} guardado (id ${ref.id}): ${montos}${p.linkPago ? ', con link de pago' : ''}. `
        + ['Para verlo en PDF: get_budget_pdf.', args.email && 'Por mail: send_budget_email.', out.whatsappUrl && 'Por WhatsApp: que Mariano toque whatsappUrl (o el de get_budget_pdf, que suma el link al PDF).'].filter(Boolean).join(' '),
      data: { ...resumen, ...out },
    };
  },
});

export const sendBudgetEmailTool = defineTool({
  name: 'send_budget_email',
  title: 'Mandar un presupuesto por mail',
  description:
    'Le manda al cliente por mail (desde notificaciones@marianoaliandri.com.ar, las respuestas le llegan a Mariano) el '
    + 'presupuesto con ítems, totales en USD y pesos, notas y botón de pago de MercadoPago si tiene link. Sirve para los '
    + 'armados con create_budget, en el admin o cotizados con quote_budget_request. Le escribe a una persona real: '
    + 'confirmá con Mariano y mostrá antes el dry_run: true. Después el presupuesto queda "Enviado".',
  inputSchema: z.object({
    id: z.string().min(1).max(100).describe('Id del presupuesto.'),
    email: z.string().email().max(200).optional().describe('Mandarlo a este email en vez del guardado.'),
    dry_run: z.boolean().optional().describe('true = muestra destinatario, asunto y total sin mandar.'),
  }),
  annotations: { readOnlyHint: false, openWorldHint: true },
  async handler(args, { db, now = new Date() }) {
    const { snap, d, datos } = await presupuestoConMonto(db, args.id, now);
    const to = args.email || d.clientEmail;
    if (!to) throw new ToolError('El presupuesto no tiene email: pasame uno o mandalo por WhatsApp (get_budget_request → whatsappUrl).');
    const subject = `Presupuesto N° ${datos.quoteNumber}${d.clientName ? ` — ${d.clientName}` : ''}`;
    const total = { totalUSD: datos.totalUSD, totalARS: datos.totalARS };
    const quoteNumber = datos.quoteNumber;

    if (args.dry_run) {
      return { summary: `Saldría a ${to}: "${subject}" con el PDF adjunto (no se mandó).`, data: { dryRun: true, to, subject, ...total, linkPago: d.paymentLink || null } };
    }
    if (!process.env.RESEND_API_KEY) throw new ToolError('El envío de mails no está configurado en el servidor.');

    const html = buildHtml({ ...datos, clientEmail: to });
    const pdf = Buffer.from(await generarPdfPresupuesto(datos));
    const { Resend } = await import('resend');
    const r = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'Mariano Aliandri <notificaciones@marianoaliandri.com.ar>', to, reply_to: 'marianoaliandri@gmail.com', subject, html,
      attachments: [{ filename: pdfNombre(datos), content: pdf }],
    });
    if (r?.error) throw new ToolError('Resend no aceptó el mail. Probá de nuevo más tarde.');
    await snap.ref.update({ status: 'sent', emailSentTo: to, emailSentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return { summary: `Presupuesto ${quoteNumber} mandado a ${to}.`, data: { id: args.id, to, subject, ...total, emailId: r?.data?.id || null } };
  },
});

export const getBudgetPdfTool = defineTool({
  name: 'get_budget_pdf',
  title: 'PDF de un presupuesto',
  description:
    'Genera el PDF de un presupuesto (el mismo diseño del mail: ítems, totales en USD y pesos, plan de pagos, link de '
    + 'MercadoPago y notas) y lo devuelve adjunto para mostrarlo en el chat, más un link público (pdfUrl) para '
    + 'descargarlo o mandárselo al cliente, y el link de WhatsApp con el mensaje y el PDF ya escritos. No le manda nada '
    + 'a nadie. Sirve para cualquier presupuesto que ya tenga monto (create_budget, quote_budget_request o el admin).',
  inputSchema: z.object({ id: z.string().min(1).max(100).describe('Id del presupuesto.') }),
  annotations: { readOnlyHint: false, idempotentHint: true },
  async handler(args, { db, now = new Date() }) {
    const { snap, d, datos } = await presupuestoConMonto(db, args.id, now);
    const bytes = await generarPdfPresupuesto(datos);
    const url = pdfUrl(args.id, await tokenPdf(snap.ref, d));
    const p = { ...presupuestoResumen(args.id, d), pdfUrl: url };
    return {
      summary: `PDF del presupuesto ${datos.quoteNumber} (${d.clientName || args.id}), USD ${datos.totalUSD.toLocaleString('es-AR')}. `
        + `Link para descargar o compartir: ${url}`,
      data: { id: args.id, numero: datos.quoteNumber, archivo: pdfNombre(datos), pdfUrl: url, ...conLinks(p) },
      extraContent: [{
        type: 'resource',
        resource: { uri: url, mimeType: 'application/pdf', blob: Buffer.from(bytes).toString('base64') },
      }],
    };
  },
});

export const BUDGET_TOOLS = [
  listBudgetRequestsTool, getBudgetRequestTool, quoteBudgetRequestTool, setBudgetStatusTool,
  listBudgetServicesTool, createBudgetTool, sendBudgetEmailTool, getBudgetPdfTool,
];
