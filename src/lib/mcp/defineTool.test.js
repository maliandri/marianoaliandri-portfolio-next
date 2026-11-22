import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
import { z } from 'zod';
import { createFakeDb } from '@/test/fakeDb';
import { defineTool, registerTools, ToolError, argsResumen } from './defineTool';
import { encodeCursor, decodeCursor } from './paginate';

function fakeServer() {
  const tools = {};
  return { tools, registerTool: (name, config, cb) => { tools[name] = { config, cb }; } };
}
const ctx = { http: { authInfo: { extra: { uid: 'u1', email: 'm@x.com' } } } };

function setup(handler, db = createFakeDb()) {
  const server = fakeServer();
  const tool = defineTool({ name: 'probar_cosa', title: 'Probar', description: 'd', inputSchema: z.object({ a: z.string() }), handler });
  registerTools(server, [tool], { getDb: () => db.db });
  return { cb: server.tools.probar_cosa.cb, config: server.tools.probar_cosa.config, db };
}

describe('defineTool / registerTools', () => {
  beforeEach(() => { delete process.env.MCP_RATE_PER_MIN; });

  it('registra con el schema y devuelve summary + structuredContent', async () => {
    const { cb, config, db } = setup(async (args, c) => ({ summary: `hola ${args.a} ${c.user.uid}`, data: { n: 1 } }));
    expect(config.inputSchema).toBeDefined();
    const r = await cb({ a: 'x' }, ctx);
    // Claude puede leer solo `content`: los datos completos van también ahí, como JSON.
    expect(r).toEqual({
      content: [{ type: 'text', text: 'hola x u1' }, { type: 'text', text: '{"n":1}' }],
      structuredContent: { n: 1 },
    });
    const log = Object.entries(db.docs).find(([k]) => k.startsWith('mcp_tool_calls/'))[1];
    expect(log).toMatchObject({ tool: 'probar_cosa', ok: true });
  });

  it('ToolError llega con su mensaje', async () => {
    const { cb } = setup(async () => { throw new ToolError('no hay leads'); });
    expect(await cb({ a: 'x' }, ctx)).toEqual({ isError: true, content: [{ type: 'text', text: 'no hay leads' }] });
  });

  it('un error interno no filtra el detalle', async () => {
    const { cb, db } = setup(async () => { throw new Error('clave secreta sk-123'); });
    const r = await cb({ a: 'x' }, ctx);
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r)).not.toContain('sk-123');
    expect(r.content[0].text).toContain('Error interno');
    const log = Object.entries(db.docs).find(([k]) => k.startsWith('mcp_tool_calls/'))[1];
    expect(log).toMatchObject({ ok: false, tipoError: 'interno' });
  });

  it('un ToolError queda registrado como error conocido', async () => {
    const { cb, db } = setup(async () => { throw new ToolError('no hay leads'); });
    await cb({ a: 'x' }, ctx);
    const log = Object.entries(db.docs).find(([k]) => k.startsWith('mcp_tool_calls/'))[1];
    expect(log).toMatchObject({ ok: false, tipoError: 'conocido' });
  });

  it('pasa los nombres de todas las tools al handler', async () => {
    const { cb } = setup(async (_a, c) => ({ summary: 'ok', data: { nombres: c.toolNames } }));
    expect((await cb({ a: 'x' }, ctx)).structuredContent.nombres).toEqual(['probar_cosa']);
  });

  it('sin authInfo no corre', async () => {
    const handler = vi.fn();
    const { cb } = setup(handler);
    expect((await cb({ a: 'x' }, {})).isError).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rate limit por minuto', async () => {
    process.env.MCP_RATE_PER_MIN = '2';
    const { cb } = setup(async () => ({ summary: 'ok', data: {} }));
    await cb({ a: 'x' }, ctx);
    await cb({ a: 'x' }, ctx);
    const r = await cb({ a: 'x' }, ctx);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('reintentá en');
  });
});

describe('argsResumen (lo que se guarda en mcp_tool_calls)', () => {
  it('tapa datos sensibles por nombre de campo y por contenido', () => {
    expect(argsResumen({
      email: 'ana@x.com', telefono: '2995551234', texto: 'Hola', preview_url: 'https://x', access_token: 'abc',
      cliente: 'escribile a ana@x.com', contacto: '+54 9 299 555-1234',
      id: 'a1', dias: 28, fecha: '2026-11-20', redes: ['facebook'], items: [{ nombre: 'x' }], vacio: '',
    })).toEqual({
      email: '<oculto>', telefono: '<oculto>', texto: '<oculto>', preview_url: '<oculto>', access_token: '<oculto>',
      cliente: '<oculto>', contacto: '<oculto>',
      id: 'a1', dias: 28, fecha: '2026-11-20', redes: ['facebook'], items: ['<objeto>'], vacio: '',
    });
  });

  it('resume textos largos y listas grandes', () => {
    const r = argsResumen({ pedido: 'x'.repeat(100), lista: Array.from({ length: 20 }, (_, i) => `l${i}`) });
    expect(r).toEqual({ pedido: '<100 caracteres>', lista: '<20 items>' });
  });
});

describe('cursores', () => {
  it('ida y vuelta', () => expect(decodeCursor(encodeCursor({ o: 20 }))).toEqual({ o: 20 }));
  it('cursor inválido → ToolError', () => expect(() => decodeCursor('%%%')).toThrow(ToolError));
  it('null → null', () => expect(decodeCursor(undefined)).toBeNull());
});
