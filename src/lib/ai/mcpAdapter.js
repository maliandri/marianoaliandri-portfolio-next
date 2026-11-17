import { tool } from 'ai';
import { ToolError } from '@/lib/mcp/defineTool';
import { redactSecrets } from '@/lib/mcp/redact';

// Convierte tools del servidor MCP (defineTool) en tools del AI SDK, así un agente propio usa EXACTAMENTE
// la misma lógica y los mismos frenos que Claude por MCP (cupo de Places, lista de bajas, tope de mails).
// Un error de la tool vuelve como resultado ({ error }) para que el modelo lo lea y se adapte, en vez de
// cortar toda la corrida. Los errores internos no filtran detalles. `onCall` registra cada llamada.
export function mcpToAiTools(tools, ctx, { onCall } = {}) {
  return Object.fromEntries(tools.map(t => [t.name, tool({
    description: t.description,
    inputSchema: t.inputSchema,
    async execute(args) {
      const t0 = Date.now();
      try {
        const { summary, data } = await t.handler(args || {}, { ...ctx, now: new Date() });
        const out = redactSecrets({ summary, data });
        onCall?.({ tool: t.name, args, ok: true, summary: out.summary, data: out.data, ms: Date.now() - t0 });
        return out;
      } catch (e) {
        const error = e instanceof ToolError ? redactSecrets(e.message) : 'Error interno de la herramienta.';
        if (!(e instanceof ToolError)) console.error(`[agente] ${t.name} falló:`, e);
        onCall?.({ tool: t.name, args, ok: false, summary: error, ms: Date.now() - t0 });
        return { error };
      }
    },
  })]));
}
