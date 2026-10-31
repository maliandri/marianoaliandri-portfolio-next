import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/geminiClient', () => ({ callGemini: vi.fn() }));
import { callGemini } from '@/lib/geminiClient';
import { validateGeneratedEmail, buildBizEmailDraft, renderBizEmailHtml } from './bizEmail';

const nombre = 'Panadería La Espiga';
const bueno = `Hola equipo de ${nombre},\n\n` + 'Soy Mariano Aliandri y revisé su sitio web. '.repeat(10) +
  '\n\nSi les interesa, respondan este mail.\n\nMariano Aliandri';

describe('validateGeneratedEmail', () => {
  it('acepta un texto bueno', () => expect(validateGeneratedEmail(bueno, nombre)).toBe(true));
  it('rechaza si no nombra al negocio', () => expect(validateGeneratedEmail(bueno.replaceAll(nombre, 'ustedes'), nombre)).toBe(false));
  it('rechaza marcadores sin completar', () => {
    expect(validateGeneratedEmail(bueno + ' [Nombre]', nombre)).toBe(false);
    expect(validateGeneratedEmail(bueno + ' {{x}}', nombre)).toBe(false);
    expect(validateGeneratedEmail(bueno + ' XXX', nombre)).toBe(false);
  });
  it('rechaza links que no son del sitio ni de wa.me', () => {
    expect(validateGeneratedEmail(bueno + ' https://evil.com/x', nombre)).toBe(false);
    expect(validateGeneratedEmail(bueno + ' https://marianoaliandri.com.ar/presupuesto y https://wa.me/549', nombre)).toBe(true);
  });
  it('rechaza textos muy cortos o muy largos', () => {
    expect(validateGeneratedEmail(`Hola ${nombre}`, nombre)).toBe(false);
    expect(validateGeneratedEmail(bueno + 'x'.repeat(2600), nombre)).toBe(false);
  });
});

describe('buildBizEmailDraft', () => {
  beforeEach(() => {
    callGemini.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({}) }));
  });
  const neg = { nombre, siteUrl: 'https://espiga.com', seoScore: 35, ciudad: 'Neuquén', tipo: 'Panadería' };

  it('usa la plantilla si Gemini devuelve un texto inválido', async () => {
    callGemini.mockResolvedValue('Hola [Nombre del negocio]');
    const d = await buildBizEmailDraft(neg, { providedShot: null });
    expect(d.source).toBe('template');
    expect(d.emailText).toContain(nombre);
    expect(d.subject).toBe(`Análisis SEO de ${nombre} — oportunidades de mejora`);
  });

  it('usa el texto de Gemini si pasa la validación', async () => {
    callGemini.mockResolvedValue(bueno);
    const d = await buildBizEmailDraft(neg, { providedShot: null });
    expect(d.source).toBe('gemini');
    expect(d.emailText).toBe(bueno);
  });

  it('si pagan anuncios, se lo pasa a Gemini y lo usa la plantilla', async () => {
    callGemini.mockResolvedValue('inválido');
    const d = await buildBizEmailDraft({ ...neg, anuncios: { meta: true, google: false } }, { providedShot: null });
    expect(callGemini.mock.calls[0][0]).toContain('anuncios de Facebook/Instagram');
    expect(d.emailText).toContain('invierten en anuncios en Facebook/Instagram');
  });

  it('sin anuncios, el prompt no menciona pauta', async () => {
    callGemini.mockResolvedValue(bueno);
    await buildBizEmailDraft(neg, { providedShot: null });
    expect(callGemini.mock.calls[0][0]).not.toContain('Dato clave');
  });

  it('respeta el texto editado sin llamar a Gemini', async () => {
    const d = await buildBizEmailDraft(neg, { providedText: '  mi texto  ', providedShot: null });
    expect(d).toMatchObject({ source: 'edited', emailText: 'mi texto' });
    expect(callGemini).not.toHaveBeenCalled();
  });
});

describe('renderBizEmailHtml — escapa datos de terceros', () => {
  it('el nombre del negocio (Google Maps) y el texto no inyectan HTML', () => {
    const html = renderBizEmailHtml({
      nombre: 'Pana <a href="https://evil.com">x</a>', siteUrl: 'https://espiga.com/"><script>', seoScore: 35,
      emailText: 'Hola <img src=x onerror=alert(1)>', screenshotUrl: 'https://img.com/a.png', extraServices: [], unsubscribeUrl: null,
    });
    expect(html).not.toContain('<a href="https://evil.com">');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('"><script>');
    expect(html).toContain('Pana &lt;a href=');
  });
});

describe('renderBizEmailHtml', () => {
  it('incluye el link de baja en el pie', () => {
    const html = renderBizEmailHtml({
      nombre, siteUrl: 'https://espiga.com', seoScore: 35, emailText: 'hola', screenshotUrl: null,
      extraServices: [], unsubscribeUrl: 'https://marianoaliandri.com.ar/baja/?e=a&t=b',
    });
    expect(html).toContain('href="https://marianoaliandri.com.ar/baja/?e=a&amp;t=b"');
    expect(html).toContain('no querés recibir más');
  });
});
