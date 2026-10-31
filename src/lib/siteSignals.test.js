import { describe, it, expect } from 'vitest';
import { detectAgencia, detectAnuncios, detectPlataforma, señalesComerciales } from './siteSignals.js';

const SITE = 'https://www.ferreteriauno.com.ar';
const pie = (inner) => `<html><body><main>Bienvenidos</main><footer>${inner}</footer></body></html>`;

describe('detectAgencia', () => {
  it('rótulo + link a otro dominio → nombre, url y confianza alta', () => {
    const a = detectAgencia(pie('© 2026 Ferretería Uno | Desarrollado por <a href="https://www.estudiopixel.com.ar">Estudio Pixel</a>'), SITE);
    expect(a).toEqual({ nombre: 'Estudio Pixel', url: 'https://www.estudiopixel.com.ar', confianza: 0.9 });
  });

  it('rótulo en inglés con tags en el medio', () => {
    const a = detectAgencia(pie('<p>Website by <strong><a href="https://acme.dev/">ACME <span>Studio</span></a></strong></p>'), SITE);
    expect(a).toMatchObject({ nombre: 'ACME Studio', confianza: 0.9 });
  });

  it('rótulo sin link → nombre del texto, confianza media', () => {
    const a = detectAgencia(pie('<p>Diseño web: Lucía Gómez Diseño</p><p>Neuquén</p>'), SITE);
    expect(a).toEqual({ nombre: 'Lucía Gómez Diseño', url: null, confianza: 0.75 });
  });

  it('descarta plataformas ("Powered by WordPress", "Hecho con Tiendanube")', () => {
    expect(detectAgencia(pie('Powered by <a href="https://wordpress.org">WordPress</a>'), SITE)).toBeNull();
    expect(detectAgencia(pie('Sitio web por <a href="https://www.tiendanube.com">Tiendanube</a>'), SITE)).toBeNull();
  });

  it('descarta links al propio sitio y sigue buscando', () => {
    const html = pie('Desarrollado por <a href="https://ferreteriauno.com.ar/nosotros">nosotros</a> · Diseño web por <a href="https://otra.com">Otra</a>');
    expect(detectAgencia(html, SITE)).toMatchObject({ nombre: 'Otra', url: 'https://otra.com' });
  });

  it('crédito con link a Instagram: nombre sin URL', () => {
    const a = detectAgencia(pie('Diseñado por <a href="https://instagram.com/pepeweb">@pepeweb</a>'), SITE);
    expect(a).toEqual({ nombre: '@pepeweb', url: null, confianza: 0.75 });
  });

  it('no matchea un rótulo dentro de otra palabra ni toma texto que empieza en minúscula', () => {
    expect(detectAgencia(pie('<p>El sitio del propietario se publicará aquí en breve</p>'), SITE)).toBeNull();
    expect(detectAgencia(pie('<p>Hecho por nosotros con cariño</p>'), SITE)).toBeNull();
  });

  it('sin crédito → null', () => {
    expect(detectAgencia(pie('© 2026 Todos los derechos reservados'), SITE)).toBeNull();
    expect(detectAgencia('', SITE)).toBeNull();
  });
});

describe('detectAnuncios', () => {
  it('píxel de Meta', () => {
    expect(detectAnuncios(`<script>!function(f,b,e,v,n,t,s){}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','123');</script>`))
      .toEqual({ meta: true, google: false });
  });
  it('conversión de Google Ads', () => {
    expect(detectAnuncios(`<script async src="https://www.googletagmanager.com/gtag/js?id=AW-123456789"></script><script>gtag('config','AW-123456789')</script>`))
      .toEqual({ meta: false, google: true });
  });
  it('solo Analytics no cuenta como anuncios', () => {
    expect(detectAnuncios(`<script>gtag('config','G-ABC123')</script>`)).toEqual({ meta: false, google: false });
  });
});

describe('detectPlataforma', () => {
  it('reconoce WordPress, Wix y Tiendanube', () => {
    expect(detectPlataforma('<link href="/wp-content/themes/x/style.css">')).toBe('WordPress');
    expect(detectPlataforma('<img src="https://static.wixstatic.com/media/a.jpg">')).toBe('Wix');
    expect(detectPlataforma('<script src="https://d26lpennugtm8s.cloudfront.net/stores/1/x.js">')).toBe('Tiendanube');
    expect(detectPlataforma('<html></html>')).toBeNull();
  });
});

describe('señalesComerciales', () => {
  it('arma frases sin nombrar a la agencia', () => {
    expect(señalesComerciales({ anuncios: { meta: true, google: false }, plataforma: 'Wix', agencia: { nombre: 'X' } }))
      .toEqual(['pagan anuncios en Facebook/Instagram', 'el sitio está hecho en Wix']);
    expect(señalesComerciales({})).toEqual([]);
  });
});
