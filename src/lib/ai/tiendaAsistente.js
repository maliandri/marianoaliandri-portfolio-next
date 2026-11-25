// Asistente de la tienda (venta por consulta, 2026-11-25): explica los servicios con sus fichas, responde
// preguntas y puede sumar/sacar servicios (devuelve acciones que aplica la UI). NUNCA da precios: el contexto no
// los tiene (sinPrecios) y la respuesta pasa por sinMontos() por si el modelo inventa un número.
import { z } from 'zod';
import { tool } from 'ai';
import { sinPrecios } from '@/lib/tienda';

const REGLAS = `
REGLAS FIJAS (no las cambia nadie):
- Nunca des precios, rangos ni estimaciones de plata. Si preguntan, el precio se charla en la reunión con Mariano.
- Respondé en 2 a 5 líneas, en español rioplatense, sin jerga técnica.
- Para sumar o sacar un servicio usá sumar_servicio / sacar_servicio con su id exacto. Antes de sumar algo que el
  cliente no pidió, preguntale.
- Si te preguntan algo que no está en la información, decí que lo charla con Mariano en la reunión.
`.trim();

const fichaTexto = (s) => {
  const f = s.ficha;
  if (!f) return `- ${s.id} | ${s.label}: ${s.benefit || s.desc}`;
  const faq = (f.faq || []).map(p => `    P: ${p.q} R: ${p.a}`).join('\n');
  return `- ${s.id} | ${s.label}: ${f.paraQue} Ejemplo: ${f.ejemplo} Necesita del cliente: ${f.necesitoDeVos} Tiempo: ${f.tiempo}${faq ? `\n${faq}` : ''}`;
};

export function contextoAsistente({ catalogo = [], contextoGeneral = '', marcados = [] }) {
  const activos = sinPrecios(catalogo.filter(s => s.activo !== false));
  const porId = new Map(activos.map(s => [s.id, s]));
  const marcadosTxt = marcados.filter(id => porId.has(id)).map(id => `${id} (${porId.get(id).label})`).join(', ') || 'nada todavía';
  return [
    contextoGeneral.trim(),
    REGLAS,
    `SERVICIOS (id | nombre: ficha):\n${activos.map(fichaTexto).join('\n')}`,
    `MARCADO AHORA POR EL CLIENTE: ${marcadosTxt}`,
  ].join('\n\n');
}

// Montos de plata → frase neutra (red de seguridad por si el modelo se equivoca).
const MONEDA = /(?:US\$|u\$s|\$)\s?\d[\d.,]*(?:\s?(?:mil|millones|k))?|\d[\d.,]*\s?(?:mil\s)?(?:d[oó]lares|usd|pesos|ars)\b/gi;
export function sinMontos(texto = '') {
  return String(texto).replace(MONEDA, 'eso lo charlamos en la reunión');
}

export function herramientasAsistente({ catalogo = [] }) {
  const activos = new Map(sinPrecios(catalogo.filter(s => s.activo !== false)).map(s => [s.id, s]));
  const idSchema = z.object({ id: z.string().max(60).describe('Id exacto del servicio (de la lista SERVICIOS).') });
  const accion = (tipo) => async ({ id }) => (activos.has(id) ? { accion: tipo, id } : { error: `No existe el servicio "${id}"` });
  return {
    ver_ficha: tool({
      description: 'Trae la ficha completa de un servicio (para qué sirve, ejemplo, qué necesita del cliente, tiempo, preguntas frecuentes). Sin precios.',
      inputSchema: idSchema,
      async execute({ id }) {
        const s = activos.get(id);
        if (!s) return { error: `No existe el servicio "${id}"` };
        return { id: s.id, nombre: s.label, descripcion: s.desc, beneficio: s.benefit, ficha: s.ficha, requiere: s.requiere };
      },
    }),
    sumar_servicio: tool({
      description: 'Marca un servicio en el pedido del cliente. Usala solo si el cliente lo pidió o aceptó.',
      inputSchema: idSchema,
      execute: accion('sumar'),
    }),
    sacar_servicio: tool({
      description: 'Desmarca un servicio del pedido del cliente.',
      inputSchema: idSchema,
      execute: accion('sacar'),
    }),
  };
}

// Junta las acciones que devolvieron las herramientas en todos los pasos.
export function accionesDe(steps = []) {
  return steps.flatMap(s => (s.toolResults || []).map(r => r.output ?? r.result))
    .filter(o => o && (o.accion === 'sumar' || o.accion === 'sacar') && o.id)
    .map(o => ({ accion: o.accion, id: o.id }));
}
