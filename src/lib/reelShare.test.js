import { describe, it, expect, vi } from 'vitest';
import { createFakeDb } from '@/test/fakeDb';
import { reelDownloadUrl, whatsappShareUrl } from './reelShare';

vi.mock('@/lib/alert', () => ({ sendAlert: vi.fn(async () => {}) }));
const { publicarReel } = await import('./reelPublish');

const VIDEO = 'https://res.cloudinary.com/x/video/upload/v1/reels/abc.mp4';

describe('compartir reels', () => {
  it('descarga: fl_attachment con un nombre limpio', () => {
    expect(reelDownloadUrl(VIDEO, 'Revisé 415 webs: Neuquén!')).toBe('https://res.cloudinary.com/x/video/upload/fl_attachment:revise_415_webs_neuquen/v1/reels/abc.mp4');
    expect(reelDownloadUrl('https://otro.com/v.mp4')).toBe('https://otro.com/v.mp4');
  });

  it('WhatsApp: el gancho del caption + el link al video', () => {
    const u = new URL(whatsappShareUrl('\nRevisé 415 webs\n\nMás texto', VIDEO));
    expect(u.searchParams.get('text')).toBe(`Revisé 415 webs\n\n${VIDEO}`);
  });
});

describe('publicar reels', () => {
  it('solo publica donde todavía no salió y guarda cada red por separado', async () => {
    const { db } = createFakeDb({ 'reels/r1': { videoUrl: VIDEO, caption: 'c', titulo: 't', redes: { instagram: { ok: true, id: 'ig1' } } } });
    const ig = vi.fn(async () => 'ig2');
    const fb = vi.fn(async () => { throw new Error('sin pages_manage_posts'); });
    const li = vi.fn(async () => 'urn:li:share:1');
    const r = await publicarReel(db, 'r1', { ig, fb, li });
    expect(ig).not.toHaveBeenCalled();
    expect(r.redes).toMatchObject({ instagram: { ok: true, id: 'ig1' }, facebook: { ok: false }, linkedin: { ok: true, id: 'urn:li:share:1' } });
    expect(r.error).toBe('Facebook: sin pages_manage_posts');

    const solo = await publicarReel(db, 'r1', { redes: ['facebook'], ig, fb: async () => 'fb1', li });
    expect(solo.redes.facebook).toEqual({ ok: true, id: 'fb1' });
    expect(li).toHaveBeenCalledTimes(1);
  });
});
