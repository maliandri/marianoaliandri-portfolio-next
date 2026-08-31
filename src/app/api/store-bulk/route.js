export const dynamic = 'force-dynamic';
import admin, { getDb } from '@/lib/firebase-admin';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Export/import masivo de la tienda via Excel.
// POST { action: 'export' | 'import', adminPassword, rows? }
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, adminPassword } = body;

    if (adminPassword !== ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const db = getDb();

    // ---- EXPORT: devuelve todos los productos + datos de alquiler ----
    if (action === 'export') {
      const [prodSnap, rentSnap] = await Promise.all([
        db.collection('products').get(),
        db.collection('productos_alquiler').get(),
      ]);

      const rental = {};
      rentSnap.forEach((d) => { rental[d.id] = d.data(); });

      const products = [];
      prodSnap.forEach((d) => {
        const p = d.data();
        const r = rental[d.id] || {};
        products.push({
          id: d.id,
          name: p.name || '',
          descripcion: p.shortDescription || p.description || '',
          precioUSD: p.priceUSD ?? '',
          precioARS: p.priceARS ?? '',
          alquilerSena: r.seña ?? r.sena ?? '',
          alquilerCuota: r.cuota ?? '',
          alquilerDuracion: r.duracionMinima ?? '',
          alquilerActivo: r.activo === true ? 'SI' : (r.activo === false ? 'NO' : ''),
        });
      });

      products.sort((a, b) => a.id.localeCompare(b.id));
      return Response.json({ products });
    }

    // ---- DELETE ONE: borra un producto + su dato de alquiler ----
    if (action === 'deleteOne') {
      const id = String(body.id || '').trim();
      if (!id) return Response.json({ error: 'Falta el ID' }, { status: 400 });
      await Promise.all([
        db.collection('products').doc(id).delete(),
        db.collection('productos_alquiler').doc(id).delete().catch(() => {}),
      ]);
      return Response.json({ success: true, id });
    }

    // ---- CLEAR: borra TODOS los productos + datos de alquiler ----
    if (action === 'clear') {
      const [prodSnap, rentSnap] = await Promise.all([
        db.collection('products').get(),
        db.collection('productos_alquiler').get(),
      ]);
      let deleted = 0;
      const delBatch = db.batch();
      prodSnap.forEach((d) => { delBatch.delete(d.ref); deleted++; });
      rentSnap.forEach((d) => { delBatch.delete(d.ref); });
      await delBatch.commit();
      return Response.json({ success: true, deleted });
    }

    // ---- IMPORT: actualiza products + productos_alquiler ----
    if (action === 'import') {
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (!rows.length) return Response.json({ error: 'No hay filas para importar' }, { status: 400 });

      const replace = body.replace === true;
      // Validar que haya al menos una fila con ID ANTES de borrar nada
      const validRows = rows.filter((r) => String(r.id || '').trim() !== '');
      if (!validRows.length) return Response.json({ error: 'Ninguna fila tiene ID válido — no se borró nada' }, { status: 400 });

      // En modo reemplazo: borrar todo primero (solo tras validar filas)
      let deleted = 0;
      if (replace) {
        const [prodSnap, rentSnap] = await Promise.all([
          db.collection('products').get(),
          db.collection('productos_alquiler').get(),
        ]);
        const delBatch = db.batch();
        prodSnap.forEach((d) => { delBatch.delete(d.ref); deleted++; });
        rentSnap.forEach((d) => { delBatch.delete(d.ref); });
        await delBatch.commit();
      }

      const num = (v) => {
        if (v === '' || v === null || v === undefined) return null;
        const n = Number(String(v).replace(/[^0-9.,-]/g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : null;
      };

      let updated = 0, rentalUpdated = 0;
      const errors = [];
      const now = admin.firestore.FieldValue.serverTimestamp();

      for (const row of rows) {
        const id = String(row.id || '').trim();
        if (!id) { errors.push('Fila sin ID, omitida'); continue; }

        try {
          // --- producto ---
          const priceUSD = num(row.precioUSD);
          const tc = num(row.tipoCambio);
          let priceARS = num(row.precioARS);
          // si no vino ARS pero hay USD + tipo de cambio, se calcula
          if (priceARS === null && priceUSD !== null && tc) priceARS = Math.ceil(priceUSD * tc);

          const prodUpdate = { updatedAt: now };
          if (row.name !== undefined && String(row.name).trim() !== '') prodUpdate.name = String(row.name).trim();
          if (row.descripcion !== undefined && String(row.descripcion).trim() !== '') prodUpdate.shortDescription = String(row.descripcion).trim();
          if (priceUSD !== null) prodUpdate.priceUSD = priceUSD;
          if (priceARS !== null) prodUpdate.priceARS = priceARS;

          await db.collection('products').doc(id).set(prodUpdate, { merge: true });
          updated++;

          // --- alquiler (solo si hay algún dato de alquiler) ---
          const sena = num(row.alquilerSena);
          const cuota = num(row.alquilerCuota);
          const duracion = num(row.alquilerDuracion);
          const activoRaw = String(row.alquilerActivo ?? '').trim().toUpperCase();
          const hasRental = sena !== null || cuota !== null || duracion !== null || activoRaw !== '';

          if (hasRental) {
            const rentUpdate = { updatedAt: now };
            if (sena !== null) rentUpdate['seña'] = sena;
            if (cuota !== null) rentUpdate.cuota = cuota;
            if (duracion !== null) rentUpdate.duracionMinima = duracion;
            if (activoRaw !== '') rentUpdate.activo = ['SI', 'SÍ', 'TRUE', '1', 'X'].includes(activoRaw);
            await db.collection('productos_alquiler').doc(id).set(rentUpdate, { merge: true });
            rentalUpdated++;
          }
        } catch (e) {
          errors.push(`${id}: ${e.message}`);
        }
      }

      return Response.json({ success: true, updated, rentalUpdated, deleted, errors });
    }

    return Response.json({ error: 'Acción inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: 'Error en store-bulk', message: error.message }, { status: 500 });
  }
}
