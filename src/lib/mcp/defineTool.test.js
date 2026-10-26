import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
import { z } from 'zod';
import { createFakeDb } from '@/test/fakeDb';
import { defineTool, registerTools, ToolError } from './defineTool';
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
    expect(log).toMatchObject({ ok: false });
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

describe('cursores', () => {
  it('ida y vuelta', () => expect(decodeCursor(encodeCursor({ o: 20 }))).toEqual({ o: 20 }));
  it('cursor inválido → ToolError', () => expect(() => decodeCursor('%%%')).toThrow(ToolError));
  it('null → null', () => expect(decodeCursor(undefined)).toBeNull());
});
