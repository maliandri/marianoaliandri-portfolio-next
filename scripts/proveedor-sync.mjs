// Sincroniza el catálogo de WhatsApp de un proveedor (Mood Fit) con Firestore + Cloudinary.
//
// Paso previo (en Chrome, con WhatsApp Web abierto): el extractor descarga a la carpeta
// de Descargas `moodfit-catalogo.json` y las fotos `moodfit-img-*.jpg`
// (ver "Sincronizar catálogo Mood Fit" en CLAUDE.md).
//
// Uso: npx tsx --tsconfig jsconfig.json scripts/proveedor-sync.mjs <carpeta> [--dry]
// Lee credenciales de .env.local (FIREBASE_*, CLOUDINARY_API_KEY/SECRET, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import admin from 'firebase-admin';

const parse = await import('../src/lib/proveedorParse.js');
const { parseTalles, parsePrecioMenor, parsePrecioArs, parseCodigo, limpiarTitulo } = parse.default?.parseTalles ? parse.default : parse;

const PROVEEDOR = 'moodfit';
const dir = path.resolve(process.argv[2] || '.');
const DRY = process.argv.includes('--dry');

// --- env ---
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CKEY = process.env.CLOUDINARY_API_KEY;
const CSECRET = process.env.CLOUDINARY_API_SECRET;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // En .env.local el \n puede venir escapado una o dos veces.
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\+n/g, '\n'),
  }),
});
const db = admin.firestore();

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

async function subirImagen(buf, publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { overwrite: 'true', public_id: publicId, timestamp: String(timestamp) };
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  const signature = crypto.createHash('sha1').update(toSign + CSECRET).digest('hex');
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'image/jpeg' }));
  for (const [k, v] of Object.entries(params)) form.append(k, v);
  form.append('api_key', CKEY);
  form.append('signature', signature);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: form });
  const j = await r.json();
  if (!r.ok) throw new Error(`Cloudinary ${r.status}: ${j.error?.message}`);
  return { url: j.secure_url, publicId: j.public_id, width: j.width, height: j.height };
}

const raw = JSON.parse(fs.readFileSync(path.join(dir, 'moodfit-catalogo.json'), 'utf8'));
console.log(`Leídos ${raw.productos.length} ítems de ${raw.extraidoEn}`);

const existentes = new Map();
(await db.collection('proveedor_productos').where('proveedor', '==', PROVEEDOR).get())
  .forEach((d) => existentes.set(d.id, d.data()));

const ahora = new Date().toISOString();
const vistos = new Set();
const nuevos = [], cambiados = [], errores = [];

for (const p of raw.productos) {
  const titulo = limpiarTitulo(p.tituloOriginal);
  const codigo = parseCodigo(p.tituloOriginal);
  let id = `${PROVEEDOR}-${slug(codigo || titulo)}`;
  while (vistos.has(id)) id += '-b'; // títulos repetidos en el catálogo
  vistos.add(id);

  const descripcion = (p.descripcion || '').trim();
  const precioMayor = parsePrecioArs(p.precioTxt);
  const colecciones = (p.colecciones || []).filter((c) => c !== 'Todos los artículos');
  const tipo = colecciones.includes('Informacion General') || !precioMayor ? 'info' : 'producto';
  const textoTalles = `${titulo}\n${descripcion}`;
  const prev = existentes.get(id);

  // Imágenes: solo se re-suben si cambió el contenido (hash).
  const imagenes = [];
  for (const [i, file] of (p.imagenes || []).entries()) {
    const fp = path.join(dir, file);
    if (!fs.existsSync(fp)) { errores.push(`${id}: falta ${file}`); continue; }
    const buf = fs.readFileSync(fp);
    const hash = crypto.createHash('sha1').update(buf).digest('hex');
    const anterior = prev?.imagenes?.[i];
    if (anterior?.hash === hash) { imagenes.push(anterior); continue; }
    if (DRY) { imagenes.push({ hash, url: '(dry)' }); continue; }
    try {
      const up = await subirImagen(buf, `proveedores/${PROVEEDOR}/${id.replace(`${PROVEEDOR}-`, '')}-${i}`);
      imagenes.push({ ...up, hash });
    } catch (e) { errores.push(`${id}: ${e.message}`); }
  }

  const doc = {
    proveedor: PROVEEDOR,
    codigo,
    titulo,
    tituloOriginal: p.tituloOriginal,
    descripcion,
    colecciones,
    precioMayor,
    precioSugerido: parsePrecioMenor(descripcion) ?? parsePrecioMenor(p.tituloOriginal),
    talles: tipo === 'producto' ? parseTalles(textoTalles) : [],
    tipo,
    orden: p.idx,
    imagenes,
    activo: true,
    actualizadoEn: ahora,
    historialPrecios: prev?.historialPrecios || [],
  };

  if (!prev) {
    doc.creadoEn = ahora;
    doc.historialPrecios = [{ fecha: ahora, precioMayor: doc.precioMayor, precioSugerido: doc.precioSugerido }];
    nuevos.push({ id, titulo });
  } else if (prev.precioMayor !== doc.precioMayor || prev.precioSugerido !== doc.precioSugerido || !prev.activo) {
    doc.historialPrecios = [...doc.historialPrecios,
      { fecha: ahora, precioMayor: doc.precioMayor, precioSugerido: doc.precioSugerido }];
    cambiados.push({ id, titulo, antes: prev.precioMayor, despues: doc.precioMayor,
      sugeridoAntes: prev.precioSugerido ?? null, sugeridoDespues: doc.precioSugerido, reaparecio: !prev.activo });
  }
  if (!DRY) await db.collection('proveedor_productos').doc(id).set(doc);
}

const desaparecidos = [...existentes.entries()]
  .filter(([id, d]) => d.activo && !vistos.has(id))
  .map(([id, d]) => ({ id, titulo: d.titulo }));
if (!DRY) {
  for (const { id } of desaparecidos) {
    await db.collection('proveedor_productos').doc(id).update({ activo: false, actualizadoEn: ahora });
  }
  await db.collection('proveedor_syncs').add({
    proveedor: PROVEEDOR, fecha: ahora, extraidoEn: raw.extraidoEn,
    total: raw.productos.length, nuevos, cambiados, desaparecidos, errores,
  });
}

console.log(JSON.stringify({ total: raw.productos.length, nuevos: nuevos.length, cambiados: cambiados.length,
  desaparecidos: desaparecidos.length, errores }, null, 2));
process.exit(errores.length ? 1 : 0);
