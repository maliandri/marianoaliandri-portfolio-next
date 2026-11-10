// Administración del catálogo de la tienda en Firestore (`tienda_catalogo/{id}`): sembrar desde el código,
// guardar una pieza y borrarla. Lo usa /api/tienda-catalogo/ (solo admin).
import { FieldValue } from 'firebase-admin/firestore';
import { catalogoEfectivo, normalizarItem, TIPOS } from '@/lib/tienda';
import { CATALOGO, loadOverrides } from '@/lib/tiendaCheckout';

const ID = /^[a-z0-9_]{2,40}$/;

const aDoc = ({ id, ...resto }) => resto; // eslint-disable-line no-unused-vars

// Carga el catálogo del código (con los precios que ya estaban editados en service_benefits) en Firestore.
// Solo si la colección está vacía: no pisa nada que ya se haya editado.
export async function sembrarCatalogo(db) {
  const existentes = await db.collection(CATALOGO).get();
  if (!existentes.empty) return { sembrados: 0, yaExistia: true };
  const items = catalogoEfectivo(await loadOverrides(db));
  await Promise.all(items.map(s => db.collection(CATALOGO).doc(s.id).set({ ...aDoc(s), updatedAt: FieldValue.serverTimestamp() })));
  return { sembrados: items.length, yaExistia: false };
}

// Valida y arma el doc de una pieza a partir de lo que manda el admin. Devuelve { id, doc } o { error }.
export function validarPieza(body = {}) {
  const id = String(body.id || '').trim();
  if (!ID.test(id)) return { error: 'El id debe tener 2–40 caracteres: minúsculas, números y _' };
  const label = String(body.label || '').trim();
  if (label.length < 2) return { error: 'Falta el nombre' };
  const precio = Number(body.priceUSD);
  if (!(precio >= 0 && precio < 100000)) return { error: 'Precio inválido' };
  if (!TIPOS.includes(body.tipo)) return { error: 'Tipo inválido (base, seccion o modulo)' };
  const requiere = (Array.isArray(body.requiere) ? body.requiere : String(body.requiere || '').split(','))
    .map(s => String(s).trim()).filter(Boolean);
  if (requiere.some(r => r.split('|').some(a => !ID.test(a.trim())))) return { error: 'Dependencias inválidas (ids separados por coma; "a|b" = alguna de las dos)' };
  if (requiere.some(r => r.split('|').map(a => a.trim()).includes(id))) return { error: 'Una pieza no puede requerirse a sí misma' };
  const doc = aDoc(normalizarItem(id, {
    categoria: String(body.categoria || '').trim() || 'Otros',
    tipo: body.tipo, label, desc: String(body.desc || '').trim(), benefit: String(body.benefit || '').trim(),
    priceUSD: precio, requiere, porUnidad: body.porUnidad === true, activo: body.activo !== false, orden: body.orden,
  }));
  return { id, doc };
}

export async function guardarPieza(db, body) {
  const v = validarPieza(body);
  if (v.error) return v;
  await db.collection(CATALOGO).doc(v.id).set({ ...v.doc, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true, id: v.id };
}

// Cambios parciales rápidos (precio, activo, orden…): mergea solo los campos válidos que vengan.
export async function actualizarCampos(db, id, campos = {}) {
  const ref = db.collection(CATALOGO).doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return { error: 'La pieza no existe' };
  const nuevo = { ...snap.data(), ...campos };
  const v = validarPieza({ ...nuevo, id });
  if (v.error) return v;
  await ref.set({ ...v.doc, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true, id };
}

export async function borrarPieza(db, id) {
  await db.collection(CATALOGO).doc(String(id)).delete();
  return { ok: true };
}
