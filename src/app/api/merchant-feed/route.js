// src/app/api/merchant-feed/route.js
// Feed XML para Google Merchant Center (formato RSS 2.0 con namespace g:)
// URL a registrar en Merchant Center: https://marianoaliandri.com.ar/api/merchant-feed/

import { products } from '@/data/products';
import { PLANS } from '@/data/plans';
import { getDb } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

const SITE_URL = 'https://marianoaliandri.com.ar';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

async function getExchangeRate() {
  try {
    const res = await fetch('https://api.bluelytics.com.ar/v2/latest', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const buy = Number(data?.oficial?.value_buy);
    const sell = Number(data?.oficial?.value_sell);
    const rate = Math.round((buy + sell) / 2);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error();
    return rate;
  } catch {
    return 1200;
  }
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeItem({ id, name, description, priceARS, link, image }) {
  return `
    <item>
      <g:id>${escapeXml(id)}</g:id>
      <g:title>${escapeXml(name)}</g:title>
      <g:description>${escapeXml(description)}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(image ?? DEFAULT_IMAGE)}</g:image_link>
      <g:price>${Number(priceARS).toFixed(2)} ARS</g:price>
      <g:availability>in_stock</g:availability>
      <g:condition>new</g:condition>
      <g:brand>Mariano Aliandri</g:brand>
    </item>`;
}

async function getLeadFinderPlans() {
  try {
    const db = getDb();
    if (!db) return [];
    const snap = await db.collection('leadfinder_plans')
      .where('active', '!=', false)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function GET() {
  const [leadFinderPlans, rate] = await Promise.all([
    getLeadFinderPlans(),
    getExchangeRate(),
  ]);

  // 1. Servicios de la tienda con precio fijo (USD → ARS)
  const serviceItems = products
    .filter((p) => p.priceUSD && !p.isCustom)
    .map((p) =>
      makeItem({
        id: p.id,
        name: p.name,
        description: p.description,
        priceARS: p.priceUSD * rate,
        link: `${SITE_URL}/tienda/${p.id}`,
        image: p.image?.startsWith('http') ? p.image : DEFAULT_IMAGE,
      })
    );

  // 2. Lead Finder Pro — planes activos desde Firestore (precio en ARS)
  const leadFinderItems = leadFinderPlans.map((p) =>
    makeItem({
      id: `lfp-${p.id}`,
      name: `Lead Finder Pro — ${p.name}`,
      description: p.description || `${p.credits ?? p.auditorias ?? ''} auditorías de negocios locales. Activación automática.`,
      priceARS: p.priceARS,
      link: `${SITE_URL}/lead-finder-pro`,
    })
  );

  // 3. Planes de Analítica / Rubros buscados (precios en ARS de plans.js)
  const planItems = Object.values(PLANS)
    .filter((p) => p.price > 0)
    .map((p) =>
      makeItem({
        id: `analitica-${p.id}`,
        name: `Analítica Local — Plan ${p.name}`,
        description: `Buscador de rubros por demanda en Argentina. ${p.features.join('. ')}.`,
        priceARS: p.price,
        link: `${SITE_URL}/analitica`,
      })
    );

  const allItems = [...serviceItems, ...leadFinderItems, ...planItems].join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Mariano Aliandri — Herramientas y Servicios Digitales</title>
    <link>${SITE_URL}/tienda</link>
    <description>Servicios de desarrollo web, herramientas de prospección y analítica local para Argentina</description>
${allItems}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
