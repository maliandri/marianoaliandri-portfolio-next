import { describe, it, expect } from 'vitest';
import { CAPABILITIES } from './capabilities';

describe('CAPABILITIES (carrusel del home)', () => {
  it('la primera filmina es la de IA para empresas y lleva a /ia-para/', () => {
    expect(CAPABILITIES[0]).toMatchObject({ id: 'ia-conectada', href: '/ia-para/' });
    expect(CAPABILITIES[0].cta).toBeTruthy();
  });

  it('ids únicos y los links son rutas internas con barra final', () => {
    const ids = CAPABILITIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CAPABILITIES.filter(c => c.href)) expect(c.href).toMatch(/^\/[a-z0-9/-]*\/$/);
  });
});
