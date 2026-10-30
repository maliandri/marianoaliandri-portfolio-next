import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
vi.mock('@/lib/presupuestos', async (orig) => ({
  ...(await orig()),
  crearLinkPagoPresupuesto: vi.fn(async () => 'https://mpago.la/abc'),
}));

const sendMail = vi.fn(async () => ({ data: { id: 'em1' } }));
vi.mock('resend', () => ({ Resend: class { constructor() { this.emails = { send: sendMail }; } } }));

import { createFakeDb } from '@/test/fakeDb';
import { quoteBudgetRequestTool, listBudgetRequestsTool, createBudgetTool, sendBudgetEmailTool, getBudgetPdfTool } from './presupuestos';
import { saveDemandZoneTool, resolverLocalidad } from './demanda';
import { getAutomationStatusTool } from './status';
import { ToolError } from '../defineTool';

const seed = () => createFakeDb({
  'presupuestos/b1': { clientName: 'Ana', clientPhone: '2995551234', selectedServices: ['Sitio web'], status: 'pending', createdAt: 2 },
  'presupuestos/b2': { clientName: 'Beto', selectedServices: ['SEO'], status: 'accepted', createdAt: 1 },
});

describe('presupuestos (MCP)', () => {
  it('lista y filtra por estado', async () => {
    const { db } = seed();
    const r = await listBudgetRequestsTool.handler({ estado: 'pending' }, { db });
    expect(r.data.items.map(p => p.id)).toEqual(['b1']);
    expect(r.summary).toContain('1 pendientes');
  });

  it('dry_run no guarda; la cotización real guarda monto, link y estado y arma el WhatsApp', async () => {
    const { db } = seed();
    const prev = await quoteBudgetRequestTool.handler({ id: 'b1', monto_ars: 500000, dry_run: true }, { db });
    expect(prev.data.dryRun).toBe(true);
    expect((await db.collection('presupuestos').doc('b1').get()).data().status).toBe('pending');

    const r = await quoteBudgetRequestTool.handler({ id: 'b1', monto_ars: 500000, monto_usd: 350, notas: 'Entrega en 2 semanas.' }, { db });
    const doc = (await db.collection('presupuestos').doc('b1').get()).data();
    expect(doc).toMatchObject({ budgetARS: 500000, budgetUSD: 350, paymentLink: 'https://mpago.la/abc', status: 'sent', adminNotes: 'Entrega en 2 semanas.' });
    expect(r.data.whatsappUrl).toMatch(/^https:\/\/wa\.me\/5492995551234\?text=/);
    expect(decodeURIComponent(r.data.whatsappUrl)).toContain('Link de pago: https://mpago.la/abc');
  });

  it('create_budget arma ítems del catálogo y libres, calcula totales y guarda con link y WhatsApp', async () => {
    const { db } = seed();
    const args = {
      cliente: 'Carla', empresa: 'Deco SRL', email: 'carla@deco.com', telefono: '299 155551234', cotizacion_ars: 1000, notas: 'Entrega en 3 semanas.',
      items: [{ servicio_id: 'landing', descuento_pct: 10 }, { nombre: 'Base de datos en Supabase', precio_usd: 200 }],
    };
    const prev = await createBudgetTool.handler({ ...args, dry_run: true }, { db });
    expect(prev.data.totales).toEqual({ netoUSD: 470, ivaUSD: 0, totalUSD: 470, totalARS: 470000 });
    expect((await db.collection('presupuestos').get()).size).toBe(2);

    const r = await createBudgetTool.handler(args, { db });
    const doc = (await db.collection('presupuestos').doc(r.data.id).get()).data();
    expect(doc).toMatchObject({ clientName: 'Carla', budgetARS: 470000, paymentLink: 'https://mpago.la/abc', source: 'mcp', status: 'reviewed' });
    expect(doc.items.map(i => i.label)).toEqual(['Landing Page', 'Base de datos en Supabase']);
    expect(decodeURIComponent(r.data.whatsappUrl)).toContain('Link de pago: https://mpago.la/abc');
  });

  it('create_budget sin email ni teléfono, o con ítem sin precio → error claro', async () => {
    const { db } = seed();
    await expect(createBudgetTool.handler({ cliente: 'X', items: [{ nombre: 'A', precio_usd: 1 }], cotizacion_ars: 1 }, { db })).rejects.toBeInstanceOf(ToolError);
    await expect(createBudgetTool.handler({ cliente: 'X', email: 'x@x.com', items: [{ nombre: 'A' }], cotizacion_ars: 1 }, { db })).rejects.toThrow(/precio_usd/);
  });

  it('send_budget_email: dry_run no manda; el envío real manda el HTML con el botón de pago y marca Enviado', async () => {
    process.env.RESEND_API_KEY = 'k';
    const { db } = seed();
    const { data: { id } } = await createBudgetTool.handler({ cliente: 'Carla', email: 'carla@deco.com', cotizacion_ars: 1000, items: [{ nombre: 'Cloudinary <setup>', precio_usd: 100 }] }, { db });
    sendMail.mockClear();
    const prev = await sendBudgetEmailTool.handler({ id, dry_run: true }, { db });
    expect(prev.data).toMatchObject({ dryRun: true, to: 'carla@deco.com', totalARS: 100000 });
    expect(sendMail).not.toHaveBeenCalled();

    await sendBudgetEmailTool.handler({ id }, { db });
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe('carla@deco.com');
    expect(mail.attachments[0].filename).toMatch(/^presupuesto-P-.*\.pdf$/);
    expect(mail.attachments[0].content.subarray(0, 5).toString()).toBe('%PDF-');
    expect(mail.html).toContain('Cloudinary &lt;setup&gt;');
    expect(mail.html).toContain('https://mpago.la/abc');
    expect((await db.collection('presupuestos').doc(id).get()).data().status).toBe('sent');
  });

  it('get_budget_pdf devuelve el PDF adjunto, un link con token estable y el WhatsApp con el PDF', async () => {
    const { db } = seed();
    const { data: { id } } = await createBudgetTool.handler({
      cliente: 'Carla', telefono: '2995551234', cotizacion_ars: 1000, notas: 'Entrega en 3 semanas. 🚀',
      items: [{ nombre: 'Imágenes con Cloudinary', descripcion: 'Subida, recorte y CDN '.repeat(8), precio_usd: 150, descuento_pct: 10 }],
    }, { db });
    const r = await getBudgetPdfTool.handler({ id }, { db });
    const res = r.extraContent[0].resource;
    expect(res.mimeType).toBe('application/pdf');
    expect(Buffer.from(res.blob, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    expect(r.data.pdfUrl).toMatch(new RegExp(`/api/presupuesto/pdf/${id}/\\?t=[\\w-]{24}$`));
    expect(decodeURIComponent(r.data.whatsappUrl)).toContain(`Presupuesto en PDF: ${r.data.pdfUrl}`);
    const again = await getBudgetPdfTool.handler({ id }, { db });
    expect(again.data.pdfUrl).toBe(r.data.pdfUrl);
  });

  it('send_budget_email de un pedido sin monto → pide cotizarlo', async () => {
    const { db } = seed();
    await expect(sendBudgetEmailTool.handler({ id: 'b1', email: 'a@a.com' }, { db })).rejects.toThrow(/quote_budget_request/);
  });

  it('id inexistente → error claro', async () => {
    const { db } = seed();
    await expect(quoteBudgetRequestTool.handler({ id: 'x', monto_ars: 1 }, { db })).rejects.toBeInstanceOf(ToolError);
  });
});

describe('zonas de demanda (MCP)', () => {
  it('resuelve nombres oficiales sin importar acentos y sugiere si no encuentra', () => {
    expect(resolverLocalidad({ provincia: 'neuquen', localidad: 'plottier' })).toEqual({ provincia: 'Neuquén', localidad: 'Plottier' });
    expect(() => resolverLocalidad({ provincia: 'Río Negro', localidad: 'Roca' })).toThrow(/General Roca/);
    expect(() => resolverLocalidad({ provincia: 'Marte', localidad: 'x' })).toThrow(/Provincia desconocida/);
  });

  it('crea, reemplaza y elimina una zona sin tocar las demás', async () => {
    const { db } = createFakeDb({});
    await saveDemandZoneTool.handler({ nombre: 'Valle Medio', localidades: [{ provincia: 'rio negro', localidad: 'choele choel' }] }, { db });
    let zonas = (await db.collection('demanda_auto').doc('config').get()).data().zonas;
    expect(zonas.map(z => z.id)).toEqual(['alto-valle', 'cordoba', 'rosario', 'caba', 'valle-medio']);
    expect(zonas.at(-1).localidades).toEqual([{ provincia: 'Río Negro', localidad: 'Choele Choel' }]);

    await saveDemandZoneTool.handler({ nombre: 'Rosario', eliminar: true }, { db });
    zonas = (await db.collection('demanda_auto').doc('config').get()).data().zonas;
    expect(zonas.map(z => z.id)).toEqual(['alto-valle', 'cordoba', 'caba', 'valle-medio']);
  });
});

describe('get_automation_status', () => {
  it('resume problemas y presupuestos pendientes', async () => {
    const now = new Date('2026-10-28T12:00:00Z');
    const ts = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
    const { db } = createFakeDb({
      'noticias_config/settings': { active: true },
      'noticias/n1': { title: 'A', status: 'published', publishedAt: ts(now - 3600e3) },
      'noticias/n2': { title: 'B', status: 'error', makeError: 'Instagram 9004', publishedAt: ts(now - 7200e3) },
      'demanda_auto_runs/r1': { estado: 'sin_datos', zona: 'CABA', createdAt: ts(now - 1000) },
      'presupuestos/b1': { status: 'pending' },
    });
    const r = await getAutomationStatusTool.handler({}, { db, now });
    expect(r.summary).toContain('1 noticias fallidas');
    expect(r.summary).toContain('informes de demanda: sin_datos');
    expect(r.summary).toContain('1 presupuestos sin responder');
    expect(r.data.noticias.ultimosErrores[0].error).toBe('Instagram 9004');
  });
});
