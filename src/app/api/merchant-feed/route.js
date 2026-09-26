// src/app/api/merchant-feed/route.js
// Feed XML para Google Merchant Center (formato RSS 2.0 con namespace g:)
// URL a registrar en Merchant Center: https://marianoaliandri.com.ar/api/merchant-feed/

import { products } from '@/data/products';
import { NextResponse } from 'next/server';

const SITE_URL = 'https://marianoaliandri.com.ar';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

async function getExchangeRate() {
  try {
    const res = await fetch('https://api.bluelytics.com.ar/v2/latest', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const buy = Number(data?.oficial?.value_buy);
    const sell = Number(data?.oficial?.value_sell);
    const rate = Math.round((buy + sell) / 2);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('tasa inválida');
    return rate;
  } catch {
    return 1200; // fallback conservador
  }
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET() {
  const rate = await getExchangeRate();

  // Solo productos con precio fijo (excluye cotización personalizada)
  const feedProducts = products.filter((p) => p.priceUSD && !p.isCustom);

  const items = feedProducts
    .map((p) => {
      const priceARS = (p.priceUSD * rate).toFixed(2);
      const imageUrl =
        p.image && p.image.startsWith('http') ? p.image : DEFAULT_IMAGE;

      return `
    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(p.description)}</g:description>
      <g:link>${SITE_URL}/tienda/${escapeXml(p.id)}</g:link>
      <g:image_link>${escapeXml(imageUrl)}</g:image_link>
      <g:price>${priceARS} ARS</g:price>
      <g:availability>in_stock</g:availability>
      <g:condition>new</g:condition>
      <g:brand>Mariano Aliandri</g:brand>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Mariano Aliandri — Servicios de Desarrollo Web y Datos</title>
    <link>${SITE_URL}/tienda</link>
    <description>Servicios profesionales de desarrollo web, e-commerce e inteligencia de datos en Argentina</description>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
