import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
const { createFakeDb } = await import('@/test/fakeDb');
const { aceptarMeet, rechazarMeet, firmarState, verificarState, ocupados } = await import('./googleCalendar');

const INICIO = '2026-11-26T13:00:00.000Z';
const FIN = '2026-11-26T13:30:00.000Z';
const conSolicitud = (meet = { estado: 'pedido', inicio: INICIO, fin: FIN }) => createFakeDb({
  'presupuestos/p1': { clientName: 'Mónica', clientEmail: 'cli@x.com', selectedServices: ['Carrito'], meet },
});

// fetch falso: freeBusy devuelve `busy`; events.insert devuelve el evento con link de Meet.
function fakeFetch(busy = []) {
  const calls = [];
  const fn = vi.fn(async (url, opts = {}) => {
    calls.push({ url, body: opts.body ? JSON.parse(opts.body) : null });
    if (url.includes('/freeBusy')) return new Response(JSON.stringify({ calendars: { primary: { busy } } }));
    if (url.includes('/events')) return new Response(JSON.stringify({ id: 'ev1', hangoutLink: 'https://meet.google.com/abc-defg-hij' }));
    return new Response('{}', { status: 404 });
  });
  fn.calls = calls;
  return fn;
}

describe('aceptarMeet', () => {
  it('si el turno se ocupó entre medio → 409 y no crea el evento', async () => {
    const { db } = conSolicitud();
    const f = fakeFetch([{ start: '2026-11-26T13:10:00Z', end: '2026-11-26T13:40:00Z' }]);
    const r = await aceptarMeet(db, 'p1', { accessToken: 't', fetchImpl: f });
    expect(r.status).toBe(409);
    expect(f.calls.some(c => c.url.includes('/events'))).toBe(false);
  });

  it('libre → crea el evento con Meet, invita al cliente y guarda el link', async () => {
    const { db } = conSolicitud();
    const f = fakeFetch([]);
    const r = await aceptarMeet(db, 'p1', { accessToken: 't', fetchImpl: f });
    expect(r).toMatchObject({ status: 200, meetUrl: 'https://meet.google.com/abc-defg-hij' });
    const ev = f.calls.find(c => c.url.includes('/events'));
    expect(ev.url).toContain('conferenceDataVersion=1');
    expect(ev.url).toContain('sendUpdates=all');
    expect(ev.body.attendees).toEqual([{ email: 'cli@x.com' }]);
    expect(ev.body.start.dateTime).toBe(INICIO);
    expect(ev.body.conferenceData.createRequest.requestId).toBe('p1');
    const doc = (await db.collection('presupuestos').doc('p1').get()).data();
    expect(doc.meet).toMatchObject({ estado: 'aceptado', eventId: 'ev1', meetUrl: 'https://meet.google.com/abc-defg-hij', inicio: INICIO });
  });

  it('una solicitud sin turno pedido → 400', async () => {
    const { db } = conSolicitud({ estado: 'sin_meet', inicio: null, fin: null });
    expect((await aceptarMeet(db, 'p1', { accessToken: 't', fetchImpl: fakeFetch() })).status).toBe(400);
  });

  it('rechazarMeet marca rechazado', async () => {
    const { db } = conSolicitud();
    await rechazarMeet(db, 'p1');
    expect((await db.collection('presupuestos').doc('p1').get()).data().meet.estado).toBe('rechazado');
  });
});

describe('ocupados / state', () => {
  it('ocupados traduce el freeBusy', async () => {
    const r = await ocupados({ accessToken: 't', desde: INICIO, hasta: FIN, fetchImpl: fakeFetch([{ start: 'a', end: 'b' }]) });
    expect(r).toEqual([{ inicio: 'a', fin: 'b' }]);
  });
  it('el state firmado vence y no se puede falsificar', () => {
    const s = firmarState('secreto', 1000);
    expect(verificarState(s, 'secreto', 1000 + 60000)).toBe(true);
    expect(verificarState(s, 'secreto', 1000 + 11 * 60000)).toBe(false);
    expect(verificarState(s, 'otro', 1000)).toBe(false);
    expect(verificarState('basura', 'secreto', 1000)).toBe(false);
  });
});
