// Selector de audiencia del menú: cada opción es una página propia (SEO), no un estado del cliente.
// La primera es la que ve quien entra al sitio. Ver docs/superpowers/specs/2026-11-23-reposicionamiento-ia.md.

export const AUDIENCIAS = [
  { id: 'ia',           label: 'IA para tu negocio', short: 'IA',           href: '/' },
  { id: 'webs',         label: 'Sitios web',         short: 'Webs',         href: '/sitios-web' },
  { id: 'devs',         label: 'Desarrolladores',    short: 'Devs',         href: '/desarrolladores' },
  { id: 'herramientas', label: 'Herramientas',       short: 'Herramientas', href: '/herramientas' },
];

// Rutas que pertenecen a cada audiencia además de su página principal.
const PREFIJOS = {
  ia: ['/ia-para'],
  webs: ['/sitios-web', '/tienda', '/web', '/proyectos'],
  devs: ['/desarrolladores', '/lead-finder-pro', '/en/lead-finder-pro', '/analitica', '/keywords'],
  herramientas: ['/herramientas', '/ats', '/roi', '/kpi', '/radarweb', '/stats', '/labs'],
};

const dentroDe = (path, prefijo) => path === prefijo || path.startsWith(`${prefijo}/`);

// Devuelve el id de la audiencia de una ruta, o null si la ruta no es de ninguna (aprende, auditorías…).
export function audienciaActiva(pathname) {
  const path = (pathname || '/').replace(/\/+$/, '') || '/';
  if (path === '/') return 'ia';
  for (const [id, prefijos] of Object.entries(PREFIJOS)) {
    if (prefijos.some(p => dentroDe(path, p))) return id;
  }
  return null;
}
