import { describe, it, expect, afterEach } from 'vitest';
import { publicarHistorias } from '@/lib/contenidoRun';

const U = n => `https://res.cloudinary.com/demo/image/upload/v1/contenido/abc/${n}.png`;

describe('publicarHistorias', () => {
  afterEach(() => { delete process.env.IG_ACCESS_TOKEN; delete process.env.IG_USER_ID; });

  it('sin credenciales de Instagram no publica nada', async () => {
    const r = await publicarHistorias(null, [U(1)], { publish: async () => { throw new Error('no debería'); } });
    expect(r.ok).toBe(false);
  });

  it('publica portada y cierre, y un fallo no frena a la otra', async () => {
    process.env.IG_ACCESS_TOKEN = 't'; process.env.IG_USER_ID = 'u';
    const urls = [];
    const r = await publicarHistorias(null, [U(1), U(2), U(3)], {
      publish: async ({ mediaUrl }) => { urls.push(mediaUrl); if (urls.length === 1) throw new Error('boom'); return { storyId: 'S2' }; },
    });
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('/1.png');
    expect(urls[1]).toContain('/3.png');
    expect(r).toMatchObject({ ok: true, ids: ['S2'], error: 'boom' });
  });
});
