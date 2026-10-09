import { describe, it, expect } from 'vitest';
import {
  COOLDOWN_MS, DEFAULT_NETWORKS, comboKey, pickNext, buildStats, buildPost, validateConfigPatch,
} from './autoAudit.js';

const NOW = Date.UTC(2026, 9, 9);
const PRIO = { label: 'Ferretería', kind: 'type', value: 'hardware_store', prioritario: true };
const SEC  = { label: 'Panadería',  kind: 'type', value: 'bakery',         prioritario: false };

describe('pickNext', () => {
  it('con rand < 0.8 elige un rubro prioritario', () => {
    const c = pickNext({ ciudades: ['A', 'B'], rubros: [PRIO, SEC], ultimaCorrida: {} }, NOW, () => 0.5);
    expect(c.rubro.label).toBe('Ferretería');
  });

  it('con rand >= 0.8 elige un rubro secundario', () => {
    const c = pickNext({ ciudades: ['A', 'B'], rubros: [PRIO, SEC], ultimaCorrida: {} }, NOW, () => 0.9);
    expect(c.rubro.label).toBe('Panadería');
  });

  it('si el pool elegido está vacío usa el otro', () => {
    const c = pickNext({ ciudades: ['A'], rubros: [SEC], ultimaCorrida: {} }, NOW, () => 0.1);
    expect(c.rubro.label).toBe('Panadería');
  });

  it('no repite una combinación corrida hace menos de 30 días', () => {
    const config = {
      ciudades: ['A', 'B'], rubros: [PRIO],
      ultimaCorrida: { [comboKey('A', PRIO)]: NOW - 1000 },
    };
    expect(pickNext(config, NOW, () => 0.1).ciudad).toBe('B');
  });

  it('vuelve a habilitar una combinación pasados 30 días', () => {
    const config = {
      ciudades: ['A'], rubros: [PRIO],
      ultimaCorrida: { [comboKey('A', PRIO)]: NOW - COOLDOWN_MS },
    };
    expect(pickNext(config, NOW, () => 0.1).ciudad).toBe('A');
  });

  it('prefiere la combinación corrida hace más tiempo', () => {
    const config = {
      ciudades: ['A', 'B'], rubros: [PRIO],
      ultimaCorrida: {
        [comboKey('A', PRIO)]: NOW - COOLDOWN_MS - 5000,
        [comboKey('B', PRIO)]: NOW - COOLDOWN_MS - 9000,
      },
    };
    expect(pickNext(config, NOW, () => 0.1).ciudad).toBe('B');
  });

  it('devuelve null si todas están en cooldown o no hay ciudades/rubros', () => {
    const config = { ciudades: ['A'], rubros: [PRIO], ultimaCorrida: { [comboKey('A', PRIO)]: NOW } };
    expect(pickNext(config, NOW)).toBeNull();
    expect(pickNext({ ciudades: [], rubros: [PRIO] }, NOW)).toBeNull();
    expect(pickNext({ ciudades: ['A'], rubros: [] }, NOW)).toBeNull();
  });
});

describe('buildStats', () => {
  it('calcula total, promedio, débiles (<50) y con email', () => {
    const stats = buildStats([
      { seoScore: 20, email: 'a@a.com' },
      { seoScore: 49, email: null },
      { seoScore: 50, email: 'b@b.com' },
      { seoScore: 81, email: null },
    ]);
    expect(stats).toEqual({ total: 4, avgSeoScore: 50, lowSeoCount: 2, withEmail: 2 });
  });

  it('con lista vacía devuelve ceros y promedio null (no NaN)', () => {
    expect(buildStats([])).toEqual({ total: 0, avgSeoScore: null, lowSeoCount: 0, withEmail: 0 });
  });

  it('ignora scores no numéricos en el promedio', () => {
    const stats = buildStats([{ seoScore: null }, { seoScore: 40 }]);
    expect(stats.avgSeoScore).toBe(40);
    expect(stats.total).toBe(2);
  });
});

describe('buildPost', () => {
  const combo = { ciudad: 'Mendoza', rubro: PRIO };
  const stats = { total: 12, avgSeoScore: 41, lowSeoCount: 9, withEmail: 5 };

  it('arma título, texto con agregados y link al informe', () => {
    const { title, payload } = buildPost({
      combo, stats, auditoriaId: 'abc123', summary: 'Resumen corto.',
      imageUrl: 'https://img/x.jpg', networks: DEFAULT_NETWORKS,
    });
    expect(title).toBe('Auditoría SEO de 12 sitios de Ferretería en Mendoza');
    expect(payload.type).toBe('keyword_report');
    expect(payload.networks).toEqual(['linkedin', 'instagram', 'facebook']);
    expect(payload.imageUrl).toBe('https://img/x.jpg');
    expect(payload.text).toContain('41/100');
    expect(payload.text).toContain('75% (9 de 12)');
    expect(payload.text).toContain('Resumen corto.');
    expect(payload.text).toContain('https://marianoaliandri.com.ar/auditorias/abc123');
  });

  it('trunca resúmenes largos a 240 caracteres', () => {
    const { payload } = buildPost({
      combo, stats, auditoriaId: 'x', summary: 'a'.repeat(500), imageUrl: 'u', networks: ['linkedin'],
    });
    const line = payload.text.split('\n').find(l => l.startsWith('aaa'));
    expect(line.length).toBeLessThanOrEqual(240);
    expect(line.endsWith('…')).toBe(true);
  });

  it('sin summary no deja líneas vacías de más', () => {
    const { payload } = buildPost({ combo, stats, auditoriaId: 'x', imageUrl: 'u', networks: ['linkedin'] });
    expect(payload.text).not.toMatch(/\n{3,}/);
  });
});

describe('validateConfigPatch', () => {
  it('acepta activo boolean', () => {
    expect(validateConfigPatch({ activo: true })).toEqual({ update: { activo: true } });
  });

  it('rechaza activo no boolean', () => {
    expect(validateConfigPatch({ activo: 'si' }).error).toMatch(/activo/);
  });

  it('normaliza ciudades: trim, descarta vacías y duplicadas', () => {
    const r = validateConfigPatch({ ciudades: [' Neuquén ', '', 'Neuquén', 'Salta'] });
    expect(r.update.ciudades).toEqual(['Neuquén', 'Salta']);
  });

  it('rechaza ciudades si no es array o queda vacío', () => {
    expect(validateConfigPatch({ ciudades: 'Neuquén' }).error).toMatch(/ciudades/);
    expect(validateConfigPatch({ ciudades: ['  '] }).error).toMatch(/ciudades/);
  });

  it('valida rubros: kind type|text, label y value no vacíos, prioritario boolean', () => {
    const ok = validateConfigPatch({ rubros: [{ label: 'X', kind: 'text', value: 'x', prioritario: true }] });
    expect(ok.update.rubros).toHaveLength(1);
    expect(validateConfigPatch({ rubros: [{ label: 'X', kind: 'otro', value: 'x', prioritario: true }] }).error).toMatch(/rubros/);
    expect(validateConfigPatch({ rubros: [{ label: '', kind: 'text', value: 'x', prioritario: true }] }).error).toMatch(/rubros/);
    expect(validateConfigPatch({ rubros: [] }).error).toMatch(/rubros/);
  });

  it('valida networks contra linkedin/instagram/facebook', () => {
    expect(validateConfigPatch({ networks: ['linkedin', 'facebook'] }).update.networks).toEqual(['linkedin', 'facebook']);
    expect(validateConfigPatch({ networks: ['tiktok'] }).error).toMatch(/networks/);
    expect(validateConfigPatch({ networks: [] }).error).toMatch(/networks/);
  });

  it('valida imageUrl https', () => {
    expect(validateConfigPatch({ imageUrl: 'https://a/b.jpg' }).update.imageUrl).toBe('https://a/b.jpg');
    expect(validateConfigPatch({ imageUrl: 'http://a/b.jpg' }).error).toMatch(/imageUrl/);
  });

  it('rechaza un body sin campos conocidos', () => {
    expect(validateConfigPatch({ otraCosa: 1 }).error).toMatch(/Nada para actualizar/);
  });
});
