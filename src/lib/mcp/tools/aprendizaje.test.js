import { describe, it, expect, vi } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
import { createFakeDb } from '@/test/fakeDb';
import { registerTools } from '../defineTool';
import { LEARNING_TOOLS } from './aprendizaje';

const ctx = { http: { authInfo: { extra: { uid: 'u1', email: 'm@x.com' } } } };

function setup(docs = {}) {
  const server = { tools: {}, registerTool(n, _c, cb) { this.tools[n] = cb; } };
  const fake = createFakeDb(docs);
  // Una tool extra que nunca se llama, para probar "sin uso".
  const extra = { name: 'tool_olvidada', title: 't', description: 'd', inputSchema: undefined, handler: async () => ({ summary: '', data: {} }) };
  registerTools(server, [...LEARNING_TOOLS, extra], { getDb: () => fake.db });
  const call = async (name, args = {}) => server.tools[name](args, ctx);
  return { call, fake };
}

describe('tools de aprendizaje', () => {
  it('registra un faltante, lo lista y le cambia el estado', async () => {
    const { call } = setup();
    const r = await call('registrar_faltante', { pedido: 'Mandale un WhatsApp a Ana', herramienta_sugerida: 'send_whatsapp' });
    const id = r.structuredContent.id;
    expect(r.structuredContent.estado).toBe('nuevo');

    const lista = await call('listar_ideas', { tipo: 'faltantes' });
    expect(lista.structuredContent.items).toHaveLength(1);
    expect(lista.structuredContent.items[0]).toMatchObject({ tipo: 'faltante', id, texto: 'Mandale un WhatsApp a Ana', herramientaSugerida: 'send_whatsapp' });

    const act = await call('actualizar_estado', { tipo: 'faltante', id, estado: 'en_desarrollo', nota: 'arrancado' });
    expect(act.structuredContent).toMatchObject({ estadoAnterior: 'nuevo', estado: 'en_desarrollo' });
    const otra = await call('listar_ideas', { estado: 'en_desarrollo' });
    expect(otra.structuredContent.items[0].nota).toBe('arrancado');
  });

  it('guarda ideas y filtra por categoría', async () => {
    const { call } = setup();
    await call('guardar_idea', { idea: 'Bot de WhatsApp', categoria: 'herramienta', prioridad: 'alta' });
    await call('guardar_idea', { idea: 'Reel sobre stock', categoria: 'contenido' });
    const r = await call('listar_ideas', { tipo: 'ideas', categoria: 'contenido' });
    expect(r.structuredContent.items.map(i => i.texto)).toEqual(['Reel sobre stock']);
  });

  it('actualizar_estado avisa si el id no existe o es inválido', async () => {
    const { call } = setup();
    expect((await call('actualizar_estado', { tipo: 'idea', id: 'nope', estado: 'hecho' })).content[0].text).toContain('No existe');
    expect((await call('actualizar_estado', { tipo: 'idea', id: 'a/b', estado: 'hecho' })).content[0].text).toContain('Id inválido');
  });

  it('resumen_aprendizaje junta faltantes, fallas, herramientas sin uso e ideas', async () => {
    const ahora = Date.now();
    const at = (ms) => ({ __ts: ms * 1000, toMillis: () => ms, toDate: () => new Date(ms) });
    const { call } = setup({
      'mcp_gaps/g1': { pedido: 'mandá un WhatsApp', herramientaSugerida: 'send_whatsapp', estado: 'nuevo', creadoMs: ahora - 1000 },
      'mcp_gaps/g2': { pedido: 'WhatsApp a Juan', herramientaSugerida: 'send_whatsapp', estado: 'nuevo', creadoMs: ahora - 2000 },
      'mcp_gaps/g3': { pedido: 'viejo', herramientaSugerida: 'x', estado: 'nuevo', creadoMs: ahora - 40 * 86400000 },
      'mcp_ideas/i1': { idea: 'baja', prioridad: 'baja', estado: 'nuevo', creadoMs: ahora },
      'mcp_ideas/i2': { idea: 'alta', prioridad: 'alta', estado: 'nuevo', creadoMs: ahora - 1 },
      'mcp_tool_calls/c1': { tool: 'guardar_idea', ok: false, error: 'falló', tipoError: 'interno', at: at(ahora - 3000) },
      'mcp_tool_calls/c2': { tool: 'guardar_idea', ok: false, error: 'otra vez', tipoError: 'interno', at: at(ahora - 2000) },
      'mcp_tool_calls/c3': { tool: 'guardar_idea', ok: true, at: at(ahora - 1000) },
      'mcp_tool_calls/c4': { tool: 'listar_ideas', ok: false, at: at(ahora - 40 * 86400000) }, // fuera del período
    });
    const r = await call('resumen_aprendizaje', { dias: 28 });
    const d = r.structuredContent;
    expect(d.faltantesMasPedidos).toEqual([expect.objectContaining({ herramienta: 'send_whatsapp', veces: 2 })]);
    expect(d.herramientasQueFallan).toEqual([expect.objectContaining({ tool: 'guardar_idea', errores: 2, tasaError: 67, ultimoError: 'otra vez' })]);
    expect(d.herramientasSinUso).toContain('tool_olvidada');
    expect(d.herramientasSinUso).not.toContain('guardar_idea');
    expect(d.ideasPendientes.map(i => i.idea)).toEqual(['alta', 'baja']);
    expect(r.content[0].text).toContain('send_whatsapp');
  });
});
