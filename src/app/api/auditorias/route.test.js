import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/adminAuth', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auditoriasStore', () => ({ saveAuditoria: vi.fn(async () => ({ id: 'new1' })) }));
import { requireAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/firebase-admin';
import { saveAuditoria } from '@/lib/auditoriasStore';
import { createFakeDb } from '@/test/fakeDb';
import { GET, POST, PATCH, DELETE } from './route.js';

const denied = { response: Response.json({ error: 'No autenticado' }, { status: 401 }) };
const req = (url, body) => ({ url, json: async () => body, headers: new Headers() });

describe('/api/auditorias', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET ?id= sin admin: 404 si no es caso demo', async () => {
    requireAdmin.mockResolvedValue(denied);
    getDb.mockReturnValue(createFakeDb({ 'auditorias/a': { title: 'T', publishedAt: null } }).db);
    const res = await GET(req('https://x/api/auditorias/?id=a'));
    expect(res.status).toBe(404);
  });

  it('GET ?id= sin admin de un caso demo: sin email, WhatsApp ni clave', async () => {
    requireAdmin.mockResolvedValue(denied);
    getDb.mockReturnValue(createFakeDb({ 'auditorias/a': {
      title: 'T', isDemoCase: true, publishedAt: null, clave: 'secreta',
      results: [{ id: 'n1', nombre: 'N', seoScore: 50, email: 'x@y.com', whatsapp: '549299', agencia: 'Z' }],
    } }).db);
    const res = await GET(req('https://x/api/auditorias/?id=a'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].nombre).toBe('N');
    expect(body.results[0]).not.toHaveProperty('email');
    expect(body.results[0]).not.toHaveProperty('whatsapp');
    expect(body.results[0]).not.toHaveProperty('agencia');
    expect(body).not.toHaveProperty('clave');
  });

  it('GET ?id= con admin devuelve todo y la clave', async () => {
    requireAdmin.mockResolvedValue({ user: { uid: 'a' } });
    getDb.mockReturnValue(createFakeDb({ 'auditorias/a': { title: 'T', publishedAt: null, results: [{ id: 'n1', email: 'x@y.com' }] } }).db);
    const body = await (await GET(req('https://x/api/auditorias/?id=a'))).json();
    expect(body.results[0].email).toBe('x@y.com');
    expect(typeof body.clave).toBe('string');
  });

  it('GET listado exige admin', async () => {
    requireAdmin.mockResolvedValue(denied);
    getDb.mockReturnValue(createFakeDb({}).db);
    expect((await GET(req('https://x/api/auditorias/'))).status).toBe(401);
  });

  it('POST, PATCH y DELETE exigen admin', async () => {
    requireAdmin.mockResolvedValue(denied);
    expect((await POST(req('https://x/api/auditorias/', { title: 't', results: [1] }))).status).toBe(401);
    expect((await PATCH(req('https://x/api/auditorias/', { id: 'a' }))).status).toBe(401);
    expect((await DELETE(req('https://x/api/auditorias/?id=a', {}))).status).toBe(401);
    expect(saveAuditoria).not.toHaveBeenCalled();
  });

  it('POST con admin guarda', async () => {
    requireAdmin.mockResolvedValue({ user: { uid: 'a' } });
    const res = await POST(req('https://x/api/auditorias/', { title: 't', results: [1] }));
    expect(await res.json()).toEqual({ success: true, id: 'new1' });
  });
});
