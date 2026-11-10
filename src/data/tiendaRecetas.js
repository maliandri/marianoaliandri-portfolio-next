// Puntos de partida de la tienda: atajos que preseleccionan piezas del catálogo (solo ids, sin precios).
// Los ids que no existan o estén desactivados en Firestore se ignoran; las dependencias se suman solas.
export const RECETAS = [
  { label: 'Landing para mostrar tu negocio', ids: ['base_sitio', 'sec_portada', 'sec_servicios', 'sec_nosotros', 'sec_testimonios', 'contact_form', 'domain', 'deploy_vercel'] },
  { label: 'Sitio con varias páginas', ids: ['base_sitio', 'sec_portada', 'sec_servicios', 'sec_nosotros', 'sec_galeria', 'sec_faq', 'sec_ubicacion', 'sec_pagina', 'contact_form', 'seo_technical', 'domain', 'email_setup', 'deploy_vercel'] },
  { label: 'Tienda online que cobra', ids: ['base_sitio', 'catalogo_productos', 'carrito', 'payments_mp', 'inventory', 'domain', 'deploy_vercel'] },
  { label: 'Tu negocio conectado a Claude', ids: ['claude_mcp', 'admin_panel', 'db_supabase', 'deploy_vercel'] },
];

// Links viejos /tienda/<producto> → piezas equivalentes del catálogo nuevo.
export const PRODUCTOS_VIEJOS = {
  'landing-page-professional': ['base_sitio', 'sec_portada', 'sec_servicios', 'sec_nosotros', 'contact_form'],
  'website-corporate': ['base_sitio', 'sec_portada', 'sec_servicios', 'sec_nosotros', 'sec_galeria', 'sec_pagina', 'contact_form', 'seo_technical'],
  'ecommerce-basic': ['base_sitio', 'catalogo_productos', 'carrito', 'payments_mp'],
  'website-chatbot-ia': ['base_sitio', 'sec_portada', 'sec_servicios', 'contact_form', 'ai_chatbot'],
  'dashboard-powerbi-basic': ['powerbi'],
  'custom-development': ['admin_panel', 'user_auth', 'db_firestore'],
};
