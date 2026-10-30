import { describe, it, expect, vi } from 'vitest';
import { createFakeDb } from '@/test/fakeDb';

const fake = createFakeDb({
  'presupuestos/p1': { clientName: 'Ana', budgetUSD: 100, budgetARS: 140000, selectedServices: ['Landing'], pdfToken: 'tok-123' },
  'presupuestos/p2': { clientName: 'Beto', selectedServices: ['SEO'], pdfToken: 'tok-456' },
});
vi.mock('@/lib/firebase-admin', () => ({ getDb: () => fake.db }));

const { GET } = await import('./route');
const pedir = (id, t) => GET(new Request(`https://x/api/presupuesto/pdf/${id}/${t ? `?t=${t}` : ''}`), { params: Promise.resolve({ id }) });

describe('GET /api/presupuesto/pdf/[id]', () => {
  it('con el token correcto devuelve el PDF', async () => {
    const r = await pedir('p1', 'tok-123');
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('application/pdf');
    expect(Buffer.from(await r.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('sin token, con otro token, de otro presupuesto o sin monto → 404', async () => {
    expect((await pedir('p1')).status).toBe(404);
    expect((await pedir('p1', 'tok-456')).status).toBe(404);
    expect((await pedir('nope', 'tok-123')).status).toBe(404);
    expect((await pedir('p2', 'tok-456')).status).toBe(404);
  });
});
