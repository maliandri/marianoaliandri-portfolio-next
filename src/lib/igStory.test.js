import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/igStoryClient.mjs', () => ({ publishIgStory: vi.fn() }));
vi.mock('@/lib/imageCheck', () => ({ imageIsReachable: vi.fn(async () => ({ ok: true, detail: '' })) }));

import { publishIgStory } from '../../scripts/igStoryClient.mjs';
import { imageIsReachable } from '@/lib/imageCheck';
import { storyImageUrl, storyVideoUrl, buildStoryMedia, publishStory } from './igStory.js';

const IMG = 'https://res.cloudinary.com/dlshym1te/image/upload/c_fill,ar_4:5,g_auto,w_1080/v1700/social/foto.png';
const VID = 'https://res.cloudinary.com/dlshym1te/video/upload/v1700/social/clip.mov';

describe('storyImageUrl / storyVideoUrl', () => {
  it('reemplaza la transformación 4:5 del admin por la de historia (9:16, fondo desenfocado, JPG)', () => {
    expect(storyImageUrl(IMG)).toBe(
      'https://res.cloudinary.com/dlshym1te/image/upload/c_fill,w_1080,h_1920,e_blur:2000/l_social:foto,c_fit,w_1080,h_1920/fl_layer_apply/f_jpg,q_auto/v1700/social/foto.png',
    );
  });
  it('video: MP4 H.264 9:16 recortado a 60 s', () => {
    expect(storyVideoUrl(VID)).toBe(
      'https://res.cloudinary.com/dlshym1te/video/upload/c_pad,w_1080,h_1920,b_black,du_60,vc_h264,ac_aac,f_mp4/v1700/social/clip.mp4',
    );
  });
  it('rechaza URLs que no son de Cloudinary o del tipo equivocado', () => {
    expect(storyImageUrl('https://evil.com/x.jpg')).toBeNull();
    expect(storyImageUrl(VID)).toBeNull();
    expect(storyVideoUrl(IMG)).toBeNull();
  });
});

describe('buildStoryMedia', () => {
  it('valida tipo y texto', async () => {
    expect((await buildStoryMedia({ tipo: 'otro' })).error).toMatch('tipo');
    expect((await buildStoryMedia({ tipo: 'texto', titulo: '  ' })).error).toMatch('texto');
    expect((await buildStoryMedia({ tipo: 'texto', titulo: 'x'.repeat(151) })).error).toMatch('150');
    expect((await buildStoryMedia({ tipo: 'imagen' })).error).toMatch('imagen');
  });
  it('imagen: devuelve la URL 9:16', async () => {
    expect(await buildStoryMedia({ tipo: 'imagen', mediaUrl: IMG })).toEqual({ tipo: 'imagen', mediaUrl: storyImageUrl(IMG) });
  });
});

describe('publishStory', () => {
  const fakeDb = () => {
    const docs = [];
    return { docs, collection: () => ({ add: async d => docs.push(d) }) };
  };
  beforeEach(() => vi.clearAllMocks());

  it('publica y registra el id en ig_stories', async () => {
    publishIgStory.mockResolvedValue('s1');
    const db = fakeDb();
    expect(await publishStory({ db, tipo: 'imagen', mediaUrl: 'https://res.cloudinary.com/a.jpg' })).toEqual({ storyId: 's1' });
    expect(publishIgStory).toHaveBeenCalledWith('https://res.cloudinary.com/a.jpg', { video: false });
    expect(db.docs[0]).toMatchObject({ tipo: 'imagen', storyId: 's1', error: null, origen: 'admin' });
  });

  it('si Instagram falla registra el error y lo propaga', async () => {
    publishIgStory.mockRejectedValue(new Error('Instagram 400 (190): token vencido'));
    const db = fakeDb();
    await expect(publishStory({ db, tipo: 'video', mediaUrl: 'https://res.cloudinary.com/v.mp4' })).rejects.toThrow('190');
    expect(publishIgStory).toHaveBeenCalledWith('https://res.cloudinary.com/v.mp4', { video: true });
    expect(imageIsReachable).not.toHaveBeenCalled();
    expect(db.docs[0]).toMatchObject({ storyId: null, error: 'Instagram 400 (190): token vencido' });
  });

  it('no publica si la imagen no está lista', async () => {
    imageIsReachable.mockResolvedValueOnce({ ok: false, detail: 'HTTP 404' });
    const db = fakeDb();
    await expect(publishStory({ db, tipo: 'imagen', mediaUrl: 'https://res.cloudinary.com/a.jpg' })).rejects.toThrow('404');
    expect(publishIgStory).not.toHaveBeenCalled();
    expect(db.docs[0].error).toMatch('404');
  });
});
