// Embudos de conversión. Cada paso es una página vista (`page`, prefijo de pagePath) o un evento
// (`event`, mandado con track() de src/lib/track.js), opcionalmente solo en ciertas páginas (`page`).
// Se cuentan personas (activeUsers de GA4, sin bots), no eventos: un usuario que toca 3 veces cuenta 1.
// Para sumar un paso: disparar el evento con track() y agregarlo acá.
export const FUNNELS = [
  {
    id: 'presupuesto', titulo: 'Presupuesto',
    pasos: [
      { label: 'Entraron a /presupuesto', page: '/presupuesto' },
      { label: 'Completaron sus datos', event: 'presupuesto_datos' },
      { label: 'Eligieron servicios', event: 'presupuesto_servicios' },
      { label: 'Enviaron el pedido', event: 'generate_lead' },
    ],
  },
  {
    id: 'ia_para', titulo: 'IA para empresas',
    pasos: [
      { label: 'Entraron a /ia-para/', page: '/ia-para' },
      { label: 'Tocaron WhatsApp', event: 'whatsapp_click', page: '/ia-para' },
      { label: 'Tocaron "Pedir presupuesto"', event: 'cta_presupuesto', page: '/ia-para' },
    ],
  },
  {
    id: 'aprende', titulo: 'Aprendé (bot de contenido)',
    pasos: [
      { label: 'Entraron a /aprende', page: '/aprende' },
      { label: 'Tocaron WhatsApp', event: 'whatsapp_click', page: '/aprende' },
      { label: 'Tocaron "Pedir presupuesto"', event: 'cta_presupuesto', page: '/aprende' },
    ],
  },
  {
    id: 'demanda', titulo: 'Informes de demanda',
    pasos: [
      { label: 'Entraron a /demanda', page: '/demanda' },
      { label: 'Tocaron WhatsApp', event: 'whatsapp_click', page: '/demanda' },
      { label: 'Tocaron "Pedir presupuesto"', event: 'cta_presupuesto', page: '/demanda' },
    ],
  },
  {
    id: 'tienda', titulo: 'Tienda',
    pasos: [
      // Venta por consulta (2026-11-25): marcan servicios, piden presupuesto y, si quieren, un Meet.
      { label: 'Entraron a /tienda', page: '/tienda' },
      { label: 'Marcaron un servicio', event: 'add_to_cart' },
      { label: 'Abrieron el pedido', event: 'abrir_solicitud' },
      { label: 'Pidieron presupuesto', event: 'solicitud_presupuesto' },
      { label: 'Pidieron Meet', event: 'meet_pedido' },
    ],
  },
  {
    id: 'presupuesto_cliente', titulo: 'Presupuesto enviado al cliente',
    pasos: [
      { label: 'Abrieron su presupuesto', event: 'ver_presupuesto' },
      { label: 'Tocaron pagar', event: 'begin_checkout', page: '/tu-presupuesto' },
    ],
  },
  {
    id: 'analitica', titulo: 'Analítica (suscripción)',
    pasos: [
      { label: 'Entraron a /analitica o /keywords', page: ['/analitica', '/keywords'] },
      { label: 'Fueron a pagar', event: 'checkout_analitica' },
      { label: 'Pagaron', event: 'compra_analitica' },
    ],
  },
  {
    id: 'lfp', titulo: 'Lead Finder Pro',
    pasos: [
      { label: 'Entraron a /lead-finder-pro', page: '/lead-finder-pro' },
      { label: 'Fueron a pagar', event: 'checkout_lfp' },
      { label: 'Pagaron', event: 'compra_lfp' },
    ],
  },
];

// Contactos sueltos (no son un embudo de pasos): se muestran como totales.
export const CONTACT_EVENTS = [
  { event: 'whatsapp_click', label: 'Clicks a WhatsApp (todo el sitio)' },
  { event: 'cta_presupuesto', label: 'Clicks a "Pedir presupuesto"' },
  { event: 'generate_lead', label: 'Presupuestos enviados' },
  { event: 'compra_cv', label: 'Pagos de análisis de CV' },
];
