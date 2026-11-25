// Explicación instantánea (sin IA) de un servicio cuando el cliente lo marca en la tienda. Módulo puro y liviano:
// lo importa el navegador, así que no puede traer la librería de IA ni precios.

export function explicacionAlMarcar(item = {}, { agregadoPor = null } = {}) {
  const f = item.ficha || null;
  const partes = [];
  partes.push(`**${item.label || 'Este servicio'}** 👍`);
  partes.push(f?.paraQue || item.benefit || item.desc || 'Te lo explico en la reunión.');
  if (f?.ejemplo) partes.push(`Por ejemplo: ${f.ejemplo}`);
  if (agregadoPor) partes.push(`Lo sumé porque lo necesita ${agregadoPor}.`);
  return partes.join('\n');
}
