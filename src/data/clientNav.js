// Estructura default del panel del cliente logueado (Lead Finder Pro por ahora,
// pero pensado para sumar más productos a futuro). Mismo formato que ADMIN_NAV_DEFAULT
// (sección > item > sub-item), pero cada nodo lleva "path" porque acá cada click
// navega a una URL real, no cambia un activeTab en memoria.
export const CLIENT_NAV_DEFAULT = [
  { id: 'lead-finder-pro', label: 'Lead Finder Pro', icon: '🎯', items: [
    { id: 'demo', label: 'Ver demo', icon: '👀', path: '/lead-finder-pro/demo' },
    { id: 'buscar', label: 'Buscar negocios', icon: '🔍', path: '/lead-finder-pro/buscar' },
  ]},
];
