// Asesor del informe privado de auditoría (2026-11-26): el chat que va al costado de
// /auditorias/<id>/?k=&para=. Le habla al dueño del negocio sobre SU web y su lugar contra la
// competencia, explica en criollo lo que se le puede hacer y lo lleva a pedir el presupuesto ahí
// mismo (la herramienta abre el formulario en la pantalla). Nunca da precios: misma red que la tienda.
import { z } from 'zod';
import { tool } from 'ai';
import { SERVICIOS_OFERTA, posicionEnAuditoria } from '@/lib/auditPitch';
import { problemasSeo, nivelSeo } from '@/lib/bizEmail';

export { sinMontos } from '@/lib/ai/tiendaAsistente';

const REGLAS = `
REGLAS FIJAS:
- Sos el asistente de Mariano Aliandri (desarrollador full stack de Neuquén). Hablás en español rioplatense (vos),
  cercano, sin vender humo. Respuestas de 2 a 6 líneas. Podés usar **negrita** para lo importante. Sin listas largas.
- Nunca des precios, rangos ni plazos en plata. El precio lo arma Mariano después de una charla corta.
- Usá SOLO los datos de este informe. No inventes visitas, ventas ni números que no estén acá.
- Si te preguntan qué es algo técnico, explicalo con un ejemplo de SU negocio:
  · Next.js: la tecnología con la que se hacen webs rápidas (la usan Netflix o TikTok); carga al instante y Google la entiende mejor.
  · Base de datos / backend: el "cerebro" del negocio en la nube: clientes, pedidos, stock o turnos en un panel propio.
  · Agente de IA: un asistente que no solo contesta, también HACE cosas (busca un pedido, carga un turno, avisa por WhatsApp).
  · RAG: darle a la IA tus propios datos (catálogo, precios, preguntas frecuentes, ventas) para que conteste con TU
    información y no con cosas genéricas de internet.
  · Conectarlo a Claude o ChatGPT (por MCP): le preguntás en el celular "¿cuántas visitas tuve ayer?", "¿cuántos compraron?",
    "¿cuántos carritos quedaron abandonados?" y te contesta con los números reales de tu sistema.
- Tu objetivo: que entienda qué gana y quiera pedir el presupuesto. Cuando muestre interés ("me interesa", "cuánto sale",
  "quiero", "dale"), usá la herramienta abrir_formulario con los servicios que charlaron y decile que deje su contacto.
- Si pregunta algo que no sabés, decí que lo charla con Mariano.
`.trim();

const fmtNeg = (r) => `${r.nombre} (${r.ciudad || 's/ciudad'}): ${r.seoScore ?? '—'}/100${r.siteUrl ? `, ${r.siteUrl}` : ''}`;

export function contextoAsesor({ auditoria, negocioId }) {
  const results = (auditoria?.results || []).filter(r => r && r.nombre);
  const neg = results.find(r => r.id === negocioId) || null;
  const pos = neg ? posicionEnAuditoria(results, neg.id) : null;
  const ranking = [...results].filter(r => typeof r.seoScore === 'number').sort((a, b) => b.seoScore - a.seoScore);
  const rubro = (auditoria?.config?.tiposLabels || []).join(', ') || 'negocios locales';
  const zona = (auditoria?.config?.ciudades || []).join(', ') || 'la zona';

  const bloqueNeg = neg
    ? [
      `ESTÁS HABLANDO CON: ${neg.nombre}${neg.ciudad ? ` (${neg.ciudad})` : ''}. Web: ${neg.siteUrl || 'sin web'}.`,
      `Su score SEO: ${neg.seoScore ?? '—'}/100 (nivel ${nivelSeo(neg.seoScore)})${pos ? `, puesto ${pos.puesto} de ${pos.total}; promedio de la zona ${pos.promedio}, el mejor tiene ${pos.mejorScore}` : ''}.`,
      `Lo que le falta a su web: ${problemasSeo(neg).join('; ') || 'nada grave, detalles finos'}.`,
      neg.lastModified ? `Última actualización detectada de su web: ${String(neg.lastModified).slice(0, 10)}.` : '',
    ].filter(Boolean).join('\n')
    : 'No sabemos qué negocio es: preguntale cuál es el suyo (está en la tabla) antes de comparar.';

  return [
    REGLAS,
    `INFORME: ${auditoria?.title || 'Auditoría SEO'}. Rubro: ${rubro}. Zona: ${zona}. ${results.length} negocios analizados, promedio ${auditoria?.stats?.avgSeoScore ?? '—'}/100.`,
    bloqueNeg,
    `LOS MEJORES DEL INFORME:\n${ranking.slice(0, 3).map(fmtNeg).join('\n') || '—'}`,
    `QUÉ LE PODEMOS HACER (id | servicio: para qué):\n${SERVICIOS_OFERTA.map(s => `- ${s.id} | ${s.titulo}: ${s.desc}`).join('\n')}`,
  ].join('\n\n');
}

export function herramientasAsesor() {
  const ids = SERVICIOS_OFERTA.map(s => s.id);
  return {
    abrir_formulario: tool({
      description: 'Abre en la pantalla del cliente el formulario para pedir el presupuesto, con los servicios que le interesaron ya marcados. Usala cuando el cliente muestre interés.',
      inputSchema: z.object({
        servicios: z.array(z.enum(ids)).max(ids.length).describe('Ids de los servicios que charlaron.'),
      }),
      async execute({ servicios }) {
        return { accion: 'formulario', servicios: [...new Set(servicios)] };
      },
    }),
  };
}

export function formularioDe(steps = []) {
  const outs = steps.flatMap(s => (s.toolResults || []).map(r => r.output ?? r.result));
  const f = outs.reverse().find(o => o?.accion === 'formulario');
  return f ? { servicios: f.servicios || [] } : null;
}

// Primer mensaje del chat, sin IA (sale al instante).
export function saludoAsesor({ auditoria, negocioId }) {
  const results = auditoria?.results || [];
  const neg = results.find(r => r.id === negocioId);
  if (!neg) {
    return 'Hola 👋 Soy el asistente de Mariano. Este informe compara cómo aparecen en Google los negocios de la zona. ¿Cuál es el tuyo? Te cuento cómo estás y qué se puede mejorar.';
  }
  const pos = posicionEnAuditoria(results, neg.id);
  const lugar = pos ? ` Tu web quedó **${pos.puesto}° de ${pos.total}**, con ${pos.score}/100 (el promedio es ${pos.promedio}).` : '';
  return `Hola ${neg.nombre} 👋 Soy el asistente de Mariano y te preparamos este informe.${lugar}\n¿Querés que te cuente qué le cambiaría a tu web y qué más se puede hacer para que te lleguen más clientes?`;
}
