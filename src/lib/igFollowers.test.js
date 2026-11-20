import { describe, it, expect } from 'vitest';
import { parseIgExport, cruzar } from './igFollowers';

const followers = [
  { string_list_data: [{ href: 'https://www.instagram.com/Ana', value: 'Ana', timestamp: 1 }] },
  { string_list_data: [{ href: 'https://www.instagram.com/beto', value: 'beto', timestamp: 2 }] },
];
const following = { relationships_following: [
  { title: 'beto', string_list_data: [{ href: 'https://www.instagram.com/_u/beto', timestamp: 3 }] },
  { title: 'cami', string_list_data: [{ href: 'https://www.instagram.com/_u/cami', timestamp: 4 }] },
] };

describe('igFollowers', () => {
  it('parsea los dos formatos', () => {
    expect(parseIgExport(followers).map(x => x.handle)).toEqual(['ana', 'beto']);
    expect(parseIgExport(following).map(x => x.handle)).toEqual(['beto', 'cami']);
  });
  it('cruza quién sigue a quién', () => {
    const { stats, filas } = cruzar(parseIgExport(followers), parseIgExport(following));
    expect(stats).toEqual({ seguidores: 2, seguidos: 2, mutuos: 1, noMeSiguen: 1, noSigo: 1 });
    expect(filas.find(f => f.handle === 'cami')).toMatchObject({ meSigue: false, loSigo: true });
    expect(filas.find(f => f.handle === 'ana')).toMatchObject({ meSigue: true, loSigo: false });
  });
  it('tolera basura', () => {
    expect(parseIgExport(null)).toEqual([]);
    expect(parseIgExport({ a: 1 })).toEqual([]);
  });
});
