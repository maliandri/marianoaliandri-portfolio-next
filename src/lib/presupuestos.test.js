import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);

import { createFakeDb } from '@/test/fakeDb';
import { presupuestoResumen, telefonoWa, mensajePresupuesto, whatsappUrl, registrarPagoPresupuesto } from './presupuestos';

describe('presupuestos', () => {
  const p = presupuestoResumen('b1', {
    clientName: 'Ana', clientPhone: '0299 15-555-1234', selectedServices: ['Sitio web', 'SEO'],
    status: 'sent', budgetARS: 850000, budgetUSD: 600, paymentLink: 'https://mpago.la/x', adminNotes: 'Entrega en 3 semanas.',
  });

  it('teléfono para wa.me con código de país', () => {
    expect(telefonoWa('0299 15-555-1234')).toBe('5492995551234');
    expect(telefonoWa('+54 9 299 555-1234')).toBe('5492995551234');
    expect(telefonoWa('54 299 555 1234')).toBe('5492995551234');
    expect(telefonoWa('2995551234')).toBe('5492995551234');
    expect(telefonoWa('123')).toBeNull();
  });

  it('mensaje con montos, nota y link; whatsappUrl lo lleva escrito', () => {
    const m = mensajePresupuesto(p);
    expect(m).toContain('Hola Ana!');
    expect(m).toContain('Sitio web, SEO');
    expect(m).toContain('USD 600 / ARS 850.000');
    expect(m).toContain('Entrega en 3 semanas.');
    expect(m).toContain('Link de pago: https://mpago.la/x');
    expect(whatsappUrl(p)).toMatch(/^https:\/\/wa\.me\/54\d+\?text=Hola%20Ana!/);
    expect(whatsappUrl({ ...p, telefono: null })).toBeNull();
  });

  it('pago aprobado: lo registra una sola vez y marca aceptado', async () => {
    const { db } = createFakeDb({ 'presupuestos/b1': { status: 'sent', payments: [] } });
    const pago = { id: 77, transaction_amount: 850000, date_approved: '2026-10-28T10:00:00Z', metadata: { type: 'presupuesto', presupuesto_id: 'b1' } };
    expect(await registrarPagoPresupuesto(db, pago)).toEqual({ duplicado: false });
    expect(await registrarPagoPresupuesto(db, pago)).toEqual({ duplicado: true });
    const doc = (await db.collection('presupuestos').doc('b1').get()).data();
    expect(doc.status).toBe('accepted');
    expect(doc.payments).toEqual([{ id: '77', date: '2026-10-28', amount: 850000, via: 'mercadopago' }]);
    await expect(registrarPagoPresupuesto(db, { id: 1, metadata: {} })).rejects.toThrow(/presupuesto_id/);
  });
});
