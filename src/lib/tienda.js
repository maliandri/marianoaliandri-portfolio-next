// Tienda de servicios: el cliente arma su proyecto sumando piezas del catálogo (base + secciones + módulos) y
// paga con MercadoPago o pide presupuesto. Módulo puro, sin I/O: el precio SIEMPRE se calcula acá, en el
// servidor, con el catálogo de Firestore (`tienda_catalogo`, ver tiendaCheckout.cargarCatalogo). Nunca se
// confía en un monto que mande el navegador. Este archivo importa el catálogo del código (con precios):
// usarlo solo del lado del servidor.
import { SERVICES } from '@/data/serviceCatalog';
import { resolverDependencias } from '@/lib/tiendaDeps';

export { PRODUCTOS_VIEJOS } from '@/data/tiendaRecetas';

export const MODOS = {
  sena: { label: 'Seña', pct: 0.5, descuento: 0 }, // pct real: primer hito del plan de pago del admin
  total: { label: 'Pago total (10% off)', pct: 1, descuento: 0.1 },
  presupuesto: { label: 'Pedir presupuesto', pct: 0, descuento: 0 },
};
export const MAX_SERVICIOS = 40;
export const MAX_CANTIDAD = 20;
export const TIPOS = ['base', 'seccion', 'modulo'];

// Una pieza del catálogo, con los campos normalizados (sirve para un doc de Firestore o del código).
export function normalizarItem(id, d = {}, orden = 0) {
  const precio = Number(d.priceUSD);
  return {
    id,
    categoria: String(d.categoria || 'Otros'),
    tipo: TIPOS.includes(d.tipo) ? d.tipo : 'modulo',
    label: String(d.label || id),
    desc: String(d.desc || ''),
    benefit: String(d.benefit || ''),
    priceUSD: Number.isFinite(precio) && precio >= 0 ? precio : 0,
    requiere: Array.isArray(d.requiere) ? d.requiere.map(String).filter(Boolean) : [],
    porUnidad: d.porUnidad === true,
    activo: d.activo !== false,
    orden: Number.isFinite(Number(d.orden)) ? Number(d.orden) : orden,
  };
}

// Catálogo del código (semilla / respaldo) como lista plana. `overrides` = service_benefits (precio y
// beneficio que el admin editaba antes de pasar a Firestore); sigue valiendo hasta que se cargue la colección.
export function catalogoEfectivo(overrides = {}) {
  let orden = 0;
  return SERVICES.flatMap(cat => cat.items.map(s => {
    const o = overrides[s.id] || {};
    const precio = Number(o.priceUSD);
    return normalizarItem(s.id, {
      categoria: cat.category, tipo: s.tipo, label: s.label, desc: s.desc, benefit: o.benefit || s.benefit,
      priceUSD: Number.isFinite(precio) && precio > 0 ? precio : s.price,
      requiere: s.requiere, porUnidad: s.porUnidad, activo: s.activo,
    }, orden++);
  }));
}

// Lista plana → categorías en orden (para mostrar). Por defecto solo las piezas activas.
export function agruparCatalogo(items, { soloActivos = true } = {}) {
  const orden = [...items].filter(s => !soloActivos || s.activo !== false).sort((a, b) => a.orden - b.orden);
  const cats = new Map();
  for (const s of orden) {
    if (!cats.has(s.categoria)) cats.set(s.categoria, []);
    cats.get(s.categoria).push(s);
  }
  return [...cats].map(([category, list]) => ({ category, items: list }));
}

// Versión pública: sin precios (lo que ve quien no inició sesión y lo que viaja en el HTML).
export function sinPrecios(items) {
  return items.map(({ priceUSD, ...resto }) => resto); // eslint-disable-line no-unused-vars
}

const redondear = (n) => Math.round(n * 100) / 100;

// Total del pedido. `catalogo` = lista plana; `cantidades` = { id: n } solo para piezas `porUnidad`.
// `cotizacion` = pesos por dólar (oficial, venta). Suma sola las dependencias. Tira si algo no cierra.
export function cotizar({ ids, cantidades = {}, modo, catalogo, cotizacion, senaPct = MODOS.sena.pct }) {
  if (!MODOS[modo]) throw new Error('Modo de pago inválido');
  const pedidos = [...new Set((ids || []).map(String))];
  if (!pedidos.length) throw new Error('Elegí al menos un servicio');
  const mapa = new Map(catalogo.map(s => [s.id, s]));
  for (const id of pedidos) {
    const s = mapa.get(id);
    if (!s) throw new Error(`Servicio desconocido: ${id}`);
    if (s.activo === false) throw new Error(`Servicio no disponible: ${s.label}`);
  }
  const { ids: todos, agregados, faltantes } = resolverDependencias(pedidos, catalogo);
  if (faltantes.length) throw new Error(`Falta una pieza requerida que no está disponible: ${faltantes.join(', ')}`);
  if (todos.length > MAX_SERVICIOS) throw new Error(`Como máximo ${MAX_SERVICIOS} servicios por pedido`);

  const items = todos.map(id => {
    const s = mapa.get(id);
    const n = s.porUnidad ? Math.min(MAX_CANTIDAD, Math.max(1, Math.floor(Number(cantidades?.[id]) || 1))) : 1;
    return {
      id: s.id,
      label: n > 1 ? `${s.label} ×${n}` : s.label,
      priceUSD: redondear(s.priceUSD * n),
      ...(n > 1 ? { cantidad: n, precioUnitarioUSD: s.priceUSD } : {}),
      ...(agregados[id] ? { agregadoPor: agregados[id] } : {}),
    };
  });
  if (!(senaPct > 0 && senaPct <= 1)) throw new Error('Seña inválida');
  const { descuento } = MODOS[modo];
  const pct = modo === 'sena' ? senaPct : MODOS[modo].pct;
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
