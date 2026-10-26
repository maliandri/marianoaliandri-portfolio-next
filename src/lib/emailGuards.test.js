import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
import { createFakeDb } from '@/test/fakeDb';
import {
  normalizeDomain, unsubscribeUrl, verifyUnsubscribe, checkBlocked, lastContactAt, reserveDailySend, addBaja,
} from './emailGuards';

const at = (iso) => { const d = new Date(iso); return { __ts: d.getTime() * 1000, toDate: () => d }; };

beforeEach(() => {
  process.env.EMAIL_UNSUBSCRIBE_SECRET = 'secreto-de-prueba-1234567890';
  process.env.MCP_BASE_URL = 'https://marianoaliandri.com.ar';
});

describe('normalizeDomain', () => {
  it('saca esquema, www, path y pasa a minúsculas', () => {
    expect(normalizeDomain('https://WWW.Panaderia.com.ar/contacto?x=1')).toBe('panaderia.com.ar');
    expect(normalizeDomain('panaderia.com.ar')).toBe('panaderia.com.ar');
    expect(normalizeDomain('')).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
  });
});

describe('link de baja', () => {
  it('firma y verifica el email', () => {
    const url = new URL(unsubscribeUrl('Ana@Negocio.com'));
    expect(url.origin + url.pathname).toBe('https://marianoaliandri.com.ar/baja/');
    const e = url.searchParams.get('e'), t = url.searchParams.get('t');
    expect(e).toBe('ana@negocio.com');
    expect(verifyUnsubscribe(e, t)).toBe(true);
  });

  it('rechaza un token alterado o de otro email', () => {
    const t = new URL(unsubscribeUrl('ana@negocio.com')).searchParams.get('t');
    expect(verifyUnsubscribe('otro@negocio.com', t)).toBe(false);
    expect(verifyUnsubscribe('ana@negocio.com', t.slice(0, -2) + (t.endsWith('aa') ? 'bb' : 'aa'))).toBe(false);
    expect(verifyUnsubscribe('ana@negocio.com', 'corto')).toBe(false);
  });
});

describe('checkBlocked', () => {
  it('una baja bloquea también otra casilla del mismo dominio', async () => {
    const { db } = createFakeDb({ 'sent_emails/s1': { email: 'info@pana.com', siteUrl: 'https://www.pana.com' } });
    await addBaja(db, 'info@pana.com');
    expect(await checkBlocked(db, { email: 'info@pana.com', dominio: 'pana.com' })).toBe('baja');
    expect(await checkBlocked(db, { email: 'ventas@pana.com', dominio: 'pana.com' })).toBe('baja');
    expect(await checkBlocked(db, { email: 'x@otro.com', dominio: 'otro.com' })).toBeNull();
  });

  it('rebotado o con queja bloquea esa dirección', async () => {
    const { db } = createFakeDb({
      'sent_emails/s1': { email: 'Rebota@x.com', status: 'bounced' },
      'sent_emails/s2': { email: 'queja@y.com', status: 'complained' },
    });
    expect(await checkBlocked(db, { email: 'rebota@x.com', dominio: 'x.com' })).toBe('rebotado');
    expect(await checkBlocked(db, { email: 'queja@y.com', dominio: 'y.com' })).toBe('rebotado');
  });
});

describe('lastContactAt', () => {
  it('encuentra un envío viejo sin placeId por el dominio de la web', async () => {
    const { db } = createFakeDb({
      'sent_emails/s1': { email: 'otra@pana.com', siteUrl: 'https://pana.com/', createdAt: at('2026-10-01T00:00:00Z') },
      'sent_emails/s2': { email: 'otra@pana.com', siteUrl: 'https://pana.com/', createdAt: at('2026-10-10T00:00:00Z') },
    });
    const d = await lastContactAt(db, { email: 'nueva@pana.com', dominio: 'pana.com' });
    expect(d.toISOString()).toBe('2026-10-10T00:00:00.000Z');
    expect(await lastContactAt(db, { email: 'x@nada.com', dominio: 'nada.com' })).toBeNull();
  });

  it('encuentra por email aunque cambie la mayúscula', async () => {
    const { db } = createFakeDb({ 'sent_emails/s1': { email: 'Ana@B.com', createdAt: at('2026-10-05T00:00:00Z') } });
    expect(await lastContactAt(db, { email: 'ana@b.com', dominio: null })).not.toBeNull();
  });
});

describe('reserveDailySend', () => {
  it('con tope 2 y 3 pedidos en paralelo pasan exactamente 2', async () => {
    const { db } = createFakeDb();
    const now = new Date('2026-10-26T15:00:00Z');
    const r = await Promise.all([1, 2, 3].map(() => reserveDailySend(db, { cap: 2, now })));
    expect(r.filter(Boolean)).toHaveLength(2);
    expect(await reserveDailySend(db, { cap: 2, now: new Date('2026-10-27T15:00:00Z') })).toBe(true);
  });
});
