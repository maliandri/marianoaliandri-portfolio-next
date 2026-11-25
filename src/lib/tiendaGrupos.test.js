import { describe, it, expect } from 'vitest';
import { GRUPOS, grupoDe, agruparPorObjetivo } from './tiendaGrupos';
import { ALL_SERVICES } from '@/data/serviceCatalog';

const ids = GRUPOS.map(g => g.id);

describe('grupos por objetivo', () => {
  it('tiene los 8 grupos con sus labels en criollo', () => {
    expect(GRUPOS.map(g => g.label)).toEqual([
      'Mostrar tu negocio', 'Vender online', 'Cobros', 'Que te encuentren en Google',
      'Turnos, clientes y gestión', 'IA para tu negocio', 'Redes y avisos', 'Lo técnico que tu web necesita',
    ]);
  });
  it('todo servicio del catálogo cae en un grupo', () => {
    for (const s of ALL_SERVICES) expect(ids, s.id).toContain(grupoDe(s));
  });
  it('los cobros van juntos y un servicio nuevo cae por su categoría', () => {
    for (const id of ['payments_mp', 'payments_payway', 'payments_nave', 'payments_bind']) expect(grupoDe({ id })).toBe('cobros');
    expect(grupoDe({ id: 'nuevo', categoria: '🔍 SEO & Posicionamiento' })).toBe('google');
    expect(ids).toContain(grupoDe({ id: 'nuevo', categoria: 'Inventada' }));
  });
  it('agruparPorObjetivo respeta el orden de GRUPOS y saca inactivos', () => {
    const r = agruparPorObjetivo([{ id: 'payments_mp' }, { id: 'base_sitio' }, { id: 'carrito', activo: false }]);
    expect(r.map(g => g.id)).toEqual(['mostrar', 'cobros']);
    expect(r[1].items.map(i => i.id)).toEqual(['payments_mp']);
  });
});
