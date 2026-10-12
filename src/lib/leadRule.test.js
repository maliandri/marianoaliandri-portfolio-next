// src/lib/leadRule.test.js
import { describe, it, expect } from 'vitest';
import { clasificarLead } from './leadRule.js';

describe('clasificarLead', () => {
  it('con web propia es lead por web (y guarda el WhatsApp si hay celular)', () => {
    expect(clasificarLead({ hasWebsite: true, siteUrl: 'https://x.test', internationalPhone: '+54 9 299 541-4422' }))
      .toEqual({ esLead: true, canal: 'web', whatsapp: '5492995414422' });
    expect(clasificarLead({ hasWebsite: true, siteUrl: 'https://x.test' }))
      .toEqual({ esLead: true, canal: 'web', whatsapp: null });
  });

  it('sin web con celular argentino (+54 9) es lead por WhatsApp', () => {
    expect(clasificarLead({ hasWebsite: false, siteUrl: null, internationalPhone: '+54 9 299 541-4422', phone: '0299 15-541-4422' }))
      .toEqual({ esLead: true, canal: 'whatsapp', whatsapp: '5492995414422' });
  });

  it('sin web con fijo argentino se descarta', () => {
    expect(clasificarLead({ hasWebsite: false, internationalPhone: '+54 299 442-1234', phone: '0299 442-1234' }))
      .toEqual({ esLead: false, canal: null, whatsapp: null });
  });

  it('caché viejo sin internacional: usa el 15 del formato nacional', () => {
    expect(clasificarLead({ hasWebsite: false, phone: '0299 15-541-4422' }))
      .toEqual({ esLead: true, canal: 'whatsapp', whatsapp: '5492995414422' });
    expect(clasificarLead({ hasWebsite: false, phone: '011 15 4444-5555' }).whatsapp).toBe('5491144445555');
    expect(clasificarLead({ hasWebsite: false, phone: '0299 442-1234' }).esLead).toBe(false);
  });

  it('otro país con formato internacional: cualquier teléfono sirve', () => {
    expect(clasificarLead({ hasWebsite: false, internationalPhone: '+1 305-555-1234' }))
      .toEqual({ esLead: true, canal: 'whatsapp', whatsapp: '13055551234' });
  });

  it('otro país sin formato internacional (caché viejo) se descarta', () => {
    expect(clasificarLead({ hasWebsite: false, phone: '(305) 555-1234' }).esLead).toBe(false);
  });

  it('solo red social, o nada, se descarta', () => {
    expect(clasificarLead({ hasWebsite: false, siteUrl: null, socialUrl: 'https://instagram.com/x' }).esLead).toBe(false);
    expect(clasificarLead({}).esLead).toBe(false);
    expect(clasificarLead(null).esLead).toBe(false);
  });

  it('hasWebsite true pero sin siteUrl no cuenta como web', () => {
    expect(clasificarLead({ hasWebsite: true, siteUrl: null }).esLead).toBe(false);
  });
});
