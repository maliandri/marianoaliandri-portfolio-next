import { z } from 'zod';
import { tool, generateText, stepCountIs } from 'ai';
import { ALL_TOOLS } from '@/lib/mcp/register';
import { conRespaldo } from '@/lib/ai/gemini';
import { mcpToAiTools } from '@/lib/ai/mcpAdapter';

// Agente de prospección: recibe un objetivo ("buscame ferreterías en Cipolletti con web floja y dejame los
// mails listos") y usa en ciclo las MISMAS tools del servidor MCP: elige rubros por demanda, busca y audita
// leads, mira lo ya auditado y redacta borradores.
//
// REGLA DURA: el agente nunca envía ni publica nada. Solo tiene herramientas para buscar, leer y REDACTAR
// borradores; el envío lo aprueba Mariano mail por mail desde el admin, y ahí siguen valiendo los frenos del
// servidor (bajas, rebotes, 30 días sin repetir, tope diario). La lista blanca está testeada: si alguien suma
// una tool de envío o publicación acá, el test falla.
export const HERRAMIENTAS_AGENTE = [
  'rank_rubros_by_demand',
  'search_leads',
  'get_lead_search',
  'list_lead_searches',
  'list_audits',
  'get_audit',
  'draft_business_email',
  'list_sent_emails',
  'list_ig_prospects',
];

export const MAX_PASOS = 14;
export const MAX_ESPERA_S = 20;

export const SYSTEM = `Sos el agente de prospección de Mariano Aliandri (desarrollador de sistemas a medida y webs en Neuquén).
Tu trabajo: a partir de un objetivo, encontrar negocios que sean buenos prospectos y dejar BORRADORES de mails para que Mariano los revise.

Cómo trabajar:
- Si el objetivo no trae rubro, usá rank_rubros_by_demand en la localidad para elegir rubros que la gente realmente busca.
- Antes de gastar una búsqueda nueva, mirá si ya hay algo útil: list_lead_searches, list_audits o get_audit. Reusar es gratis; search_leads cuesta cupo de Google Places.
- search_leads es asíncrona: lanzala UNA sola vez por pedido, con cantidad chica (máximo 10 salvo que el objetivo pida más), y después consultá get_lead_search con el jobId usando la herramienta esperar entre consultas (15 segundos) hasta que termine. No lances búsquedas repetidas.
- Los mejores prospectos: web floja o con problemas (puntaje SEO bajo), rubro con mucha demanda, y email público para escribirles. Los que no tienen web solo sirven si tienen WhatsApp (pasalos a la lista final como "contactar por WhatsApp", sin mail).
- Para cada prospecto con web y email, redactá un borrador con draft_business_email (máximo 8 borradores por corrida). Si devuelve un bloqueo (baja, rebote o contactado hace poco) NO lo insistas: anotalo en el informe.
- No tenés herramienta para enviar mails ni publicar: Mariano aprueba y envía cada borrador a mano. Nunca prometas que algo "se envió".
- Si una herramienta devuelve un error, leelo y adaptá el plan (otra localidad, menos cantidad); no repitas el mismo pedido fallido.

Al terminar, respondé con un informe corto en español rioplatense: qué hiciste (búsqueda nueva o reuso), cuántos prospectos encontraste, los mejores 5 con por qué (puntaje, demanda, canal), cuántos borradores quedaron listos y cuáles quedaron afuera con el motivo. Sin relleno.`;

const esperar = tool({
  description: `Espera unos segundos (máximo ${MAX_ESPERA_S}). Usala entre consultas a get_lead_search mientras la búsqueda sigue "running".`,
  inputSchema: z.object({ segundos: z.number().int().min(1).max(MAX_ESPERA_S).describe('Segundos a esperar.') }),
  async execute({ segundos }) {
    await new Promise(r => setTimeout(r, Math.min(segundos, MAX_ESPERA_S) * 1000));
    return { esperado: segundos };
  },
});

export const toolsDelAgente = () => ALL_TOOLS.filter(t => HERRAMIENTAS_AGENTE.includes(t.name));

// Resumen corto de los argumentos para mostrar en el registro de pasos.
const resumirArgs = (a) => Object.fromEntries(Object.entries(a || {}).map(([k, v]) => [k, typeof v === 'string' && v.length > 80 ? `${v.slice(0, 80)}…` : v]));

export async function correrAgenteProspeccion({ db, user, objetivo, generar = generateText, onEvento = () => {} }) {
  const pasos = [];
  const borradores = [];
  let n = 0; // id que une el "empezó" y el "terminó" de cada herramienta en el visor
  const abiertas = [];
  const onStart = (c) => {
    const id = ++n;
    abiertas.push({ tool: c.tool, id });
    onEvento({ tipo: 'herramienta', fase: 'inicio', id, tool: c.tool, args: resumirArgs(c.args) });
  };
  const onCall = (c) => {
    const i = abiertas.findIndex(a => a.tool === c.tool);
    const id = i >= 0 ? abiertas.splice(i, 1)[0].id : ++n;
    pasos.push({ tool: c.tool, args: resumirArgs(c.args), ok: c.ok, resumen: c.summary, ms: c.ms });
    onEvento({ tipo: 'herramienta', fase: 'fin', id, tool: c.tool, ok: c.ok, resumen: c.summary, ms: c.ms });
    if (c.tool === 'draft_business_email' && c.ok && c.data?.draftId) {
      const d = c.data;
      borradores.push({ draftId: d.draftId, to: d.to, subject: d.subject, emailText: d.emailText, source: d.source, bloqueo: d.bloqueo || null });
      onEvento({ tipo: 'borrador', texto: `Borrador para ${d.to}${d.bloqueo ? ` (no se le puede escribir: ${d.bloqueo})` : ''}` });
    }
  };
  const esperarVisible = tool({
    ...esperar,
    async execute(args) {
      onStart({ tool: 'esperar', args });
      const r = await esperar.execute(args);
      onCall({ tool: 'esperar', args, ok: true, summary: `Esperó ${args.segundos} s`, ms: args.segundos * 1000 });
      return r;
    },
  });
  const tools = { ...mcpToAiTools(toolsDelAgente(), { db, user }, { onCall, onStart }), esperar: esperarVisible };

  onEvento({ tipo: 'inicio', texto: `Objetivo: ${String(objetivo).slice(0, 300)}` });
  // Si el modelo principal está saturado y todavía no hizo nada, se prueba con el de respaldo. Una vez que el
  // agente llamó a alguna herramienta NO se reinicia con otro modelo: repetiría búsquedas (cupo de Places).
  const result = await conRespaldo((model, timeout) => {
    onEvento({ tipo: 'modelo', texto: `Pensando con ${model.modelId || 'Gemini'}` });
    return generar({
      model,
      system: SYSTEM,
      prompt: String(objetivo).slice(0, 1000),
      tools,
      stopWhen: stepCountIs(MAX_PASOS),
      temperature: 0.3,
      maxRetries: 0,
      timeout,
      onStepFinish: (step) => {
        const t = step?.text?.trim();
        if (t) onEvento({ tipo: 'texto', texto: t });
      },
    });
  }, {
    timeouts: [{ stepMs: 25000, totalMs: 270000 }],
    puedeReintentar: () => pasos.length === 0,
  });

  return {
    texto: result.text?.trim() || 'El agente terminó sin informe. Revisá los pasos y los borradores.',
    pasos,
    borradores,
    pasosModelo: result.steps?.length ?? null,
  };
}
