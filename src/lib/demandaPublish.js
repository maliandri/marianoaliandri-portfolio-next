// Publicación de un informe de demanda. Las imágenes son capturas del propio informe del sitio
// (una por parte, ver seccionesDe / demandaShotUrl en src/lib/demandaReport.js), como en las
// auditorías: van como carrusel a Facebook + Instagram por Make (misma rama que el carrusel de
// Publicación Libre) y juntas en un PDF a LinkedIn por su API (src/lib/linkedinClient.js), porque
// Make no sube documentos. Cada red falla por separado.
import { PDFDocument } from 'pdf-lib';
import { uploadBytes } from '@/lib/cloudinaryServer';
import { buildFreePostPayload } from '@/lib/freePost';
import { postToMakeSocial } from '@/lib/makeSocial';
import { getLinkedInAuth, publishDocumentPost } from '@/lib/linkedinClient';
import { fechaLarga, seccionesDe, demandaShotUrl } from '@/lib/demandaReport';

export const pdfTitle = (reporte) => `Qué se busca en Google en ${reporte.zona} (${fechaLarga(reporte.createdAtMs)})`;

// Microlink renderiza la captura en el primer pedido (puede tardar): se baja acá y se guarda en
// Cloudinary, así Make e Instagram reciben una URL estable y el PDF se arma con los mismos bytes.
async function capturar(url, fetchImpl) {
  const res = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
  const type = res.headers?.get?.('content-type') || '';
  if (!res.ok || !type.startsWith('image/')) throw new Error(`Microlink no devolvió la captura (${res.ok ? type || 'sin tipo' : `HTTP ${res.status}`})`);
  return { bytes: Buffer.from(await res.arrayBuffer()), type };
}

export async function prepararPlacas(reporte, id, { fetchImpl = fetch, upload = uploadBytes } = {}) {
  const imagenes = [];
  const urls = [];
  for (const seccion of seccionesDe(reporte)) {
    const img = await capturar(demandaShotUrl(id, seccion), fetchImpl);
    imagenes.push(img);
    urls.push(await upload(img.bytes, img.type, `demanda/${id}`));
  }
  return { imagenes, urls };
}

// Una página por imagen, del tamaño de la imagen (JPG o PNG).
export async function imagesToPdf(imagenes, { title } = {}) {
  const pdf = await PDFDocument.create();
  if (title) pdf.setTitle(title);
  pdf.setAuthor('Mariano Aliandri');
  for (const { bytes, type } of imagenes) {
    const img = type.includes('png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    pdf.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return Buffer.from(await pdf.save());
}

export async function publicarDemanda({ db, reporte, imagenes, urls, caption }) {
  const redes = {};
  try {
    await postToMakeSocial(buildFreePostPayload({ text: caption, networks: ['facebook'], images: urls }), { timeoutMs: 10000 });
    redes.facebookInstagram = { ok: true };
  } catch (e) {
    redes.facebookInstagram = { ok: false, error: e.status ? `Make respondió ${e.status}` : e.message };
  }
  try {
    const { token, author } = await getLinkedInAuth(db);
    const title = pdfTitle(reporte);
    const pdf = await imagesToPdf(imagenes, { title });
    redes.linkedin = { ok: true, postId: await publishDocumentPost({ token, author, pdf, title, text: caption }) };
  } catch (e) {
    redes.linkedin = { ok: false, error: e.message };
  }
  return redes;
}
