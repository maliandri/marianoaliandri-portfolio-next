import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
import { createFakeDb } from '@/test/fakeDb';
import { fetchInstagramStats, IG_SIN_PERMISO } from '@/lib/socialStats';
import { getInstagramStatsTool, getLinkedInStatsTool } from './redes';

const creds = { accessToken: 'tok', igUserId: '178' };
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const permisoError = json({ error: { code: 10, message: 'Application does not have permission' } }, 403);

// Fetch falso de la Graph API: responde según el path pedido.
function graph({ insights = true } = {}) {
  return vi.fn(async (url) => {
    const u = new URL(url);
    const path = u.pathname.replace('/v23.0/', '');
    if (path === '178') return json({ username: 'maliandri', followers_count: 250, follows_count: 90, media_count: 40 });
    if (path === '178/media') return json({ data: [
      { id: 'm1', caption: 'Hola', media_type: 'IMAGE', media_product_type: 'FEED', permalink: 'https://instagram.com/p/1', timestamp: '2026-11-01T10:00:00+0000', like_count: 5, comments_count: 1 },
      { id: 'm2', caption: 'Reel', media_type: 'VIDEO', media_product_type: 'REELS', permalink: 'https://instagram.com/r/2', timestamp: '2026-11-02T10:00:00+0000', like_count: 9, comments_count: 0 },
    ] });
    if (!insights) return permisoError;
    if (path === '178/insights' && u.searchParams.get('metric') === 'follower_count') return json({ data: [{ name: 'follower_count', values: [{ value: 2 }, { value: 3 }] }] });
    if (path === '178/insights') return json({ data: [{ name: 'reach', total_value: { value: 1200 } }, { name: 'total_interactions', total_value: { value: 80 } }] });
    if (path === 'm1/insights') return json({ data: [{ name: 'reach', values: [{ value: 300 }] }, { name: 'saved', values: [{ value: 4 }] }] });
    // m2: Meta rechaza "views" → reintenta con las métricas mínimas.
    if (path === 'm2/insights') {
      return u.searchParams.get('metric').includes('views')
        ? json({ error: { code: 100, message: 'invalid metric' } }, 400)
        : json({ data: [{ name: 'reach', values: [{ value: 700 }] }] });
    }
    return json({ error: { code: 100, message: 'no' } }, 400);
  });
}

describe('fetchInstagramStats', () => {
  it('trae perfil, posts e insights', async () => {
    const r = await fetchInstagramStats({ creds, fetchImpl: graph(), now: Date.UTC(2026, 10, 10) });
    expect(r.perfil).toMatchObject({ usuario: 'maliandri', seguidores: 250, publicaciones: 40 });
    expect(r.insights).toMatchObject({ disponible: true, error: null, seguidoresNuevos: 5, cuenta: { reach: 1200, total_interactions: 80 } });
    expect(r.posts[0]).toMatchObject({ id: 'm1', likes: 5, alcance: 300, guardados: 4 });
    expect(r.posts[1]).toMatchObject({ tipo: 'reel', alcance: 700, vistas: null });
  });

  it('sin permiso de insights devuelve lo básico y explica qué falta', async () => {
    const r = await fetchInstagramStats({ creds, fetchImpl: graph({ insights: false }) });
    expect(r.insights).toMatchObject({ disponible: false, error: IG_SIN_PERMISO });
    expect(r.posts).toHaveLength(2);
    expect(r.posts[0]).not.toHaveProperty('alcance');
  });

  it('token vencido da un error claro', async () => {
    const fetchImpl = vi.fn(async () => json({ error: { code: 190, message: 'expired' } }, 401));
    await expect(fetchInstagramStats({ creds, fetchImpl })).rejects.toThrow(/venció/);
  });
});

describe('get_instagram_stats', () => {
  beforeEach(() => { delete process.env.IG_ACCESS_TOKEN; delete process.env.IG_USER_ID; });

  it('sin credenciales avisa', async () => {
    const { db } = createFakeDb();
    await expect(getInstagramStatsTool.handler({}, { db })).rejects.toThrow(/IG_ACCESS_TOKEN/);
  });

  it('guarda la foto de seguidores del día y devuelve la evolución', async () => {
    process.env.IG_ACCESS_TOKEN = 'tok'; process.env.IG_USER_ID = '178';
    vi.stubGlobal('fetch', graph());
    const { db } = createFakeDb({ 'social_stats/instagram_2026-11-01': { red: 'instagram', fecha: '2026-11-01', seguidores: 240 } });
    const r = await getInstagramStatsTool.handler({}, { db, now: new Date('2026-11-10T12:00:00Z') });
    expect(r.data.evolucionSeguidores).toEqual([{ fecha: '2026-11-01', seguidores: 240 }, { fecha: '2026-11-10', seguidores: 250 }]);
    expect(r.summary).toContain('250 seguidores');
    vi.unstubAllGlobals();
  });
});

describe('get_linkedin_stats', () => {
  it('lista lo publicado en LinkedIn con link, cuenta fallidos y el estado de la conexión', async () => {
    const now = Date.UTC(2026, 10, 10);
    const { db } = createFakeDb({
      'contenidos/c1': { titulo: 'Qué es MCP', publicadoAtMs: now - 86400000, redes: { linkedin: { ok: true, postId: 'urn:li:share:1' } } },
      'contenidos/c2': { titulo: 'Viejo', publicadoAtMs: now - 60 * 86400000, redes: { linkedin: { ok: true, postId: 'urn:li:share:0' } } },
      'reels/r1': { titulo: 'Reel', publicadoAtMs: now - 2 * 86400000, redes: { linkedin: { ok: false, error: 'x' } } },
      'demanda_reportes/d1': { zona: 'Alto Valle', createdAtMs: now - 3 * 86400000, redes: { linkedin: { ok: true, postId: 'urn:li:ugcPost:9' } } },
      'integrations/linkedin': { accessToken: 't', profileId: 'p', expiresAt: now + 20 * 86400000 },
    });
    const r = await getLinkedInStatsTool.handler({}, { db, now: new Date(now) });
    expect(r.data.posts).toEqual([
      { origen: 'pieza', titulo: 'Qué es MCP', fecha: new Date(now - 86400000).toISOString(), url: 'https://www.linkedin.com/feed/update/urn:li:share:1/' },
      { origen: 'demanda', titulo: 'Rubros más buscados en Alto Valle', fecha: new Date(now - 3 * 86400000).toISOString(), url: 'https://www.linkedin.com/feed/update/urn:li:ugcPost:9/' },
    ]);
    expect(r.data.fallidos).toBe(1);
    expect(r.data.conexion).toEqual({ conectado: true, diasRestantes: 20 });
  });
});
