import { z } from 'zod';
import { tool } from 'ai';
import { agruparCatalogo, sinPrecios, cotizar, MODOS } from '@/lib/tienda';
import { cargarCatalogo, loadSenaPct } from '@/lib/tiendaCheckout';
import { dolarOficialVenta } from '@/lib/dolar';

// Herramientas del chat público del sitio. Regla de la tienda: los PRECIOS solo con sesión de Google.
// Sin sesión, `cotizar` no devuelve ningún número (el modelo no puede filtrar lo que nunca recibió) y
// avisa que hay que iniciar sesión; la ruta lo marca (`needsLogin`) para mostrar el botón de ingreso.
export const SITE = 'https://marianoaliandri.com.ar';

const MAX_IDS = 15;
const redondear = (n) => Math.round(n * 100) / 100;

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

// Cotización para el chat: total en USD y en pesos con pago total (10% off) y con seña. Tira si no cierra.
export function cotizacionParaChat({ ids, cantidades, catalogo, cotizacion, senaPct }) {
  const conDolar = cotizacion > 0;
  // `cotizar` se niega a calcular montos de cobro sin dólar. Para informar en USD alcanza con el modo
  // presupuesto (arma los ítems y el subtotal, resolviendo dependencias) y aplicar el 10% y la seña a mano.
  const base = cotizar({ ids, cantidades, modo: 'presupuesto', catalogo, cotizacion: null, senaPct });
  const total = conDolar
    ? cotizar({ ids, cantidades, modo: 'total', catalogo, cotizacion, senaPct })
    : { totalUSD: redondear(base.subtotalUSD * (1 - MODOS.total.descuento)) };
  const sena = conDolar
    ? cotizar({ ids, cantidades, modo: 'sena', catalogo, cotizacion, senaPct })
    : { aPagarUSD: redondear(base.subtotalUSD * senaPct) };
  return {
    items: base.items.map(i => ({ id: i.id, nombre: i.label, usd: i.priceUSD, ...(i.agregadoPor ? { agregadoPorDependencia: true } : {}) })),
    subtotalUSD: base.subtotalUSD,
    pagoTotal: { descuento: '10%', totalUSD: total.totalUSD, ...(total.totalARS != null ? { totalARS: total.totalARS } : {}) },
    sena: { porcentaje: Math.round(senaPct * 100), aPagarUSD: sena.aPagarUSD, ...(sena.aPagarARS != null ? { aPagarARS: sena.aPagarARS } : {}) },
    cotizacionDolar: conDolar ? cotizacion : null,
    linkTienda: linkTienda(base.items.map(i => i.id)),
  };
}

export function crearHerramientasChat({
  db, user = null,
  cargar = cargarCatalogo, cargarSena = loadSenaPct, dolar = dolarOficialVenta,
} = {}) {
  return {
    ver_servicios: tool({
      description: 'Lista los servicios que Mariano ofrece en la tienda (id, nombre, descripción), SIN precios. Usala para recomendar piezas concretas según lo que cuenta el cliente. `texto` filtra por palabra (ej. "pagos", "tienda").',
      inputSchema: z.object({ texto: z.string().max(60).optional().describe('Palabra para filtrar (opcional).') }),
      async execute({ texto }) {
        return { categorias: serviciosPublicos(await cargar(db), { texto }), tienda: `${SITE}/tienda/` };
      },
    }),
    cotizar: tool({
      description: 'Calcula el precio de armar un proyecto con servicios de la tienda (por sus ids de ver_servicios): total en USD y pesos, con pago total (10% off) o con seña. SOLO funciona si el visitante inició sesión con Google; si no, devuelve requiereLogin y NO debés dar ningún precio ni estimación.',
      inputSchema: z.object({
        servicios: z.array(z.string().max(60)).min(1).max(MAX_IDS).describe('Ids de los servicios elegidos (de ver_servicios).'),
        cantidades: z.record(z.string(), z.number().int().min(1).max(20)).optional().describe('Cantidad por id, solo para servicios porUnidad (ej. páginas extra).'),
      }),
      async execute({ servicios, cantidades }) {
        if (!user) {
          return {
            requiereLogin: true,
            mensaje: 'Los precios se muestran solo a quien inició sesión con Google (es un click). No des precios ni estimaciones: invitá a iniciar sesión con el botón del chat, o a pedir presupuesto.',
            presupuesto: `${SITE}/presupuesto/`,
          };
        }
        try {
          const [catalogo, senaPct] = await Promise.all([cargar(db), cargarSena(db)]);
          let cotizacion = null;
          try { cotizacion = (await dolar()).cotizacion; } catch { /* sin dólar: queda en USD */ }
          return cotizacionParaChat({ ids: servicios, cantidades, catalogo, cotizacion, senaPct });
        } catch (e) {
          return { error: String(e.message).slice(0, 200) };
        }
      },
    }),
  };
}

// ¿Alguna herramienta pidió sesión? (la ruta lo usa para mostrar el botón de ingreso en el chat)
export function pidioLogin(steps = []) {
  return steps.some(s => (s.toolResults || []).some(r => (r.output ?? r.result)?.requiereLogin === true));
}
