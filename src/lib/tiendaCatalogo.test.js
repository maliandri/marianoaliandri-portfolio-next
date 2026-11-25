import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'ts' } }));
const { validarPieza, limpiarFicha } = await import('./tiendaCatalogo');

const base = { id: 'pieza_x', label: 'Pieza X', priceUSD: 10, tipo: 'modulo' };

describe('ficha de una pieza (admin → Tienda)', () => {
  it('guarda la ficha que manda el admin, limpia y sin campos extra', () => {
    const v = validarPieza({ ...base, ficha: { paraQue: '  Sirve  ', ejemplo: 'Un caso', necesitoDeVos: 'Nada', tiempo: 'Un día', faq: [{ q: '¿Sí?', a: 'Sí.' }, { q: '', a: 'vacía' }], precio: 9 } });
    expect(v.doc.ficha).toEqual({ paraQue: 'Sirve', ejemplo: 'Un caso', necesitoDeVos: 'Nada', tiempo: 'Un día', faq: [{ q: '¿Sí?', a: 'Sí.' }] });
  });
  it('limpiarFicha corta textos largos y descarta lo que no es objeto', () => {
    expect(limpiarFicha('texto')).toBeNull();
    expect(limpiarFicha({ paraQue: 'x'.repeat(2000) }).paraQue.length).toBe(1200);
  });
  it('sin ficha en el body no copia la semilla del código al doc', () => {
    expect(validarPieza({ ...base, id: 'carrito' }).doc.ficha).toBeNull();
  });
});
