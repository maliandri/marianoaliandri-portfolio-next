import { describe, it, expect, vi } from 'vitest';
import { igCredsFromEnv, publishIgStory } from './igStoryClient.mjs';

const creds = { accessToken: 'tok', igUserId: '178' };
const json = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });

describe('igCredsFromEnv', () => {
  it('devuelve null si falta el token o el id', () => {
    expect(igCredsFromEnv({ IG_ACCESS_TOKEN: 'a' })).toBeNull();
    expect(igCredsFromEnv({ IG_USER_ID: '1' })).toBeNull();
  });
  it('devuelve las dos credenciales si están', () => {
    expect(igCredsFromEnv({ IG_ACCESS_TOKEN: 'a', IG_USER_ID: '1' })).toEqual({ accessToken: 'a', igUserId: '1' });
  });
});

describe('publishIgStory', () => {
  it('crea el contenedor STORIES, espera FINISHED y publica', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ id: 'c1' }))
      .mockResolvedValueOnce(json({ status_code: 'IN_PROGRESS' }))
      .mockResolvedValueOnce(json({ status_code: 'FINISHED' }))
      .mockResolvedValueOnce(json({ id: 'story1' }));
    const id = await publishIgStory('https://x/img.jpg', { creds, fetchImpl, delayMs: 0 });
    expect(id).toBe('story1');

    const [createUrl, createOpts] = fetchImpl.mock.calls[0];
    expect(createUrl).toMatch(/\/178\/media$/);
    const body = new URLSearchParams(createOpts.body);
    expect(body.get('media_type')).toBe('STORIES');
    expect(body.get('image_url')).toBe('https://x/img.jpg');
    expect(body.get('access_token')).toBe('tok');

    const [publishUrl, publishOpts] = fetchImpl.mock.calls[3];
    expect(publishUrl).toMatch(/\/178\/media_publish$/);
    expect(new URLSearchParams(publishOpts.body).get('creation_id')).toBe('c1');
  });

  it('propaga el error de la Graph API con su código', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({ error: { code: 190, message: 'token vencido' } }, false, 400));
    await expect(publishIgStory('https://x/img.jpg', { creds, fetchImpl })).rejects.toThrow('Instagram 400 (190): token vencido');
  });

  it('falla si el contenedor queda en ERROR, sin publicar', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ id: 'c1' }))
      .mockResolvedValueOnce(json({ status_code: 'ERROR' }));
    await expect(publishIgStory('https://x/img.jpg', { creds, fetchImpl, delayMs: 0 })).rejects.toThrow('ERROR');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('sin credenciales no llama a la API', async () => {
    const fetchImpl = vi.fn();
    await expect(publishIgStory('https://x/img.jpg', { creds: null, fetchImpl })).rejects.toThrow('IG_ACCESS_TOKEN');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
