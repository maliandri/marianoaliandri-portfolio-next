import { describe, it, expect } from 'vitest';
import { createFakeDb } from '@/test/fakeDb';
import { linkedinVersion, littleText, getLinkedInAuth, publishDocumentPost, publishVideoPost, LinkedInError } from './linkedinClient';
import { checkLinkedIn } from './healthCheck';

describe('linkedinClient', () => {
  it('versión de la API: el mes de hace dos meses', () => {
    expect(linkedinVersion(new Date('2026-10-28T00:00:00Z'))).toBe('202608');
    expect(linkedinVersion(new Date('2026-01-15T00:00:00Z'))).toBe('202511');
  });

  it('little text: escapa reservados y convierte hashtags', () => {
    expect(littleText('Hola (Neuquén) #AltoValle y #NegociosLocales')).toBe(
      'Hola \\(Neuquén\\) {hashtag|\\#|AltoValle} y {hashtag|\\#|NegociosLocales}',
    );
    expect(littleText('a_b *c* @x')).toBe('a\\_b \\*c\\* \\@x');
  });

  it('conexión: falta, vencida o válida', async () => {
    await expect(getLinkedInAuth(createFakeDb({}).db)).rejects.toThrow(/no está conectado/);
    const vencida = createFakeDb({ 'integrations/linkedin': { accessToken: 't', profileId: 'p', expiresAt: 1000 } }).db;
    await expect(getLinkedInAuth(vencida, 2000)).rejects.toBeInstanceOf(LinkedInError);
    const ok = createFakeDb({ 'integrations/linkedin': { accessToken: 't', profileId: 'abc', expiresAt: 5000 } }).db;
    expect(await getLinkedInAuth(ok, 2000)).toMatchObject({ token: 't', author: 'urn:li:person:abc' });
  });

  it('publica: inicia la subida, sube el PDF, espera AVAILABLE y crea el post', async () => {
    const calls = [];
    let polls = 0;
    const fetchImpl = async (url, opts) => {
      calls.push({ url, method: opts.method || 'GET', body: opts.body });
      const json = (data, headers = {}) => ({ ok: true, json: async () => data, text: async () => '', headers: new Map(Object.entries(headers)) });
      if (url.includes('initializeUpload')) return json({ value: { uploadUrl: 'https://upload.li/x', document: 'urn:li:document:D1' } });
      if (url === 'https://upload.li/x') return json({});
      if (url.includes('/documents/')) return json({ status: ++polls < 2 ? 'PROCESSING' : 'AVAILABLE' });
      if (url.endsWith('/posts')) return json({}, { 'x-restli-id': 'urn:li:share:9' });
      throw new Error(url);
    };
    const id = await publishDocumentPost({
      token: 't', author: 'urn:li:person:abc', pdf: Buffer.from('%PDF'), title: 'Informe', text: 'Hola #Neuquén',
      fetchImpl, now: new Date('2026-10-28'), wait: async () => {},
    });
    expect(id).toBe('urn:li:share:9');
    expect(calls.map(c => c.method)).toEqual(['POST', 'PUT', 'GET', 'GET', 'POST']);
    const post = JSON.parse(calls.at(-1).body);
    expect(post).toMatchObject({ author: 'urn:li:person:abc', commentary: 'Hola {hashtag|\\#|Neuquén}', content: { media: { id: 'urn:li:document:D1', title: 'Informe' } } });
  });

  it('video: sube cada parte, finaliza con los ETag, espera AVAILABLE y publica', async () => {
    const calls = [];
    let polls = 0;
    const fetchImpl = async (url, opts) => {
      calls.push({ url, method: opts.method || 'GET', body: opts.body });
      const json = (data, headers = {}) => ({ ok: true, json: async () => data, text: async () => '', headers: new Map(Object.entries(headers)) });
      if (url.includes('initializeUpload')) {
        return json({ value: { video: 'urn:li:video:V1', uploadToken: 'tk', uploadInstructions: [
          { uploadUrl: 'https://up.li/1', firstByte: 0, lastByte: 3 }, { uploadUrl: 'https://up.li/2', firstByte: 4, lastByte: 5 },
        ] } });
      }
      if (url.startsWith('https://up.li/')) return json({}, { etag: `e${url.at(-1)}` });
      if (url.includes('finalizeUpload')) return json({});
      if (url.includes('/videos/')) return json({ status: ++polls < 3 ? 'PROCESSING' : 'AVAILABLE' });
      if (url.endsWith('/posts')) return json({}, { 'x-restli-id': 'urn:li:share:7' });
      throw new Error(url);
    };
    const id = await publishVideoPost({
      token: 't', author: 'urn:li:person:abc', video: Buffer.from('abcdef'), title: 'Reel', text: 'Hola',
      fetchImpl, now: new Date('2026-10-28'), wait: async () => {},
    });
    expect(id).toBe('urn:li:share:7');
    expect(calls.filter(c => c.url.startsWith('https://up.li/')).map(c => c.body.toString())).toEqual(['abcd', 'ef']);
    expect(JSON.parse(calls.find(c => c.url.includes('finalizeUpload')).body).finalizeUploadRequest)
      .toEqual({ video: 'urn:li:video:V1', uploadToken: 'tk', uploadedPartIds: ['e1', 'e2'] });
    expect(JSON.parse(calls.at(-1).body).content.media.id).toBe('urn:li:video:V1');
  });

  it('error de LinkedIn sale con el código', async () => {
    const fetchImpl = async () => ({ ok: false, status: 401, text: async () => 'Invalid access token' });
    await expect(publishDocumentPost({ token: 't', author: 'a', pdf: Buffer.from(''), title: 't', text: 'x', fetchImpl }))
      .rejects.toThrow('LinkedIn 401: Invalid access token');
  });

  it('chequeo diario: avisa si no está conectado, si vence pronto o si venció', async () => {
    expect((await checkLinkedIn({ expiry: async () => null })).problems[0]).toMatch(/no está conectado/);
    expect((await checkLinkedIn({ expiry: async () => ({ expiresAt: Date.UTC(2026, 3, 18), dias: -190 }) })).problems[0]).toMatch(/venció \(2026-04-18\)/);
    expect((await checkLinkedIn({ expiry: async () => ({ expiresAt: Date.UTC(2026, 10, 1), dias: 3 }) })).problems[0]).toMatch(/vence en 3 días/);
    expect((await checkLinkedIn({ expiry: async () => ({ expiresAt: 1, dias: 40 }) })).ok).toBe(true);
  });
});
