// Tienda de servicios: el cliente arma su proyecto con los servicios del catálogo (src/data/serviceCatalog.js,
// el mismo del armador de presupuestos) y paga con MercadoPago o pide presupuesto. Módulo puro, sin I/O:
// el precio SIEMPRE se calcula acá, en el servidor, con el catálogo y los precios editados en el admin
// (`service_benefits/{id}.priceUSD`). Nunca se confía en un monto que mande el navegador.
import { SERVICES } from '@/data/serviceCatalog';

export const MODOS = {
  sena: { label: 'Seña del 50%', pct: 0.5, descuento: 0 },
  total: { label: 'Pago total (10% off)', pct: 1, descuento: 0.1 },
  presupuesto: { label: 'Pedir presupuesto', pct: 0, descuento: 0 },
};
export const MAX_SERVICIOS = 30;

// Catálogo con los precios y beneficios editados en el admin encima de los del código.
export function catalogoEfectivo(overrides = {}) {
  return SERVICES.map(cat => ({
    category: cat.category,
    items: cat.items.map(s => {
      const o = overrides[s.id] || {};
      const precio = Number(o.priceUSD);
      return { id: s.id, label: s.label, desc: s.desc, benefit: o.benefit || s.benefit, priceUSD: Number.isFinite(precio) && precio > 0 ? precio : s.price };
    }),
  }));
}

const redondear = (n) => Math.round(n * 100) / 100;

// Total del pedido. `cotizacion` = pesos por dólar (oficial, venta). Tira si algo no cierra.
export function cotizar({ ids, modo, catalogo, cotizacion }) {
  if (!MODOS[modo]) throw new Error('Modo de pago inválido');
  const unicos = [...new Set((ids || []).map(String))];
  if (!unicos.length) throw new Error('Elegí al menos un servicio');
  if (unicos.length > MAX_SERVICIOS) throw new Error(`Como máximo ${MAX_SERVICIOS} servicios por pedido`);
  const mapa = new Map(catalogo.flatMap(c => c.items).map(s => [s.id, s]));
  const items = unicos.map(id => {
    const s = mapa.get(id);
    if (!s) throw new Error(`Servicio desconocido: ${id}`);
    return { id: s.id, label: s.label, priceUSD: s.priceUSD };
  });
  const { pct, descuento } = MODOS[modo];
  const subtotalUSD = redondear(items.reduce((t, i) => t + i.priceUSD, 0));
  const descuentoUSD = redondear(subtotalUSD * descuento);
  const totalUSD = redondear(subtotalUSD - descuentoUSD);
  const aPagarUSD = redondear(totalUSD * pct);
  const r = { items, modo, subtotalUSD, descuentoUSD, totalUSD, aPagarUSD, saldoUSD: redondear(totalUSD - aPagarUSD) };
  if (modo === 'presupuesto') return r;
  if (!(cotizacion > 0)) throw new Error('No hay cotización del dólar');
  return { ...r, cotizacion, totalARS: Math.round(totalUSD * cotizacion), aPagarARS: Math.round(aPagarUSD * cotizacion) };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Datos del cliente: nombre y email obligatorios; el resto se recorta.
export function validarCliente(c = {}) {
  const cliente = {
    nombre: String(c.nombre || '').trim().slice(0, 120),
    email: String(c.email || '').trim().toLowerCase().slice(0, 200),
    telefono: String(c.telefono || '').trim().slice(0, 40),
    empresa: String(c.empresa || '').trim().slice(0, 120),
    notas: String(c.notas || '').trim().slice(0, 2000),
  };
  if (cliente.nombre.length < 2) return { error: 'Falta tu nombre' };
  if (!EMAIL.test(cliente.email)) return { error: 'El email no parece válido' };
  return { cliente };
}

// Servicios preelegidos por URL (?servicios=landing,payments_mp) y links viejos de /tienda/<producto>.
export const PRODUCTOS_VIEJOS = {
  'landing-page-professional': ['landing'],
  'website-corporate': ['web_business'],
  'ecommerce-basic': ['ecommerce', 'payments_mp'],
  'website-chatbot-ia': ['web_business', 'ai_chatbot'],
  'dashboard-powerbi-basic': ['powerbi'],
  'custom-development': ['webapp'],
};
