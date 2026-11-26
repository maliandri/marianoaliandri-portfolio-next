// Auditoría como carta de presentación (2026-11-26): el listado público /auditorias ya no existe;
// a cada negocio se le manda SU link (/auditorias/<id>/?k=<clave>&para=<negocioId>; sin la clave
// del informe da 404, ver src/lib/auditClave.js), que resalta su fila,
// le muestra su puesto contra la competencia y le ofrece los servicios. Lógica pura: la usan la
// página pública (cliente), el panel admin, el mail y el MCP.

export const SITE_URL = 'https://marianoaliandri.com.ar';
export const WHATSAPP_MARIANO = '5492995414422';

// Lo que se ofrece en el informe y en los mensajes. Sin precios (la tienda es venta por consulta).
export const SERVICIOS_OFERTA = [
  { id: 'web',     icon: '⚡', titulo: 'Una web nueva, rápida y bien armada para Google', desc: 'Hecha con Next.js: carga al instante, se ve bien en el celular y trae de fábrica todo lo que tu web hoy no tiene (sitemap, descripciones, vista linda al compartirla).' },
  { id: 'backend', icon: '🗄️', titulo: 'Tu propio sistema con base de datos', desc: 'Clientes, pedidos, stock o turnos en un panel tuyo, en la nube. Sin planillas sueltas ni depender de nadie para cargar algo.' },
  { id: 'redes',   icon: '📣', titulo: 'Publicar en tus redes desde tu panel', desc: 'Cargás un producto o una novedad una vez y sale en Instagram, Facebook y LinkedIn.' },
  { id: 'bot',     icon: '🤖', titulo: 'Un bot que atiende por vos', desc: 'Responde consultas, toma pedidos o turnos y te avisa, aunque sea domingo a la noche.' },
  { id: 'ia',      icon: '💬', titulo: 'Tu negocio conectado a Claude o ChatGPT', desc: 'Le preguntás "¿cuántas visitas tuve ayer?", "¿cuántos compraron?", "¿cuántos carritos quedaron abandonados?" y te contesta con los datos reales de tu sistema.' },
];

export function auditoriaLink(auditoriaId, negocioId, clave) {
  const qs = [clave && `k=${encodeURIComponent(clave)}`, negocioId && `para=${encodeURIComponent(negocioId)}`].filter(Boolean).join('&');
  return `${SITE_URL}/auditorias/${encodeURIComponent(auditoriaId)}/${qs ? `?${qs}` : ''}`;
}

// Puesto del negocio entre los que tienen score (1 = mejor). null si no está o no tiene score.
export function posicionEnAuditoria(results, negocioId) {
  const conScore = (results || []).filter(r => typeof r?.seoScore === 'number');
  const neg = conScore.find(r => r.id === negocioId);
  if (!neg) return null;
  const mejores = conScore.filter(r => r.seoScore > neg.seoScore).length;
  const suma = conScore.reduce((s, r) => s + r.seoScore, 0);
  return {
    puesto: mejores + 1,
    total: conScore.length,
    score: neg.seoScore,
    promedio: Math.round(suma / conScore.length),
    mejorScore: Math.max(...conScore.map(r => r.seoScore)),
  };
}

// Solo dígitos; un número argentino sin el 54 adelante se completa como celular (549...).
export function normalizarWhatsapp(numero) {
  let d = String(numero || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('0')) d = d.slice(1);
  if (!d.startsWith('54') && d.length === 10) d = `549${d}`;
  return d.length >= 8 ? d : null;
}

export function whatsappUrl(numero, texto) {
  const n = normalizarWhatsapp(numero);
  const q = texto ? `?text=${encodeURIComponent(texto)}` : '';
  return n ? `https://wa.me/${n}${q}` : `https://wa.me/${q}`;
}

const rubroDe = (auditoria) => (auditoria?.config?.tiposLabels || [])[0] || null;
const zonaDe = (auditoria, neg) => neg?.ciudad || (auditoria?.config?.ciudades || [])[0] || null;

// Mensaje corto para WhatsApp (o para pegar en un DM). Plantilla sin IA: sale al instante y se edita.
export function mensajeWhatsapp({ neg, auditoria, link }) {
  const rubro = rubroDe(auditoria);
  const zona = zonaDe(auditoria, neg);
  const pos = posicionEnAuditoria(auditoria?.results, neg?.id);
  const competencia = [rubro && `de ${rubro.toLowerCase()}`, zona && `en ${zona}`].filter(Boolean).join(' ');
  const lineas = [
    `Hola, ¿qué tal? Soy Mariano Aliandri, desarrollador${zona ? ` de la zona` : ''}.`,
    `Le preparé a ${neg?.nombre || 'tu negocio'} una auditoría de cómo aparece en Google comparado con los demás negocios${competencia ? ` ${competencia}` : ''}.`,
  ];
  if (pos) {
    lineas.push(`Su web quedó ${pos.puesto}° de ${pos.total}, con ${pos.score}/100 (el promedio de la zona es ${pos.promedio}).`);
  }
  lineas.push(`Acá la pueden ver, con su lugar marcado: ${link}`);
  lineas.push('Ahí también les cuento qué les puedo hacer: una web nueva más rápida, un sistema propio, publicar en redes desde un panel, un bot que atiende y conectar el negocio a Claude o ChatGPT para consultarle los números. Si les interesa, lo charlamos sin compromiso.');
  return lineas.join('\n\n');
}

// Texto del botón de WhatsApp de la página pública (lo manda el cliente a Mariano).
export function mensajeDesdeInforme(nombre) {
  return nombre
    ? `Hola Mariano, soy de ${nombre}. Vi la auditoría que me preparaste y quiero saber más.`
    : 'Hola Mariano, vi una de tus auditorías y quiero saber más.';
}
