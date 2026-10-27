import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { track, trackPaymentReturn, installClickTracking } from './track';

// window/document mínimos (el proyecto no tiene jsdom).
let handler;
beforeEach(() => {
  const store = new Map();
  globalThis.window = { dataLayer: [], location: { pathname: '/ia-para/', search: '' } };
  globalThis.sessionStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  globalThis.document = { addEventListener: (_, fn) => { handler = fn; }, removeEventListener: () => { handler = null; } };
});
afterEach(() => { delete globalThis.window; delete globalThis.sessionStorage; delete globalThis.document; });

const events = () => window.dataLayer.filter(a => a[0] === 'event').map(a => a[1]);
const clickOn = href => handler({ target: { closest: () => ({ getAttribute: () => href }) } });

describe('track', () => {
  it('sin gtag cargado, deja el evento en dataLayer', () => {
    track('generate_lead', { x: 1 });
    expect(window.dataLayer[0][0]).toBe('event');
    expect(window.dataLayer[0][2]).toEqual({ x: 1 });
  });

  it('con gtag cargado, lo usa', () => {
    const calls = [];
    window.gtag = (...a) => calls.push(a);
    track('add_to_cart');
    expect(calls).toEqual([['event', 'add_to_cart', {}]]);
  });

  it('vuelta de MercadoPago: marca la compra una sola vez por sesión', () => {
    trackPaymentReturn('?payment=success&type=cv&payment_id=9');
    trackPaymentReturn('?payment=success&type=cv&payment_id=9');
    trackPaymentReturn('?lfp=success');
    trackPaymentReturn('?payment=failure');
    expect(events()).toEqual(['compra_cv', 'compra_lfp']);
  });

  it('clicks a WhatsApp y a /presupuesto en cualquier link, y nada más', () => {
    const off = installClickTracking();
    clickOn('https://wa.me/549?text=hola');
    clickOn('/presupuesto/');
    clickOn('/presupuesto-viejo/');
    clickOn('/tienda/');
    off();
    expect(events()).toEqual(['whatsapp_click', 'cta_presupuesto']);
    expect(window.dataLayer[0][2].page_path).toBe('/ia-para/');
  });
});
