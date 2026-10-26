import { FieldValue } from 'firebase-admin/firestore';
import { envInt } from './config';
import { hitRateLimit } from './rateLimit';
import { redactSecrets } from './redact';

// Envoltorio común de todas las tools del servidor MCP: auth, rate limit, registro en
// mcp_tool_calls y errores sin detalles internos. Cada tool devuelve { summary, data }.

// Error con un mensaje pensado para que Claude lo lea (y se lo cuente a Mariano).
export class ToolError extends Error {}

export function defineTool({ name, title, description, inputSchema, annotations, handler }) {
  return { name, title, description, inputSchema, annotations, handler };
}

const errorResult = (text) => ({ isError: true, content: [{ type: 'text', text }] });

// Resumen de los argumentos para el log: sin textos largos (pueden ser mails enteros).
function argsResumen(args) {
  const out = {};
  for (const [k, v] of Object.entries(args || {})) {
    out[k] = typeof v === 'string' && v.length > 60 ? `<${v.length} caracteres>` : v;
  }
  return out;
}

async function logCall(db, entry) {
  try {
    await db.collection('mcp_tool_calls').add({ ...entry, at: FieldValue.serverTimestamp() });
  } catch (e) {
    console.error('[mcp] no se pudo registrar la llamada:', e.message);
  }
}

export function registerTools(server, tools, { getDb }) {
  for (const tool of tools) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      ...(tool.annotations ? { annotations: tool.annotations } : {}),
    }, async (args, ctx) => {
      const extra = ctx?.http?.authInfo?.extra;
      if (!extra?.uid) return errorResult('No autenticado.');
      const db = getDb();
      if (!db) return errorResult('Error interno, revisá los logs.');
      const user = { uid: extra.uid, email: extra.email };

      for (const [windowS, limit, label] of [
        [60, envInt('MCP_RATE_PER_MIN', 60), 'por minuto'],
        [86400, envInt('MCP_RATE_PER_DAY', 1500), 'por día'],
      ]) {
        const r = await hitRateLimit(db, `tool:${user.uid}`, { limit, windowS });
        if (!r.ok) return errorResult(`Límite de llamadas ${label} alcanzado, reintentá en ${r.retryAfterS} s.`);
      }

      const t0 = Date.now();
      try {
        const { summary, data } = await tool.handler(args || {}, { db, user, now: new Date() });
        await logCall(db, { tool: tool.name, ok: true, ms: Date.now() - t0, args: argsResumen(args) });
        return redactSecrets({ content: [{ type: 'text', text: summary }], structuredContent: data });
      } catch (e) {
        const known = e instanceof ToolError;
        if (!known) console.error(`[mcp] ${tool.name} falló:`, e);
        await logCall(db, { tool: tool.name, ok: false, ms: Date.now() - t0, args: argsResumen(args), error: redactSecrets(String(e.message).slice(0, 300)) });
        return errorResult(known ? redactSecrets(e.message) : 'Error interno, revisá los logs.');
      }
    });
  }
}
