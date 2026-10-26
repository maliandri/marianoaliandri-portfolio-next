import { describe, it, expect } from 'vitest';
import { buildAuditReportDraft, MIN_SITIOS_INFORME } from './auditReportDraft';

const lead = (id, seoScore, email) => ({
  id, nombre: `N${id}`, ciudad: 'Neuquén', tipo: 'Durlock', canal: 'web', siteUrl: `https://${id}.com`, seoScore, email,
});

describe('buildAuditReportDraft', () => {
  const leads = [lead('a', 30, 'a@a.com'), lead('b', 45, 'b@b.com'), lead('c', 80, null), { id: 'd', nombre: 'Sin web', canal: 'whatsapp' }];
  const now = new Date('2026-10-26T12:00:00-03:00');
  const d = buildAuditReportDraft(leads, { ciudades: ['Neuquén'], rubros: ['Durlock'], radioKm: 10, now });

  it('cuenta solo los leads con web y puntaje', () => {
    expect(d.filas).toHaveLength(3);
    expect(d.stats).toEqual({ total: 3, withEmail: 2, lowSeoCount: 2, avgSeoScore: 52 });
  });

  it('arma título y resumen como el botón Publicar informe', () => {
    expect(d.title.startsWith('Auditoría SEO de páginas web de Durlock (')).toBe(true);
    expect(d.title).toContain('2026');
    expect(d.summary).toContain('El 67% (2)');
    expect(d.summary).toContain('en Neuquén');
    expect(d.summary).toContain('https://marianoaliandri.com.ar/keywords');
  });

  it('config para guardar', () => {
    expect(d.config).toEqual({ ciudades: ['Neuquén'], pais: 'Argentina', radioKm: 10, tiposLabels: ['Durlock'] });
  });

  it('mínimo de sitios', () => {
    expect(MIN_SITIOS_INFORME).toBe(3);
  });
});
