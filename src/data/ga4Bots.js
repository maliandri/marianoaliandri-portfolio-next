// Ciudades de data centers (Meta, Google, AWS) que GA4 cuenta como usuarios.
// Casi todo es el crawler de Facebook/Instagram abriendo los links que publica
// el bot de noticias (llegan como referral de facebook.com / m.facebook.com).
// Visto en GA4 2026-10-23: ~400 de 432 "usuarios" venían de estas ciudades.
export const GA4_BOT_CITIES = [
  'Prineville', 'Forest City', 'Fort Worth', 'Lulea', 'Dublin', 'Altoona',
  'Gallatin', 'Springfield', 'Boardman', 'Council Bluffs', 'Flint Hill',
  'Des Moines', 'Glenview', 'Ashburn', 'The Dalles', 'Papillion',
  'Los Lunas', 'Eagle Mountain', 'Henrico', 'New Albany', 'Clonee', 'Odense',
];

// Páginas privadas (las visita el dueño o clientes logueados): no cuentan
// como "qué vio la gente".
export const GA4_PRIVATE_PATH_PREFIXES = [
  '/admin', '/dashboard', '/mis-compras', '/mi-cuenta', '/perfil', '/compras', '/analitica',
];
