import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
const { createFakeDb } = await import('@/test/fakeDb');
const { debeAvisar, textoAviso, textoSolicitud, registrarSesion, esBot } = await import('./tiendaSesion');
const { sendTelegram } = await import('./telegram');

const UA = 'Mozilla/5.0 (iPhone) Safari';

describe('debeAvisar', () => {
  it('avisa al llegar a 2 servicios o con la primera pregunta, una sola vez', () => {
    expect(debeAvisar({ avisado: false }, { servicios: ['a'] })).toBeNull();
    expect(debeAvisar({ avisado: false }, { servicios: ['a', 'b'] })).toBe('interes');
    expect(debeAvisar({ avisado: false }, { servicios: [], ultimaPregunta: '¿cuánto tarda?' })).toBe('interes');
    expect(debeAvisar({ avisado: true }, { servicios: ['a', 'b', 'c'] })).toBeNull();
  });
});

describe('registrarSesion', () => {
  it('dos pedidos simultáneos que cruzan el umbral → un solo aviso', async () => {
    const { db } = createFakeDb();
    const avisar = vi.fn(async () => {});
    const datos = { id: 'sesion-0001', servicios: ['carrito', 'payments_mp'], ciudad: 'Neuquén', ua: UA };
    await Promise.all([registrarSesion(db, datos, { avisar, now: 1 }), registrarSesion(db, datos, { avisar, now: 2 })]);
    expect(avisar).toHaveBeenCalledTimes(1);
    const doc = (await db.collection('tienda_sesiones').doc('sesion-0001').get()).data();
    expect(doc).toMatchObject({ avisado: true, ciudad: 'Neuquén', servicios: ['carrito', 'payments_mp'] });
    expect(doc).not.toHaveProperty('ip');
  });
  it('los bots no escriben ni avisan', async () => {
    const { db, docs } = createFakeDb();
    const avisar = vi.fn();
    await registrarSesion(db, { id: 'sesion-0002', servicios: ['a', 'b'], ua: 'Googlebot/2.1' }, { avisar });
    expect(avisar).not.toHaveBeenCalled();
    expect(Object.keys(docs)).toEqual([]);
    expect(esBot('facebookexternalhit/1.1')).toBe(true);
    expect(esBot(UA)).toBe(false);
  });
  it('un id inválido no escribe', async () => {
    const { db, docs } = createFakeDb();
    await registrarSesion(db, { id: '../x', servicios: ['a', 'b'], ua: UA }, { avisar: vi.fn() });
    expect(Object.keys(docs)).toEqual([]);
  });
});

describe('textos', () => {
  it('el aviso lleva ciudad, servicios y la pregunta, sin montos', () => {
    const t = textoAviso({ ciudad: 'Neuquén', servicios: ['carrito', 'payments_mp'], ultimaPregunta: '¿Puedo cargar los productos yo?' }, { labels: { carrito: 'Carrito de compras', payments_mp: 'Pagos MercadoPago' } });
    expect(t).toContain('Neuquén');
    expect(t).toContain('Carrito de compras + Pagos MercadoPago');
    expect(t).toContain('¿Puedo cargar los productos yo?');
    expect(t).not.toMatch(/\$\s?\d|USD/);
  });
  it('el aviso de solicitud dice el turno pedido', () => {
    const t = textoSolicitud({ clientName: 'Mónica', selectedServices: ['Carrito'], meet: { estado: 'pedido', inicio: '2026-11-26T13:00:00.000Z' } });
    expect(t).toMatch(/Mónica/);
    expect(t).toMatch(/Meet/);
    expect(t).toMatch(/10:00/);
  });
});

describe('sendTelegram', () => {
  it('sin configuración no tira', async () => {
    expect(await sendTelegram({ texto: 'hola', env: {} })).toEqual({ ok: false, error: 'sin config' });
  });
  it('arma el pedido a la Bot API con botones', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    const r = await sendTelegram({ texto: 'hola', botones: [{ texto: 'Ver', url: 'https://x' }], env: { TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: '42' }, fetchImpl });
    expect(r.ok).toBe(true);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/botT/sendMessage');
    expect(JSON.parse(opts.body)).toMatchObject({ chat_id: '42', text: 'hola', reply_markup: { inline_keyboard: [[{ text: 'Ver', url: 'https://x' }]] } });
  });
});
