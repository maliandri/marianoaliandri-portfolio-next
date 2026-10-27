// Publicación de un informe de demanda: las placas (src/lib/demandaSlides.js) van como carrusel a
// Facebook + Instagram por Make (misma rama que el carrusel de Publicación Libre) y como PDF a
// LinkedIn por su API (src/lib/linkedinClient.js). Cada red falla por separado.
import { renderDemandaSlides, slidesToPdf } from '@/lib/demandaSlides';
import { uploadPng } from '@/lib/cloudinaryServer';
import { buildFreePostPayload } from '@/lib/freePost';
import { postToMakeSocial } from '@/lib/makeSocial';
import { getLinkedInAuth, publishDocumentPost } from '@/lib/linkedinClient';
import { fechaLarga } from '@/lib/demandaReport';

export const pdfTitle = (reporte) => `Qué se busca en Google en ${reporte.zona} (${fechaLarga(reporte.createdAtMs)})`;

// PNGs + sus URLs en Cloudinary (las URLs quedan en el informe: vista previa y imagen para compartir).
export async function prepararPlacas(reporte, id) {
  const pngs = await renderDemandaSlides(reporte);
  const urls = [];
  for (const png of pngs) urls.push(await uploadPng(png, `demanda/${id}`));
  return { pngs, urls };
}

export async function publicarDemanda({ db, reporte, pngs, urls, caption }) {
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
    const pdf = await slidesToPdf(pngs, { title });
    redes.linkedin = { ok: true, postId: await publishDocumentPost({ token, author, pdf, title, text: caption }) };
  } catch (e) {
    redes.linkedin = { ok: false, error: e.message };
  }
  return redes;
}
