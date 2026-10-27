import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import {
  ESTADOS_PRESUPUESTO, ESTADO_LABEL, presupuestoResumen, mensajePresupuesto, whatsappUrl, crearLinkPagoPresupuesto,
} from '@/lib/presupuestos';
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

export const BUDGET_TOOLS = [listBudgetRequestsTool, getBudgetRequestTool, quoteBudgetRequestTool, setBudgetStatusTool];
