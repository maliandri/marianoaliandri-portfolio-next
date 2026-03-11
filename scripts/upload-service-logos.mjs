/**
 * Descarga logos localmente y los sube a Cloudinary como binario (unsigned upload)
 * Uso: node scripts/upload-service-logos.mjs
 */

import { Buffer } from 'buffer';

const CLOUD_NAME    = 'dlshym1te';
const UPLOAD_PRESET = 'Mariano_cargas_web';
const FOLDER        = 'service-logos';

// Simpleicons CDN — SVGs de alta calidad para todas las marcas tech
// https://simpleicons.org  (colores hex de cada marca)
const SERVICIOS = [
  { id: 'vercel',      label: 'Vercel',         url: 'https://cdn.simpleicons.org/vercel/000000' },
  { id: 'netlify',     label: 'Netlify',         url: 'https://cdn.simpleicons.org/netlify/00C7B7' },
  { id: 'mercadopago', label: 'MercadoPago',     url: 'https://cdn.simpleicons.org/mercadopago/009EE3' },
  { id: 'firebase',    label: 'Firebase',        url: 'https://cdn.simpleicons.org/firebase/FFCA28' },
  { id: 'mongodb',     label: 'MongoDB',         url: 'https://cdn.simpleicons.org/mongodb/47A248' },
  { id: 'supabase',    label: 'Supabase',        url: 'https://cdn.simpleicons.org/supabase/3ECF8E' },
  { id: 'cloudinary',  label: 'Cloudinary',      url: 'https://cdn.simpleicons.org/cloudinary/3448C5' },
  { id: 'make',        label: 'Make.com',         url: 'https://cdn.simpleicons.org/make/6D00CC' },
  { id: 'resend',      label: 'Resend',          url: 'https://cdn.simpleicons.org/resend/000000' },
  { id: 'googlegemini',label: 'Google Gemini',   url: 'https://cdn.simpleicons.org/googlegemini/8E75B2' },
  { id: 'nextdotjs',   label: 'Next.js',         url: 'https://cdn.simpleicons.org/nextdotjs/000000' },
  { id: 'react',       label: 'React',           url: 'https://cdn.simpleicons.org/react/61DAFB' },
  { id: 'tailwindcss', label: 'Tailwind CSS',    url: 'https://cdn.simpleicons.org/tailwindcss/06B6D4' },
  { id: 'framermotion',label: 'Framer Motion',   url: 'https://cdn.simpleicons.org/framer/0055FF' },
];

async function downloadAsBase64(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const contentType = res.headers.get('content-type') || 'image/svg+xml';
  return `data:${contentType};base64,${base64}`;
}

async function uploadToCloudinary(base64Data, publicId) {
  const formData = new FormData();
  formData.append('file', base64Data);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', FOLDER);
  formData.append('public_id', publicId);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudinary ${res.status}: ${err}`);
  }

  return res.json();
}

async function main() {
  console.log('🚀 Descargando logos y subiendo a Cloudinary...\n');

  const results = {};

  for (const servicio of SERVICIOS) {
    process.stdout.write(`⬆  ${servicio.label.padEnd(20)} `);

    try {
      const base64 = await downloadAsBase64(servicio.url);
      const data = await uploadToCloudinary(base64, servicio.id);
      results[servicio.id] = data.secure_url;
      console.log(`✅ ${data.secure_url}`);
    } catch (err) {
      results[servicio.id] = null;
      console.log(`❌ ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n\n📋 Copia esto en src/data/serviceLogos.js:\n');
  console.log('export const SERVICE_LOGOS = {');
  for (const [id, url] of Object.entries(results)) {
    if (url) console.log(`  '${id}': '${url}',`);
  }
  console.log('};');
}

main().catch(console.error);
