import { describe, it, expect } from 'vitest';
import { buildMailBatches, cleanEmails, MAX_MAILTO_LENGTH } from './mailBatches.js';

const mails = (n) => Array.from({ length: n }, (_, i) => `contacto${i}@negocio${i}.com.ar`);
const bccOf = (url) => decodeURIComponent(new URL(url.replace('mailto:', 'http://x/')).searchParams.get('bcc') || '');

describe('cleanEmails', () => {
  it('deduplica sin distinguir mayúsculas y saca inválidos/vacíos', () => {
    expect(cleanEmails(['A@b.com', 'a@B.com', ' ', '', null, undefined, 'foo@', 'sin-arroba', 'ok@x.io']))
      .toEqual(['a@b.com', 'ok@x.io']);
  });
});

describe('buildMailBatches', () => {
  it('sin emails devuelve []', () => {
    expect(buildMailBatches([], { subject: 's', body: 'b' })).toEqual([]);
    expect(buildMailBatches(['basura'], {})).toEqual([]);
  });

  it('pocas casillas caben en una sola tanda, en CCO y con "Para" propio', () => {
    const batches = buildMailBatches(mails(3), { subject: 'Hola', body: 'Texto', to: 'yo@mio.com' });
    expect(batches).toHaveLength(1);
    expect(batches[0].url.startsWith('mailto:yo@mio.com?')).toBe(true);
    expect(bccOf(batches[0].url)).toBe(mails(3).join(','));
    expect(batches[0].emails).toEqual(mails(3));
  });

  it('ninguna tanda supera el límite de URL', () => {
    const batches = buildMailBatches(mails(300), { subject: 'Asunto de prueba', body: 'Cuerpo '.repeat(20), to: 'yo@mio.com' });
    expect(batches.length).toBeGreaterThan(1);
    for (const b of batches) expect(b.url.length).toBeLessThanOrEqual(MAX_MAILTO_LENGTH);
  });

  it('no pierde ni repite ninguna casilla entre tandas', () => {
    const input = mails(300);
    const batches = buildMailBatches(input, { subject: 's', body: 'b', to: 'yo@mio.com' });
    const all = batches.flatMap(b => b.emails);
    expect(all).toEqual(input);
    expect(new Set(all).size).toBe(input.length);
  });

  it('con un cuerpo enorme igual sale cada casilla, una por tanda, sin perder ninguna', () => {
    const input = mails(4);
    const batches = buildMailBatches(input, { subject: 's', body: 'x'.repeat(5000), to: 'yo@mio.com' });
    expect(batches.map(b => b.emails)).toEqual(input.map(e => [e]));
  });

  it('un cuerpo largo deja menos casillas por tanda que uno corto', () => {
    const input = mails(200);
    const corto = buildMailBatches(input, { subject: 's', body: 'b' });
    const largo = buildMailBatches(input, { subject: 's', body: 'b'.repeat(800) });
    expect(largo.length).toBeGreaterThan(corto.length);
  });

  it('codifica asunto y cuerpo (tildes, saltos de línea, &)', () => {
    const [b] = buildMailBatches(['a@b.com'], { subject: 'Oferta & más', body: 'Línea 1\nLínea 2' });
    const params = new URL(b.url.replace('mailto:', 'http://x/')).searchParams;
    expect(params.get('subject')).toBe('Oferta & más');
    expect(params.get('body')).toBe('Línea 1\r\nLínea 2'); // CRLF, lo que esperan los gestores
  });

  it('sin "to" arma mailto: con destinatario vacío', () => {
    const [b] = buildMailBatches(['a@b.com'], {});
    expect(b.url.startsWith('mailto:?')).toBe(true);
  });
});
