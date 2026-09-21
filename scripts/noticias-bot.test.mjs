import { describe, it, expect, vi } from 'vitest';
import { isWithinSchedule, nowArgentina, toInstagramSafeUrl, waitForImage, fetchPhotoDataUri, fitBody, MAX_BODY_CHARS, networksFor, itemsPerRunFor } from './noticias-bot.mjs';

// Enero de 1970: 1=jue, 2=vie, 3=sab, 4=dom, 5=lun, 6=mar, 7=mie.
// Se usan estas fechas fijas para tener un getUTCDay() conocido sin ambigüedad.
const DAY_TO_JAN_1970 = { 0: 4, 1: 5, 2: 6, 3: 7, 4: 1, 5: 2, 6: 3 }; // getUTCDay() -> día de enero

function arNowFor(getUTCDayValue, hour) {
  return new Date(Date.UTC(1970, 0, DAY_TO_JAN_1970[getUTCDayValue], hour));
}

const FULL_WEEK = {
  dom: { enabled: true, startHour: 8, endHour: 23 },
  lun: { enabled: true, startHour: 8, endHour: 23 },
  mar: { enabled: true, startHour: 8, endHour: 23 },
  mie: { enabled: true, startHour: 8, endHour: 23 },
  jue: { enabled: true, startHour: 8, endHour: 23 },
  vie: { enabled: true, startHour: 8, endHour: 23 },
  sab: { enabled: false, startHour: null, endHour: null },
};

describe('nowArgentina', () => {
  it('resta 3 horas (Argentina es UTC-3 fijo)', () => {
    const utcNoon = new Date(Date.UTC(2026, 5, 15, 12, 0, 0));
    expect(nowArgentina(utcNoon).getUTCHours()).toBe(9);
  });
});

describe('isWithinSchedule', () => {
  it('sin schedule configurado, siempre permite publicar', () => {
    expect(isWithinSchedule(null, arNowFor(6, 3))).toBe(true); // sábado 3am
  });

  it('día deshabilitado no permite publicar en ninguna hora', () => {
    expect(isWithinSchedule(FULL_WEEK, arNowFor(6, 12))).toBe(false); // sábado 12pm
  });

  it('hora dentro del rango permite publicar', () => {
    expect(isWithinSchedule(FULL_WEEK, arNowFor(1, 10))).toBe(true); // lunes 10am
  });

  it('hora antes del rango no permite publicar', () => {
    expect(isWithinSchedule(FULL_WEEK, arNowFor(1, 7))).toBe(false); // lunes 7am
  });

  it('startHour es inclusivo', () => {
    expect(isWithinSchedule(FULL_WEEK, arNowFor(1, 8))).toBe(true); // lunes 8am justo
  });

  it('endHour es exclusivo', () => {
    expect(isWithinSchedule(FULL_WEEK, arNowFor(1, 23))).toBe(false); // lunes 23hs justo
  });

  it('día habilitado sin startHour/endHour permite todo el día', () => {
    const schedule = { ...FULL_WEEK, mar: { enabled: true, startHour: null, endHour: null } };
    expect(isWithinSchedule(schedule, arNowFor(2, 2))).toBe(true); // martes 2am
  });
});

describe('toInstagramSafeUrl', () => {
  const base = 'https://res.cloudinary.com/dlshym1te/image/upload/v1789776136/zy8z9vid0sbfzjjje3nz';

  it('fuerza JPG (sin recortar) aunque la imagen subida sea WebP', () => {
    expect(toInstagramSafeUrl(`${base}.webp`)).toBe(
      'https://res.cloudinary.com/dlshym1te/image/upload/f_jpg,q_auto/v1789776136/zy8z9vid0sbfzjjje3nz.webp',
    );
  });

  it('funciona igual con PNG', () => {
    expect(toInstagramSafeUrl(`${base}.png`)).toContain('/image/upload/f_jpg,q_auto/v1789776136/');
    // sin recorte: la tarjeta ya sale en 4:5 y c_fill la deformaría
    expect(toInstagramSafeUrl(`${base}.png`)).not.toContain('c_fill');
  });
});

describe('itemsPerRunFor', () => {
  it('usa el tope del tópico cuando es un entero válido', () => {
    expect(itemsPerRunFor({ maxPorCorrida: 1 })).toBe(1);
    expect(itemsPerRunFor({ maxPorCorrida: 3 })).toBe(3);
  });

  it('sin valor (tópicos viejos) usa el default de 2', () => {
    expect(itemsPerRunFor({})).toBe(2);
    expect(itemsPerRunFor(undefined)).toBe(2);
  });

  it('valores inválidos caen en el default y nunca superan el máximo de la corrida (5)', () => {
    expect(itemsPerRunFor({ maxPorCorrida: 0 })).toBe(2);
    expect(itemsPerRunFor({ maxPorCorrida: -3 })).toBe(2);
    expect(itemsPerRunFor({ maxPorCorrida: 1.5 })).toBe(2);
    expect(itemsPerRunFor({ maxPorCorrida: 'x' })).toBe(2);
    expect(itemsPerRunFor({ maxPorCorrida: 50 })).toBe(5);
  });
});

describe('networksFor', () => {
  it('fb_ig publica en Facebook e Instagram, sin LinkedIn', () => {
    expect(networksFor('fb_ig')).toEqual({ facebook: true, instagram: true, linkedin: false });
  });

  it('linkedin publica SOLO en LinkedIn', () => {
    expect(networksFor('linkedin')).toEqual({ facebook: false, instagram: false, linkedin: true });
  });

  it('todas publica en las tres', () => {
    expect(networksFor('todas')).toEqual({ facebook: true, instagram: true, linkedin: true });
  });

  it('un tópico viejo (sin destino) o con un valor raro cae en Facebook + Instagram, como hasta ahora', () => {
    expect(networksFor(undefined)).toEqual({ facebook: true, instagram: true, linkedin: false });
    expect(networksFor('twitter')).toEqual({ facebook: true, instagram: true, linkedin: false });
  });

  it('devuelve una copia: modificarla no altera las próximas notas', () => {
    networksFor('linkedin').linkedin = false;
    expect(networksFor('linkedin').linkedin).toBe(true);
  });
});

describe('fitBody', () => {
  it('el tope de las notas es de 500 caracteres', () => {
    expect(MAX_BODY_CHARS).toBe(500);
    expect(fitBody('palabra. '.repeat(200)).length).toBeLessThanOrEqual(500);
  });

  it('deja intacto un body que entra', () => {
    expect(fitBody('Un párrafo.\nOtro párrafo.')).toBe('Un párrafo.\nOtro párrafo.');
  });

  it('el texto que va a Make (body + link) queda por debajo del límite de 2200 de Instagram', () => {
    const long = ('Una oración de relleno bastante larga para probar. '.repeat(10) + '\n').repeat(8);
    const out = fitBody(long);
    const enviado = `${out}\n\nLeé la nota completa: https://marianoaliandri.com.ar/noticias/${'x'.repeat(20)}/`;
    expect(out.length).toBeLessThanOrEqual(MAX_BODY_CHARS);
    expect(enviado.length).toBeLessThan(2200);
  });

  it('prefiere cortar en un límite de párrafo', () => {
    const p1 = 'a'.repeat(60) + '.';
    const p2 = 'b'.repeat(60) + '.';
    expect(fitBody(`${p1}\n${p2}\n${'c'.repeat(200)}`, 150)).toBe(`${p1}\n${p2}`);
  });

  it('si no hay párrafo cerca, corta en un fin de oración', () => {
    const s = 'Primera oración completa. Segunda oración completa. ' + 'x'.repeat(200);
    expect(fitBody(s, 80)).toBe('Primera oración completa. Segunda oración completa.');
  });

  it('sin puntuación, corta en espacio y agrega puntos suspensivos', () => {
    const out = fitBody('palabra '.repeat(50), 60);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(61);
    expect(out).not.toMatch(/\s…$/);
  });

  it('tolera null/undefined', () => {
    expect(fitBody(null)).toBe('');
    expect(fitBody(undefined)).toBe('');
  });
});

describe('fetchPhotoDataUri', () => {
  const okResponse = (type, bytes = [1, 2, 3, 4]) => ({
    ok: true,
    headers: { get: () => type },
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  });
  const photo = { url: 'https://medio.com/foto.jpg', width: 1200, height: 630 };

  it('devuelve un data URI base64 para un JPEG válido', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('image/jpeg'));
    await expect(fetchPhotoDataUri(photo, { fetchImpl })).resolves.toBe('data:image/jpeg;base64,AQIDBA==');
  });

  it('descarga con User-Agent de navegador y sin Accept (algunos diarios dan 403 o AVIF si no)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('image/jpeg'));
    await fetchPhotoDataUri(photo, { fetchImpl });
    const { headers } = fetchImpl.mock.calls[0][1];
    expect(headers['User-Agent']).toMatch(/^Mozilla\/5\.0/);
    expect(headers.Accept).toBeUndefined();
  });

  it('ignora el charset del content-type', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('image/png; charset=binary'));
    await expect(fetchPhotoDataUri(photo, { fetchImpl })).resolves.toMatch(/^data:image\/png;base64,/);
  });

  it('devuelve null sin foto, o si es más angosta que 600px (sin siquiera descargarla)', async () => {
    const fetchImpl = vi.fn();
    await expect(fetchPhotoDataUri(null, { fetchImpl })).resolves.toBeNull();
    await expect(fetchPhotoDataUri({ url: 'https://x/y.jpg', width: 300 }, { fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('acepta una foto sin dimensiones conocidas', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('image/jpeg'));
    await expect(fetchPhotoDataUri({ url: 'https://x/y.jpg' }, { fetchImpl })).resolves.toMatch(/^data:image\/jpeg/);
  });

  it('devuelve null si no es imagen, la respuesta falla, o hay error de red', async () => {
    await expect(fetchPhotoDataUri(photo, { fetchImpl: vi.fn().mockResolvedValue(okResponse('text/html')) })).resolves.toBeNull();
    await expect(fetchPhotoDataUri(photo, { fetchImpl: vi.fn().mockResolvedValue({ ok: false, headers: { get: () => 'image/jpeg' } }) })).resolves.toBeNull();
    await expect(fetchPhotoDataUri(photo, { fetchImpl: vi.fn().mockRejectedValue(new Error('timeout')) })).resolves.toBeNull();
  });

  it('devuelve null si la foto está vacía', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('image/jpeg', []));
    await expect(fetchPhotoDataUri(photo, { fetchImpl })).resolves.toBeNull();
  });
});

describe('waitForImage', () => {
  const img = { ok: true, status: 200, headers: { get: () => 'image/jpeg' } };
  const notReady = { ok: false, status: 423, headers: { get: () => 'text/plain' } };
  const html = { ok: true, status: 200, headers: { get: () => 'text/html' } };

  it('devuelve true apenas la URL responde con una imagen', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(img);
    expect(await waitForImage('https://x/a.jpg', { fetchImpl, delayMs: 0 })).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reintenta mientras Cloudinary todavía genera la transformación', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(notReady).mockResolvedValueOnce(html).mockResolvedValueOnce(img);
    expect(await waitForImage('https://x/a.jpg', { fetchImpl, delayMs: 0 })).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('reintenta si el fetch tira un error de red', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(img);
    expect(await waitForImage('https://x/a.jpg', { fetchImpl, delayMs: 0 })).toBe(true);
  });

  it('devuelve false si nunca responde una imagen', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(notReady);
    expect(await waitForImage('https://x/a.jpg', { fetchImpl, retries: 3, delayMs: 0 })).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
