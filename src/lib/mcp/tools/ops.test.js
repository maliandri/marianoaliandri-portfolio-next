import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
vi.mock('@/lib/presupuestos', async (orig) => ({
  ...(await orig()),
  crearLinkPagoPresupuesto: vi.fn(async () => 'https://mpago.la/abc'),
}));

import { createFakeDb } from '@/test/fakeDb';
import { quoteBudgetRequestTool, listBudgetRequestsTool } from './presupuestos';
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
