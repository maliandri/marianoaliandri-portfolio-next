import { describe, it, expect } from 'vitest';
import { urlCliente, tokenOk, vistaCliente } from './presupuestoCliente';
import { mensajePresupuesto } from './presupuestos';

describe('link del presupuesto para el cliente', () => {
  it('arma la url con barra final y token', () => {
    expect(urlCliente('abc123', 'tok')).toBe('https://marianoaliandri.com.ar/tu-presupuesto/abc123/?t=tok');
  });

  it('tokenOk compara seguro y falla si falta algo', () => {
    expect(tokenOk('abc', 'abc')).toBe(true);
    expect(tokenOk('abc', 'abd')).toBe(false);
    expect(tokenOk('ab', 'abc')).toBe(false);
    expect(tokenOk('a', undefined)).toBe(false);
    expect(tokenOk(undefined, 'a')).toBe(false);
  });

  it('vistaCliente: ítems del admin (label/benefit) y del MCP (nombre/desc)', () => {
    const v = vistaCliente('p1', {
      clientName: 'Mónica Rospide', status: 'sent', paymentLink: 'https://mp/x', quoteNumber: '0042',
      items: [{ label: 'Tienda online', benefit: 'Vendé sin depender de redes.', desc: 'técnico' }, { nombre: 'SEO', desc: 'Que te encuentren' }],
      totals: { totalARS: 2343000, totalUSD: 1500 },
    });
    expect(v).toMatchObject({ nombre: 'Mónica', numero: '0042', totalARS: 2343000, totalUSD: 1500, linkPago: 'https://mp/x', pagado: false });
    expect(v.items).toEqual([{ titulo: 'Tienda online', beneficio: 'Vendé sin depender de redes.' }, { titulo: 'SEO', beneficio: 'Que te encuentren' }]);
  });

  it('vistaCliente: sin ítems usa los servicios; pagado si está aceptado o tiene pagos', () => {
    const v = vistaCliente('p2', { selectedServices: ['Carrito'], status: 'accepted', budgetARS: 100, budgetUSD: 1 });
    expect(v.items).toEqual([{ titulo: 'Carrito', beneficio: '' }]);
    expect(v.pagado).toBe(true);
    expect(v.numero).toBe('p2');
    expect(vistaCliente('p3', { payments: [{ id: 1 }] }).pagado).toBe(true);
  });

  it('el WhatsApp manda el link del cliente en vez del PDF y del link de pago', () => {
    const m = mensajePresupuesto({ cliente: 'Ana', servicios: ['Web'], montoARS: 1000, clienteUrl: 'https://marianoaliandri.com.ar/tu-presupuesto/x/?t=y', pdfUrl: 'https://pdf', linkPago: 'https://mp' });
    expect(m).toContain('https://marianoaliandri.com.ar/tu-presupuesto/x/?t=y');
    expect(m).not.toContain('PDF');
    expect(m).not.toContain('https://mp');
  });
});
