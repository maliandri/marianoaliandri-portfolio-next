export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import crypto from 'crypto';
import { getGSCAuth, getVerifiedSites } from '../../../lib/gscClient';
import { getDb } from '../../../lib/firebase-admin';

const CLOUD_NAME  = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const API_KEY     = process.env.CLOUDINARY_API_KEY;
const API_SECRET  = process.env.CLOUDINARY_API_SECRET;

function microlinkScreenshotUrl(siteUrl) {
  const clean = siteUrl.replace(/\/$/, '');
  return `https://api.microlink.io/?url=${encodeURIComponent(clean)}&screenshot=true&meta=false&embed=screenshot.url&waitFor=1500&viewport.width=1280&viewport.height=800`;
}


function cloudinarySignature(params) {
  const sorted = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(sorted + API_SECRET).digest('hex');
}

async function uploadToCloudinary(imageUrl, publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    invalidate: 'true',
    overwrite:  'true',
    public_id:  publicId,
    timestamp:  String(timestamp),
  };
  const signature = cloudinarySignature(params);

  const form = new FormData();
  form.append('file',       imageUrl);
  form.append('public_id',  publicId);
  form.append('overwrite',  'true');
  // Sin esto, la captura se sube bien pero el CDN de Cloudinary sigue sirviendo
  // la imagen vieja en el mismo public_id — es la causa de "no capta la última imagen".
  form.append('invalidate', 'true');
  form.append('timestamp',  String(timestamp));
  form.append('api_key',    API_KEY);
  form.append('signature',  signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body:   form,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.secure_url;
}

export async function POST(request) {
  try {
    if (!API_KEY || !API_SECRET) {
      return Response.json({ error: 'Faltan CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en las env vars' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const onlyDomain = body?.domain || null;

    // 1. Obtener todos los sitios verificados en GSC (o filtrar a uno solo si vino ?domain)
    const auth = getGSCAuth();
    let sites = await getVerifiedSites(auth);
    if (!sites.length) {
      return Response.json({ error: 'No se encontraron sitios en GSC' }, { status: 404 });
    }
    if (onlyDomain) {
      sites = sites.filter(s => s.domain === onlyDomain);
      if (!sites.length) {
        return Response.json({ error: `Dominio ${onlyDomain} no encontrado en GSC` }, { status: 404 });
      }
    }

    // 2. Capturar y subir cada sitio en paralelo
    const db = getDb();
    const results = await Promise.allSettled(
      sites.map(async ({ url, domain }) => {
        const screenshotUrl = microlinkScreenshotUrl(url);
        const publicId      = `MarianWeb/${domain}`;

        const cloudinaryUrl = await uploadToCloudinary(screenshotUrl, publicId);
        if (db) {
          await db.collection('proyectos').doc(domain).set(
            { screenshotUpdatedAt: Date.now() },
            { merge: true }
          );
        }
        return { url, domain, cloudinaryUrl };
      })
    );

    const uploaded = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    const failed = results
      .filter(r => r.status === 'rejected')
      .map((r, i) => ({ url: sites[i]?.url, error: r.reason?.message }));

    return Response.json({ uploaded, failed, total: sites.length });
  } catch (err) {
    console.error('capture-projects error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
