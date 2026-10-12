// src/data/i18n/leadFinderPro.test.js
import { describe, it, expect } from 'vitest';
import { lfpT } from './leadFinderPro.js';

describe('lfpT panel', () => {
  it('ES y EN tienen las mismas claves', () => {
    const es = Object.keys(lfpT('es').panel).sort();
    const en = Object.keys(lfpT('en').panel).sort();
    expect(es.filter(k => !en.includes(k))).toEqual([]);
    expect(en.filter(k => !es.includes(k))).toEqual([]);
  });

  it('summary y progress arman el texto', () => {
    const t = lfpT('es').panel;
    expect(t.summary({ leads: 5, conWeb: 3, descartados: 1 })).toBe('5 leads · 3 con web · 2 por WhatsApp · 1 descartado');
    expect(t.progress({ ciudad: 'Neuquén', etiqueta: 'gomería', leads: 2, cantidad: 10, examinados: 4 })).toContain('2/10 leads');
  });
});
