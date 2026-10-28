// src/app/api/merchant-feed/route.js
// Feed XML para Google Merchant Center (formato RSS 2.0 con namespace g:)
// URL a registrar en Merchant Center: https://marianoaliandri.com.ar/api/merchant-feed/

import { catalogoEfectivo } from '@/lib/tienda';
import { loadOverrides } from '@/lib/tiendaCheckout';
import { dolarOficialVenta } from '@/lib/dolar';
import { PLANS } from '@/data/plans';
import { getDb } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

const SITE_URL = 'https://marianoaliandri.com.ar';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

// Mismo dólar que cobra la tienda (oficial venta). Si no hay cotización, el feed sale sin servicios en
// vez de con un precio viejo: Google Merchant penaliza los precios que no coinciden con el sitio.
async function getExchangeRate() {
  return dolarOficialVenta().then(d => d.cotizacion).catch(() => null);
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
  const [leadFinderPlans, rate, overrides] = await Promise.all([
    getLeadFinderPlans(),
    getExchangeRate(),
    loadOverrides(getDb()).catch(() => ({})),
  ]);

  // 1. Servicios de la tienda (catálogo con los precios del admin, USD → ARS). Cada uno abre la tienda
  // con ese servicio ya marcado.
  const serviceItems = rate ? catalogoEfectivo(overrides).flatMap(c => c.items).map((s) =>
    makeItem({
      id: `servicio-${s.id}`,
      name: s.label,
      description: `${s.desc}. ${s.benefit}`,
      priceARS: Math.round(s.priceUSD * rate),
      link: `${SITE_URL}/tienda/?servicios=${s.id}`,
    })
  ) : [];

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
