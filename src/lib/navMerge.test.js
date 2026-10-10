import { describe, it, expect } from 'vitest';
import { mergeNavWithDefaults, allNavIds } from './navMerge';

const DEFAULTS = [
  { id: 'panel', label: 'Panel', icon: 'P', items: [{ id: 'dashboard', label: 'Dashboard' }] },
  { id: 'redes', label: 'Redes', icon: 'R', items: [
    { id: 'social', label: 'Social', children: [{ id: 'publicar', label: 'Publicar' }, { id: 'nuevo-hijo', label: 'Nuevo hijo' }] },
  ]},
  { id: 'marketing', label: 'Marketing', icon: 'M', items: [
    { id: 'leads', label: 'Leads' },
    { id: 'nuevo-item', label: 'Nuevo item' },
  ]},
  { id: 'nueva-seccion', label: 'Nueva sección', icon: 'N', items: [{ id: 'item-de-seccion-nueva', label: 'X' }] },
];

const ids = sections => [...allNavIds(sections)];

describe('allNavIds', () => {
  it('lista items y sub-items como parent/child', () => {
    expect(ids(DEFAULTS)).toEqual([
      'dashboard', 'social', 'social/publicar', 'social/nuevo-hijo', 'leads', 'nuevo-item', 'item-de-seccion-nueva',
    ]);
  });
});

describe('mergeNavWithDefaults', () => {
  it('devuelve null si no hay config guardada', () => {
    expect(mergeNavWithDefaults(null, DEFAULTS, [])).toBeNull();
    expect(mergeNavWithDefaults([], DEFAULTS, [])).toBeNull();
  });

  it('agrega un item nuevo del código al final de su sección', () => {
    const saved = [{ id: 'marketing', label: 'Mi marketing', items: [{ id: 'leads', label: 'Mis leads' }] }];
    const known = ['leads'];
    const out = mergeNavWithDefaults(saved, DEFAULTS, known);
    const mk = out.find(s => s.id === 'marketing');
    expect(mk.label).toBe('Mi marketing');
    expect(mk.items.map(i => i.id)).toEqual(['leads', 'nuevo-item']);
    expect(mk.items[0].label).toBe('Mis leads');
  });

  it('crea la sección del default si la sección del item nuevo no existe en la config', () => {
    const saved = [{ id: 'marketing', label: 'M', items: [{ id: 'leads', label: 'L' }, { id: 'nuevo-item', label: 'N' }] }];
    const out = mergeNavWithDefaults(saved, DEFAULTS, ['leads', 'nuevo-item']);
    const sec = out.find(s => s.id === 'nueva-seccion');
    expect(sec.items.map(i => i.id)).toEqual(['item-de-seccion-nueva']);
    expect(out[out.length - 1].id).toBe('nueva-seccion');
  });

  it('agrega sub-items nuevos a un item existente', () => {
    const saved = [{ id: 'redes', label: 'R', items: [{ id: 'social', label: 'S', children: [{ id: 'publicar', label: 'Pub' }] }] }];
    const out = mergeNavWithDefaults(saved, DEFAULTS, ['social', 'social/publicar']);
    const social = out.find(s => s.id === 'redes').items[0];
    expect(social.children.map(c => c.id)).toEqual(['publicar', 'nuevo-hijo']);
    expect(social.children[0].label).toBe('Pub');
  });

  it('no vuelve a agregar lo que existía al guardar y el usuario quitó', () => {
    const saved = [{ id: 'marketing', label: 'M', items: [{ id: 'leads', label: 'L' }] }];
    const known = ids(DEFAULTS); // todo existía cuando se guardó
    const out = mergeNavWithDefaults(saved, DEFAULTS, known);
    expect(ids(out)).toEqual(['leads']);
  });

  it('sin knownIds (config vieja) agrega todo lo que falta', () => {
    const saved = [{ id: 'panel', label: 'P', items: [{ id: 'dashboard', label: 'D' }] }];
    const out = mergeNavWithDefaults(saved, DEFAULTS, undefined);
    expect(ids(out).sort()).toEqual(ids(DEFAULTS).sort());
  });

  it('descarta items que ya no existen en el código y secciones que quedan vacías', () => {
    const saved = [
      { id: 'vieja', label: 'V', items: [{ id: 'borrado-del-codigo', label: 'B' }] },
      { id: 'panel', label: 'P', items: [{ id: 'dashboard', label: 'D' }] },
    ];
    const out = mergeNavWithDefaults(saved, DEFAULTS, ids(DEFAULTS));
    expect(out.map(s => s.id)).toEqual(['panel']);
  });

  it('no muta la config ni los defaults', () => {
    const saved = [{ id: 'marketing', label: 'M', items: [{ id: 'leads', label: 'L' }] }];
    const savedCopy = JSON.parse(JSON.stringify(saved));
    const defaultsCopy = JSON.parse(JSON.stringify(DEFAULTS));
    mergeNavWithDefaults(saved, DEFAULTS, []);
    expect(saved).toEqual(savedCopy);
    expect(DEFAULTS).toEqual(defaultsCopy);
  });
});
