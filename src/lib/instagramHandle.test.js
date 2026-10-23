import { describe, it, expect } from 'vitest';
import { extractInstagram, handleFromUrl } from './instagramHandle.js';

describe('extractInstagram', () => {
  it('saca el handle de un link al perfil', () => {
    expect(extractInstagram('<a href="https://www.instagram.com/Muebleria.Sur/">IG</a>')).toBe('muebleria.sur');
  });

  it('ignora posts, reels y rutas que no son perfiles', () => {
    const html = `<a href="https://instagram.com/p/Cx12/">post</a>
      <a href="https://www.instagram.com/reel/abc/">reel</a>
      <script src="https://www.instagram.com/embed.js"></script>`;
    expect(extractInstagram(html)).toBe(null);
  });

  it('lee links escapados dentro de JSON', () => {
    expect(extractInstagram('{"ig":"https:\\/\\/www.instagram.com\\/taller_norte"}')).toBe('taller_norte');
  });

  it('con varios perfiles gana el que más aparece (no el de la agencia del footer)', () => {
    const html = `instagram.com/negocio instagram.com/negocio/ <footer>instagram.com/agencia</footer>`;
    expect(extractInstagram(html)).toBe('negocio');
  });

  it('ignora cuentas de plataformas (página de wa.me, footer de Tiendanube)', () => {
    expect(extractInstagram('<a href="https://www.instagram.com/whatsapp">IG</a>')).toBe(null);
    expect(extractInstagram('instagram.com/tiendanube instagram.com/mitienda')).toBe('mitienda');
  });

  it('sin instagram devuelve null', () => {
    expect(extractInstagram('<a href="https://facebook.com/x">fb</a>')).toBe(null);
    expect(extractInstagram('')).toBe(null);
  });
});

describe('handleFromUrl', () => {
  it('perfil cargado como web en Google Maps', () => {
    expect(handleFromUrl('https://www.instagram.com/negocio?igsh=abc')).toBe('negocio');
    expect(handleFromUrl('https://m.instagram.com/negocio/')).toBe('negocio');
  });

  it('otra red o vacío → null', () => {
    expect(handleFromUrl('https://facebook.com/negocio')).toBe(null);
    expect(handleFromUrl(null)).toBe(null);
  });
});
