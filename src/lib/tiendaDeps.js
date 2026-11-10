// Dependencias entre piezas del catálogo de la tienda. Módulo PURO y sin precios: lo importan el servidor
// (cotizar) y el navegador (para mostrar lo que se agrega solo). No importar acá el catálogo del código:
// tiene precios y viajaría al bundle público.
//
// `requiere` de cada pieza = lista de ids que tienen que estar. Un elemento puede ser "a|b|c" = alguna de
// esas (si no hay ninguna elegida se agrega la primera activa; ej. 'db_firestore|db_supabase|db_mongodb').

export const alternativas = (req) => String(req || '').split('|').map(s => s.trim()).filter(Boolean);

// ids = lo que eligió la persona; items = catálogo plano. Devuelve:
//   ids        → elegidos + los que se agregan solos (en orden, sin repetir)
//   agregados  → { idAgregado: idQueLoPidió }
//   faltantes  → requisitos que no se pudieron cubrir (no existen o están desactivados)
export function resolverDependencias(ids, items) {
  const mapa = new Map((items || []).map(s => [s.id, s]));
  const orden = [];
  const set = new Set();
  const agregados = {};
  const faltantes = [];
  const sumar = (id, por) => { set.add(id); orden.push(id); if (por) agregados[id] = por; };
  for (const id of ids || []) if (!set.has(id)) sumar(id, null);

  for (let vuelta = 0; vuelta < 50; vuelta++) {
    let cambio = false;
    for (const id of [...orden]) {
      for (const req of mapa.get(id)?.requiere || []) {
        const alts = alternativas(req);
        if (!alts.length || alts.some(a => set.has(a))) continue;
        const elegido = alts.find(a => mapa.has(a) && mapa.get(a).activo !== false);
        if (!elegido) { if (!faltantes.includes(req)) faltantes.push(req); continue; }
        sumar(elegido, id);
        cambio = true;
      }
    }
    if (!cambio) break;
  }
  return { ids: orden, agregados, faltantes };
}
