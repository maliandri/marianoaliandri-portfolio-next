// Grupos de la tienda por OBJETIVO del cliente (venta por consulta, 2026-11-25): alguien que no sabe de webs
// piensa en "vender online" o "que me encuentren", no en "Funcionalidades" o "Infraestructura". Se agrupa por id
// de servicio; un servicio nuevo que no esté en ninguna lista cae por su categoría (POR_CATEGORIA).
// Módulo puro, sin precios: lo usan el servidor y el navegador.

export const GRUPOS = [
  { id: 'mostrar', label: 'Mostrar tu negocio', emoji: '🏪', ids: ['base_sitio', 'sec_portada', 'sec_servicios', 'sec_nosotros', 'sec_galeria', 'sec_testimonios', 'sec_faq', 'sec_ubicacion', 'sec_pagina', 'contact_form', 'blog', 'search', 'multilang', 'maps_leaflet', 'qr_code'] },
  { id: 'vender', label: 'Vender online', emoji: '🛒', ids: ['catalogo_productos', 'carrito', 'inventory', 'sec_precios', 'memberships'] },
  { id: 'cobros', label: 'Cobros', emoji: '💳', ids: ['payments_mp', 'payments_payway', 'payments_nave', 'payments_bind'] },
  { id: 'google', label: 'Que te encuentren en Google', emoji: '🔎', ids: ['seo_technical', 'seo_meta', 'seo_schema', 'seo_gsc', 'seo_speed', 'analytics_ga', 'gsc_dashboard'] },
  { id: 'gestion', label: 'Turnos, clientes y gestión', emoji: '📋', ids: ['booking', 'calendar_system', 'crm_basic', 'admin_panel', 'user_auth', 'powerbi', 'recharts_dashboard', 'excel_automation', 'excel_export', 'pdf_export', 'google_sheets', 'mobile_app', 'mobile_pwa'] },
  { id: 'ia', label: 'IA para tu negocio', emoji: '🤖', ids: ['claude_mcp', 'ai_chatbot', 'ai_content', 'ai_document', 'tts', 'lead_finder', 'scraping'] },
  { id: 'redes', label: 'Redes y avisos', emoji: '📣', ids: ['social_instagram', 'social_facebook', 'social_linkedin', 'reel_generator', 'post_generator', 'cron_social', 'make_automations', 'whatsapp_api'] },
  { id: 'tecnico', label: 'Lo técnico que tu web necesita', emoji: '🧰', ids: ['domain', 'email_setup', 'ssl_cdn', 'deploy_vercel', 'db_firestore', 'db_supabase', 'db_mongodb', 'api_custom', 'backend_nodejs', 'webhooks'] },
];

const POR_ID = new Map(GRUPOS.flatMap(g => g.ids.map(id => [id, g.id])));

// Respaldo para servicios nuevos: palabra de la categoría → grupo.
const POR_CATEGORIA = [
  [/seo|posicionamiento/i, 'google'],
  [/redes|automatiz/i, 'redes'],
  [/\bia\b|procesamiento/i, 'ia'],
  [/infraestructura|deploy|base de datos|backend/i, 'tecnico'],
  [/analytics|datos|documentos|export/i, 'gestion'],
  [/tienda/i, 'vender'],
];

export function grupoDe(item = {}) {
  if (POR_ID.has(item.id)) return POR_ID.get(item.id);
  const cat = String(item.categoria || '');
  return POR_CATEGORIA.find(([re]) => re.test(cat))?.[1] || 'mostrar';
}

// Lista plana → [{ id, label, emoji, items }] en el orden de GRUPOS, sin inactivos ni grupos vacíos.
export function agruparPorObjetivo(items = []) {
  const porGrupo = new Map(GRUPOS.map(g => [g.id, []]));
  for (const it of items) if (it.activo !== false) porGrupo.get(grupoDe(it)).push(it);
  return GRUPOS.filter(g => porGrupo.get(g.id).length).map(({ ids, ...g }) => ({ ...g, items: porGrupo.get(g.id) })); // eslint-disable-line no-unused-vars
}
