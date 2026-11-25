import { z } from 'zod';
import { tool } from 'ai';
import { agruparCatalogo, sinPrecios } from '@/lib/tienda';
import { cargarCatalogo } from '@/lib/tiendaCheckout';

// Herramientas del chat público del sitio. Venta por consulta (2026-11-25): el chat NUNCA da precios, ni con
// sesión; solo conoce los servicios (sin precios) y deriva a la tienda / a charlar con Mariano. El modelo no
// puede filtrar lo que nunca recibe.
export const SITE = 'https://marianoaliandri.com.ar';

// Link de la tienda con las piezas ya elegidas (el navegador lee `?servicios=`).
export const linkTienda = (ids) => `${SITE}/tienda/?servicios=${ids.map(encodeURIComponent).join(',')}`;

// Lista de servicios sin precios, compacta para no gastar tokens.
export function serviciosPublicos(catalogo, { texto = '' } = {}) {
  const q = texto.trim().toLowerCase();
  return agruparCatalogo(sinPrecios(catalogo)).map(c => ({
    categoria: c.category,
    servicios: c.items
      .filter(s => !q || `${s.label} ${s.desc} ${s.categoria}`.toLowerCase().includes(q))
      .map(s => ({ id: s.id, nombre: s.label, tipo: s.tipo, descripcion: s.desc, ...(s.porUnidad ? { porUnidad: true } : {}) })),
  })).filter(c => c.servicios.length);
}

export function crearHerramientasChat({ db, cargar = cargarCatalogo } = {}) {
  return {
    ver_servicios: tool({
      description: 'Lista los servicios que Mariano ofrece en la tienda (id, nombre, descripción), SIN precios. Usala para recomendar piezas concretas según lo que cuenta el cliente. `texto` filtra por palabra (ej. "pagos", "tienda").',
      inputSchema: z.object({ texto: z.string().max(60).optional().describe('Palabra para filtrar (opcional).') }),
      async execute({ texto }) {
        return { categorias: serviciosPublicos(await cargar(db), { texto }), tienda: `${SITE}/tienda/` };
      },
    }),
  };
}
