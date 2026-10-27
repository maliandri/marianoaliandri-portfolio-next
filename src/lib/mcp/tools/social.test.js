import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
vi.mock('@/lib/imageCheck', () => ({ imageIsReachable: vi.fn(async () => ({ ok: true, detail: '' })) }));
vi.mock('@/lib/makeSocial', () => ({ postToMakeSocial: vi.fn() }));
vi.mock('@/lib/cloudinaryServer', async (orig) => ({
  ...(await orig()),
  uploadFromUrl: vi.fn(async () => 'https://res.cloudinary.com/c/image/upload/v1/social/mcp/subida.png'),
  uploadPng: vi.fn(async () => 'https://res.cloudinary.com/c/image/upload/v1/social/mcp/tarjeta.png'),
}));
vi.mock('@/lib/igStory', async (orig) => ({ ...(await orig()), publishStory: vi.fn(async () => ({ storyId: 'st1' })) }));
import { createFakeDb } from '@/test/fakeDb';
import { imageIsReachable } from '@/lib/imageCheck';
import { postToMakeSocial } from '@/lib/makeSocial';
import { uploadFromUrl } from '@/lib/cloudinaryServer';
import { publishStory } from '@/lib/igStory';
import { publishFreePostTool, publishIgStoryTool } from './social';

const user = { uid: 'u1', email: 'm@x.com' };
const CLD = (n) => `https://res.cloudinary.com/c/image/upload/v1/social/${n}.png`;

describe('publish_free_post', () => {
  beforeEach(() => { vi.clearAllMocks(); delete process.env.MCP_SOCIAL_DAILY_CAP; });

  it('dry_run no publica ni gasta cupo', async () => {
    const { db } = createFakeDb();
    const r = await publishFreePostTool.handler({ texto: 'Hola', redes: ['linkedin'], dry_run: true }, { db, user });
    expect(r.data).toMatchObject({ dryRun: true, tipo: 'post de texto', redes: ['linkedin'] });
    expect(postToMakeSocial).not.toHaveBeenCalled();
    expect((await db.collection('mcp_social_counter').doc(new Date().toISOString().slice(0, 10)).get()).exists).toBe(false);
  });

  it('carrusel: sube las URLs externas a Cloudinary, saca LinkedIn y manda el contrato de Make', async () => {
    const { db } = createFakeDb();
    await publishFreePostTool.handler({
      texto: 'Lead Finder', redes: ['linkedin', 'facebook_instagram'], imagenes: ['https://canva.com/a.png', CLD('b')],
    }, { db, user });
    expect(uploadFromUrl).toHaveBeenCalledTimes(1);
    const payload = postToMakeSocial.mock.calls[0][0];
    expect(payload).toMatchObject({ type: 'carousel', isCarousel: true, networks: ['facebook'], useAI: false, text: 'Lead Finder' });
    expect(payload.carouselFiles).toHaveLength(2);
    expect(payload.images.every(u => u.includes('c_fill,ar_4:5') && u.includes('f_jpg'))).toBe(true);
  });

  it('Facebook + Instagram sin imagen ni tarjeta: error claro', async () => {
    const { db } = createFakeDb();
    await expect(publishFreePostTool.handler({ texto: 'x', redes: ['facebook_instagram'] }, { db, user })).rejects.toThrow(/imagen/);
  });

  it('carrusel solo a LinkedIn: error', async () => {
    const { db } = createFakeDb();
    await expect(publishFreePostTool.handler({ texto: 'x', redes: ['linkedin'], imagenes: [CLD('a'), CLD('b')] }, { db, user }))
      .rejects.toThrow(/carrusel/i);
  });

  it('tarjeta_titulo arma la tarjeta 4:5 y la publica', async () => {
    const { db } = createFakeDb();
    await publishFreePostTool.handler({ texto: 'x', redes: ['facebook_instagram'], tarjeta_titulo: 'Título de prueba' }, { db, user });
    expect(postToMakeSocial.mock.calls[0][0]).toMatchObject({ type: 'custom', imageUrl: expect.stringContaining('f_jpg') });
  });

  it('imagen que no responde: no publica', async () => {
    imageIsReachable.mockResolvedValueOnce({ ok: false, detail: 'HTTP 404' });
    const { db } = createFakeDb();
    await expect(publishFreePostTool.handler({ texto: 'x', redes: ['facebook_instagram'], imagenes: [CLD('a')] }, { db, user }))
      .rejects.toThrow(/404/);
    expect(postToMakeSocial).not.toHaveBeenCalled();
  });

  it('respeta el tope diario', async () => {
    process.env.MCP_SOCIAL_DAILY_CAP = '1';
    const { db } = createFakeDb();
    const args = { texto: 'x', redes: ['linkedin'] };
    await publishFreePostTool.handler(args, { db, user });
    await expect(publishFreePostTool.handler(args, { db, user })).rejects.toThrow(/tope/i);
    expect(postToMakeSocial).toHaveBeenCalledTimes(1);
  });
});

describe('publish_ig_story', () => {
  beforeEach(() => { vi.clearAllMocks(); delete process.env.MCP_SOCIAL_DAILY_CAP; });

  it('dry_run de imagen devuelve la vista previa 9:16 sin publicar', async () => {
    const { db } = createFakeDb();
    const r = await publishIgStoryTool.handler({ tipo: 'imagen', url: 'https://canva.com/a.png', dry_run: true }, { db, user });
    expect(r.data.preview_url).toContain('fl_layer_apply');
    expect(publishStory).not.toHaveBeenCalled();
  });

  it('publica el preview_url del dry_run con origen mcp', async () => {
    const { db } = createFakeDb();
    const preview = 'https://res.cloudinary.com/c/image/upload/x/v1/a.png';
    const r = await publishIgStoryTool.handler({ tipo: 'imagen', preview_url: preview }, { db, user });
    expect(publishStory).toHaveBeenCalledWith({ db, tipo: 'imagen', mediaUrl: preview, origen: 'mcp' });
    expect(r.data).toMatchObject({ publicada: true, storyId: 'st1' });
  });

  it('preview_url que no es de Cloudinary: error', async () => {
    const { db } = createFakeDb();
    await expect(publishIgStoryTool.handler({ tipo: 'imagen', preview_url: 'https://evil.com/a.jpg' }, { db, user }))
      .rejects.toThrow(/preview_url/);
  });

  it('imagen sin url: error de validación', async () => {
    const { db } = createFakeDb();
    await expect(publishIgStoryTool.handler({ tipo: 'imagen', dry_run: true }, { db, user })).rejects.toThrow(/imagen/);
  });
});
