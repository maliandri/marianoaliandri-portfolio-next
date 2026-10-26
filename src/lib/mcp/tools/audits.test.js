import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auditoriasStore', () => ({ saveAuditoria: vi.fn(async () => ({ id: 'aud1', summary: 's' })) }));
vi.mock('@/lib/imageCheck', () => ({ imageIsReachable: vi.fn() }));
vi.mock('@/lib/makeSocial', () => ({ postToMakeSocial: vi.fn() }));
import { createFakeDb } from '@/test/fakeDb';
import { saveAuditoria } from '@/lib/auditoriasStore';
import { imageIsReachable } from '@/lib/imageCheck';
import { postToMakeSocial } from '@/lib/makeSocial';
import { createAuditReportTool, publishAuditSocialTool, getAuditTool } from './audits';

const user = { uid: 'u1', email: 'm@x.com' };
const lead = (id, seoScore) => ({ id, nombre: id, ciudad: 'Neuquén', tipo: 'Durlock', canal: 'web', siteUrl: `https://${id}.com`, seoScore, email: `${id}@x.com` });
const search = (n) => ({
  ciudades: ['Neuquén, Neuquén'], tipos: [], terminos: ['Durlock'], radioKm: 10,
  results: Array.from({ length: n }, (_, i) => lead(`l${i}`, 30 + i)),
});

describe('create_audit_report', () => {
  beforeEach(() => vi.clearAllMocks());

  it('con menos de 3 sitios con web no guarda y dice cuántos hay', async () => {
    const { db } = createFakeDb({ 'leadfinder_searches/u1/items/s1': search(2) });
    await expect(createAuditReportTool.handler({ search_id: 's1' }, { db, user })).rejects.toThrow(/2/);
    expect(saveAuditoria).not.toHaveBeenCalled();
  });

  it('guarda el informe y devuelve la URL pública', async () => {
    const { db } = createFakeDb({ 'leadfinder_searches/u1/items/s1': search(3) });
    const r = await createAuditReportTool.handler({ search_id: 's1' }, { db, user });
    expect(r.data).toMatchObject({ id: 'aud1', url: 'https://marianoaliandri.com.ar/auditorias/aud1' });
    expect(saveAuditoria.mock.calls[0][0].results).toHaveLength(3);
    expect(saveAuditoria.mock.calls[0][0].config.ciudades).toEqual(['Neuquén']);
  });
});

describe('publish_audit_social', () => {
  const audit = { title: 'T', summary: 'S', stats: { total: 3 }, config: {}, results: [] };
  beforeEach(() => vi.clearAllMocks());

  it('si la captura no es una imagen no llama a Make', async () => {
    imageIsReachable.mockResolvedValue({ ok: false, detail: 'HTTP 502' });
    const { db } = createFakeDb({ 'auditorias/a1': audit });
    await expect(publishAuditSocialTool.handler({ id: 'a1', networks: ['facebook'] }, { db, user })).rejects.toThrow(/502/);
    expect(postToMakeSocial).not.toHaveBeenCalled();
  });

  it('dry_run no publica', async () => {
    imageIsReachable.mockResolvedValue({ ok: true, detail: '' });
    const { db } = createFakeDb({ 'auditorias/a1': audit });
    const r = await publishAuditSocialTool.handler({ id: 'a1', networks: ['facebook'], dry_run: true }, { db, user });
    expect(r.data).toMatchObject({ dryRun: true, imageOk: true });
    expect(postToMakeSocial).not.toHaveBeenCalled();
  });

  it('publica una vez; la segunda pide force', async () => {
    imageIsReachable.mockResolvedValue({ ok: true, detail: '' });
    const { db, docs } = createFakeDb({ 'auditorias/a1': audit });
    await publishAuditSocialTool.handler({ id: 'a1', networks: ['facebook', 'instagram'] }, { db, user });
    expect(postToMakeSocial.mock.calls[0][0]).toMatchObject({ type: 'service', networks: ['facebook', 'instagram'], link: 'https://marianoaliandri.com.ar/auditorias/a1' });
    expect(docs['auditorias/a1'].publicadoVia).toBe('mcp');
    await expect(publishAuditSocialTool.handler({ id: 'a1', networks: ['facebook'] }, { db, user })).rejects.toThrow(/force/);
    await publishAuditSocialTool.handler({ id: 'a1', networks: ['facebook'], force: true }, { db, user });
    expect(postToMakeSocial).toHaveBeenCalledTimes(2);
  });
});

describe('get_audit', () => {
  it('pagina las filas y muestra problemas en texto', async () => {
    const { db } = createFakeDb({ 'auditorias/a1': { title: 'T', results: [{ id: 'x', nombre: 'X', siteUrl: 'https://x.com', seoScore: 20, hasSitemap: false, hasRobots: true, metaDesc: true, hasOG: true }] } });
    const r = await getAuditTool.handler({ id: 'a1' }, { db, user });
    expect(r.data.items[0]).toMatchObject({ placeId: 'x', seoScore: 20 });
    expect(r.data.items[0].problemas[0]).toContain('sitemap');
  });
});
