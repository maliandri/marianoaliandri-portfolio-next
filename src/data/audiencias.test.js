import { describe, it, expect } from 'vitest';
import { AUDIENCIAS, audienciaActiva } from './audiencias';

describe('audienciaActiva', () => {
  it('el home es la audiencia de IA', () => {
    expect(audienciaActiva('/')).toBe('ia');
    expect(audienciaActiva('')).toBe('ia');
  });

  it('ignora la barra final (trailingSlash: true)', () => {
    expect(audienciaActiva('/sitios-web/')).toBe('webs');
    expect(audienciaActiva('/ia-para/constructoras/')).toBe('ia');
  });

  it('reconoce las subrutas de cada audiencia', () => {
    expect(audienciaActiva('/lead-finder-pro/buscar')).toBe('devs');
    expect(audienciaActiva('/ats')).toBe('herramientas');
    expect(audienciaActiva('/tienda')).toBe('webs');
  });

  it('no confunde prefijos parecidos', () => {
    expect(audienciaActiva('/webinar')).toBeNull();
    expect(audienciaActiva('/statsx')).toBeNull();
  });

  it('las páginas de contenido no son de ninguna audiencia', () => {
    expect(audienciaActiva('/aprende')).toBeNull();
    expect(audienciaActiva('/auditorias/abc')).toBeNull();
  });

  it('cada opción del selector cae en su propia audiencia', () => {
    for (const a of AUDIENCIAS) expect(audienciaActiva(a.href)).toBe(a.id);
  });
});
