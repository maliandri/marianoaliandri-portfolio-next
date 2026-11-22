import { describe, it, expect } from 'vitest';
import { agruparFaltantes, herramientasQueFallan, herramientasSinUso, ideasPendientes, normalizarClave } from './aprendizaje';

describe('aprendizaje', () => {
  it('normaliza claves sin acentos ni signos', () => {
    expect(normalizarClave('  Mandar WhatsApp — ¡ya! ')).toBe('mandar whatsapp ya');
  });

  it('agrupa faltantes abiertos por herramienta sugerida y los ordena por veces', () => {
    const gaps = [
      { id: 'a', pedido: 'mandale un whatsapp a Ana', herramientaSugerida: 'send_whatsapp', estado: 'nuevo', creadoMs: 1 },
      { id: 'b', pedido: 'escribile por WhatsApp a Juan', herramientaSugerida: 'Send WhatsApp', estado: 'en_desarrollo', creadoMs: 3 },
      { id: 'c', pedido: 'ver mi agenda', herramientaSugerida: null, estado: 'nuevo', creadoMs: 2 },
      { id: 'd', pedido: 'algo ya resuelto', herramientaSugerida: 'x', estado: 'hecho', creadoMs: 5 },
    ];
    const r = agruparFaltantes(gaps);
    expect(r.map(x => x.veces)).toEqual([2, 1]);
    expect(r[0]).toMatchObject({ veces: 2, ejemplo: 'escribile por WhatsApp a Juan', ids: ['a', 'b'] });
    expect(r[1]).toMatchObject({ herramienta: null, ejemplo: 'ver mi agenda' });
  });

  it('calcula la tasa de error con un mínimo de llamadas', () => {
    const calls = [
      { tool: 'a', ok: false, error: 'viejo', tipoError: 'conocido', atMs: 1 },
      { tool: 'a', ok: false, error: 'nuevo', tipoError: 'interno', atMs: 2 },
      { tool: 'a', ok: true, atMs: 3 },
      { tool: 'b', ok: false, atMs: 1 }, // una sola llamada: no alcanza el mínimo
      { tool: 'c', ok: true, atMs: 1 }, { tool: 'c', ok: true, atMs: 2 }, { tool: 'c', ok: true, atMs: 3 },
    ];
    expect(herramientasQueFallan(calls)).toEqual([
      { tool: 'a', llamadas: 3, errores: 2, internos: 1, ultimoError: 'nuevo', tasaError: 67, ultimoErrorEn: new Date(2).toISOString() },
    ]);
  });

  it('lista las herramientas sin uso', () => {
    expect(herramientasSinUso(['x', 'b', 'a'], [{ tool: 'a' }])).toEqual(['b', 'x']);
  });

  it('ordena las ideas abiertas por prioridad y después por fecha', () => {
    const ideas = [
      { id: '1', idea: 'sin prio', estado: 'nuevo', creadoMs: 9 },
      { id: '2', idea: 'baja', prioridad: 'baja', estado: 'nuevo', creadoMs: 1 },
      { id: '3', idea: 'alta vieja', prioridad: 'alta', estado: 'en_desarrollo', creadoMs: 1 },
      { id: '4', idea: 'alta nueva', prioridad: 'alta', estado: 'nuevo', creadoMs: 2 },
      { id: '5', idea: 'hecha', prioridad: 'alta', estado: 'hecho', creadoMs: 3 },
    ];
    expect(ideasPendientes(ideas).map(i => i.id)).toEqual(['4', '3', '2', '1']);
  });
});
