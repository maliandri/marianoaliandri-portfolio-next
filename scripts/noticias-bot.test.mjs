import { describe, it, expect } from 'vitest';
import { isWithinSchedule, nowArgentina, toInstagramSafeUrl } from './noticias-bot.mjs';

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

  it('fuerza JPG 1080x1080 aunque la imagen subida sea WebP', () => {
    expect(toInstagramSafeUrl(`${base}.webp`)).toBe(
      'https://res.cloudinary.com/dlshym1te/image/upload/c_fill,g_auto,w_1080,h_1080,f_jpg,q_auto/v1789776136/zy8z9vid0sbfzjjje3nz.webp',
    );
  });

  it('funciona igual con PNG', () => {
    expect(toInstagramSafeUrl(`${base}.png`)).toContain('/image/upload/c_fill,g_auto,w_1080,h_1080,f_jpg,q_auto/v1789776136/');
  });
});
