// Prospectos de Instagram: negocios del Lead Finder con @ de Instagram a los que Mariano
// les escribe por DM (a mano — los DMs automáticos hacen banear la cuenta). Acá vive lo puro:
// estados del seguimiento, qué se guarda de cada lead y el texto del DM (prompt + plantilla).

export const ESTADOS = [
  { id: 'pendiente',  label: 'Pendiente' },
  { id: 'contactado', label: 'Contactado' },
  { id: 'respondio',  label: 'Respondió' },
  { id: 'cliente',    label: 'Cliente' },
  { id: 'descartado', label: 'Descartado' },
];
export const ESTADO_IDS = ESTADOS.map(e => e.id);

export const MAX_DM_CHARS = 600;

// Lo que se guarda de un lead en ig_prospectos/{handle} (sin teléfono ni dirección: no hacen falta).
export function prospectoFromLead(lead) {
  return {
    handle: lead.instagram,
    placeId: lead.id ?? null,
    nombre: lead.nombre || lead.instagram,
    ciudad: lead.ciudad || null,
    tipo: lead.tipo || null,
    siteUrl: lead.siteUrl || null,
    seoScore: typeof lead.seoScore === 'number' ? lead.seoScore : null,
  };
}

const anioDe = (iso) => {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms).getFullYear() : null;
};

// El hallazgo más fácil de entender para un dueño de negocio (no "sitemap" ni "Open Graph").
export function hallazgoPrincipal(lead) {
  if (!lead.siteUrl) {
    return 'no tienen página web: quien los encuentra en Google Maps no tiene dónde ver lo que hacen, precios o trabajos';
  }
  const anio = anioDe(lead.lastUpdated);
  if (anio && anio <= new Date().getFullYear() - 2) {
    return `la web parece no actualizarse desde ${anio}`;
  }
  if (!lead.metaDesc) {
    return 'cuando la web aparece en Google no muestra ninguna descripción del negocio, así que mucha gente no hace clic';
  }
  if (!lead.hasOG) {
    return 'cuando alguien comparte el link de la web por WhatsApp o redes no aparece ni foto ni descripción';
  }
  if (typeof lead.seoScore === 'number' && lead.seoScore < 70) {
    return `la web tiene algunos detalles técnicos que la hacen aparecer más abajo en Google (le di ${lead.seoScore}/100)`;
  }
  return null;
}

export function buildDmPrompt(lead) {
  const hallazgo = hallazgoPrincipal(lead);
  return `Escribí un mensaje directo de Instagram (DM) de Mariano Aliandri, desarrollador de Neuquén que hace páginas web y sistemas a medida para pymes, para el negocio "${lead.nombre}"${lead.tipo ? ` (rubro: ${lead.tipo})` : ''}${lead.ciudad ? ` de ${lead.ciudad}` : ''}.

${hallazgo ? `Lo que Mariano notó revisando su presencia online: ${hallazgo}.` : 'Su web está bastante bien; el mensaje ofrece ideas para conseguir más consultas desde Instagram y Google.'}

Reglas:
- Español rioplatense, con voseo, tono de persona real y cercano (no de agencia ni de vendedor).
- Máximo 4 oraciones cortas y menos de 450 caracteres.
- Saludá al negocio por su nombre y presentate en una línea.
- Mencioná el hallazgo concreto en palabras simples, sin tecnicismos.
- Ofrecé algo gratis y sin compromiso (un mini informe o una idea concreta), no vendas un servicio ni pongas precios.
- Terminá con una pregunta corta que se responda fácil (ej. "¿te lo paso?").
- Sin links, sin hashtags, como mucho un emoji. No inventes datos que no estén acá.

Devolvé solo el texto del mensaje.`;
}

export function dmTemplate(lead) {
  const hallazgo = hallazgoPrincipal(lead);
  const saludo = `¡Hola, ${lead.nombre}! Soy Mariano, desarrollador de Neuquén: hago webs y sistemas para pymes.`;
  const medio = hallazgo
    ? `Estuve mirando cómo aparecen online y vi que ${hallazgo}.`
    : 'Estuve mirando cómo aparecen online y tengo un par de ideas para que les lleguen más consultas.';
  return `${saludo} ${medio} Les armé un mini informe gratis con qué mejoraría, ¿se lo paso?`;
}

// Gemini a veces devuelve comillas envolventes o se pasa de largo.
export function cleanDm(text) {
  let t = String(text || '').trim().replace(/^["“”']+|["“”']+$/g, '').trim();
  if (t.length > MAX_DM_CHARS) {
    const corte = t.slice(0, MAX_DM_CHARS);
    const fin = Math.max(corte.lastIndexOf('?'), corte.lastIndexOf('.'), corte.lastIndexOf('!'));
    t = fin > 100 ? corte.slice(0, fin + 1) : corte;
  }
  return t;
}
