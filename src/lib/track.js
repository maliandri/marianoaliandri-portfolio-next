// Eventos de conversión a GA4 por gtag (la propiedad de NEXT_PUBLIC_GA4_MEASUREMENT_ID, la que leen
// el dashboard y el MCP). OJO: trackGAEvent de firebaseservice.js va a la propiedad de Firebase, que
// no lee nadie — por eso generate_lead y whatsapp_click nunca aparecieron en las stats (visto 2026-10-27).
// Los nombres de eventos de los embudos están en src/data/funnels.js.

function gtag() {
  window.dataLayer = window.dataLayer || [];
  // gtag.js carga afterInteractive: si todavía no está, el evento queda en dataLayer y sale cuando cargue.
  window.dataLayer.push(arguments); // eslint-disable-line prefer-rest-params
}

export function track(name, params = {}) {
  if (typeof window === 'undefined') return;
  try {
    (window.gtag || gtag)('event', name, params);
  } catch { /* analítica nunca rompe la página */ }
}

// Vuelta desde MercadoPago: cada back_url de éxito marca la compra (una vez por sesión del navegador).
const RETORNOS = [
  ['payment', 'success', (q) => (q.get('type') === 'cv' ? 'compra_cv' : 'compra_tienda')],
  ['sub', 'success', () => 'compra_analitica'],
  ['lfp', 'success', () => 'compra_lfp'],
];

export function trackPaymentReturn(search = window.location.search) {
  const q = new URLSearchParams(search);
  for (const [param, value, eventOf] of RETORNOS) {
    if (q.get(param) !== value) continue;
    const name = eventOf(q);
    const key = `tracked_${name}_${q.get('payment_id') || q.get('preapproval_id') || ''}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* sin storage: se manda igual */ }
    track(name, { page_path: window.location.pathname });
    return;
  }
}

// Un solo listener para todo el sitio: links a WhatsApp y a /presupuesto en cualquier página
// (incluidas las de server components como /ia-para/, que no pueden tener onClick).
export function installClickTracking() {
  const onClick = (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const page_path = window.location.pathname;
    if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href)) track('whatsapp_click', { page_path, origen: 'link' });
    else if (/^(https:\/\/marianoaliandri\.com\.ar)?\/presupuesto\/?(\?|$)/.test(href)) track('cta_presupuesto', { page_path });
  };
  document.addEventListener('click', onClick, { capture: true });
  return () => document.removeEventListener('click', onClick, { capture: true });
}
