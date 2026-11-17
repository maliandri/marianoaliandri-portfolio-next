import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ALL_TOOLS } from '@/lib/mcp/register';
import { defineTool, ToolError } from '@/lib/mcp/defineTool';
import { mcpToAiTools } from './mcpAdapter';
import { HERRAMIENTAS_AGENTE, toolsDelAgente, correrAgenteProspeccion } from './prospectingAgent';

// Regla dura: el agente redacta, nunca envía ni publica. Si alguien suma una tool de salida a la lista
// blanca, estos tests fallan.
describe('lista blanca del agente', () => {
  const NUNCA = /^(send_|publish_|create_audit_report|review_audit_draft|run_demand_report|save_demand_zone|set_budget_status|quote_budget_request|create_budget|update_|generate_|create_content)/;

  it('ninguna herramienta de envío, publicación o escritura de negocio', () => {
    for (const name of HERRAMIENTAS_AGENTE) expect(name).not.toMatch(NUNCA);
  });
  it('puede redactar pero no enviar', () => {
    expect(HERRAMIENTAS_AGENTE).toContain('draft_business_email');
    expect(HERRAMIENTAS_AGENTE).not.toContain('send_business_email');
  });
  it('cada nombre de la lista existe en el MCP (si se renombra una tool, se nota acá)', () => {
    const existentes = new Set(ALL_TOOLS.map(t => t.name));
    for (const name of HERRAMIENTAS_AGENTE) expect(existentes.has(name)).toBe(true);
    expect(toolsDelAgente().map(t => t.name).sort()).toEqual([...HERRAMIENTAS_AGENTE].sort());
  });
});

describe('mcpToAiTools', () => {
  const ok = defineTool({ name: 'ok', description: 'd', inputSchema: z.object({ a: z.string() }), handler: async (a) => ({ summary: `hola ${a.a}`, data: { n: 1 } }) });
  const malo = defineTool({ name: 'malo', description: 'd', inputSchema: z.object({}), handler: async () => { throw new ToolError('Cupo agotado'); } });
  const roto = defineTool({ name: 'roto', description: 'd', inputSchema: z.object({}), handler: async () => { throw new Error('secreto interno: abc123'); } });
  const exec = (t, args = {}) => t.execute(args, { toolCallId: 'x', messages: [] });

  it('devuelve summary y data y avisa con onCall', async () => {
    const onCall = vi.fn();
    const t = mcpToAiTools([ok], { db: {}, user: { uid: 'u' } }, { onCall });
    expect(await exec(t.ok, { a: 'mundo' })).toEqual({ summary: 'hola mundo', data: { n: 1 } });
    expect(onCall).toHaveBeenCalledWith(expect.objectContaining({ tool: 'ok', ok: true }));
  });
  it('un ToolError vuelve como resultado legible para que el modelo se adapte', async () => {
    const t = mcpToAiTools([malo], { db: {}, user: {} });
    expect(await exec(t.malo)).toEqual({ error: 'Cupo agotado' });
  });
  it('un error interno no filtra detalles', async () => {
    const t = mcpToAiTools([roto], { db: {}, user: {} });
    const r = await exec(t.roto);
    expect(r.error).toBe('Error interno de la herramienta.');
    expect(JSON.stringify(r)).not.toContain('abc123');
  });
});

describe('correrAgenteProspeccion', () => {
  it('junta los borradores que dejó el agente y devuelve su informe', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key-123456');
    const generar = vi.fn(async ({ tools }) => {
      // simula que el modelo llamó a draft_business_email
      expect(Object.keys(tools)).toContain('esperar');
      expect(Object.keys(tools)).not.toContain('send_business_email');
      return { text: 'Listo: 1 borrador.', steps: [{}, {}] };
    });
    const r = await correrAgenteProspeccion({ db: {}, user: { uid: 'u' }, objetivo: 'ferreterías en Cipolletti', generar });
    expect(r.texto).toBe('Listo: 1 borrador.');
    expect(r.borradores).toEqual([]);
    expect(generar).toHaveBeenCalledOnce();
    vi.unstubAllEnvs();
  });
});
