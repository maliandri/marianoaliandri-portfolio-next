export const dynamic = 'force-dynamic';

import { google } from 'googleapis';
import { getGSCAuth, getVerifiedSites } from '@/lib/gscClient';
import { getDb } from '@/lib/firebase-admin';

function getDateRange(days = 28, lag = 3) {
  const end = new Date();
  end.setDate(end.getDate() - lag);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

function microlinkScreenshotUrl(siteUrl) {
  const clean = siteUrl.replace(/\/$/, '');
  return `https://api.microlink.io/?url=${encodeURIComponent(clean)}&screenshot=true&meta=false&embed=screenshot.url&waitFor=1500&viewport.width=1280&viewport.height=800`;
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const showAll = params.get('all') === '1';
    const days = Math.min(Math.max(Number(params.get('days')) || 28, 1), 180);
    const lag  = Math.min(Math.max(Number(params.get('lag')) || 3, 0), 10);

    const auth = getGSCAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // 1. Lista dinámica de sitios verificados en GSC
    const sites = await getVerifiedSites(auth);

    // 2. Stats (clicks + impresiones) para cada sitio — rango configurable (?days=&lag=)
    const dateRange = getDateRange(days, lag);
    const statsResults = await Promise.allSettled(
      sites.map(site =>
        searchconsole.searchanalytics.query({
          siteUrl: site.siteUrl,
          requestBody: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: [],
            rowLimit: 1,
          },
        }).then(res => {
          const row = res.data.rows?.[0] || {};
          return { domain: site.domain, clicks: row.clicks || 0, impressions: row.impressions || 0, statsError: false };
        }).catch(err => ({ domain: site.domain, clicks: 0, impressions: 0, statsError: err.message || true }))
      )
    );

    const statsMap = {};
    statsResults.forEach(r => {
      if (r.status === 'fulfilled') {
        statsMap[r.value.domain] = { clicks: r.value.clicks, impressions: r.value.impressions, statsError: r.value.statsError };
      }
    });

    // 3. Descripciones desde Firestore (colección "proyectos", doc por dominio)
    const db = getDb();
    const firestoreMap = {};
    if (db) {
      const snap = await db.collection('proyectos').get();
      snap.forEach(doc => { firestoreMap[doc.id] = doc.data(); });
    }

    // 4. Armar respuesta final
    const proyectos = sites
      .map(site => {
        const fs = firestoreMap[site.domain] || {};
        const stats = statsMap[site.domain] || { clicks: 0, impressions: 0, statsError: false };
        return {
          domain: site.domain,
          url: site.url,
          // Captura manual (admin → "Capturar screenshots") subida a Cloudinary. Más confiable
          // que renderizar en vivo (evita capturas "vacías" de sitios con animaciones/dark hero).
          // ?v= con el timestamp de la última captura evita que el navegador siga mostrando
          // una copia vieja cacheada con la misma URL.
          screenshotUrl: CLOUD_NAME
            ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_800/MarianWeb/${site.domain}?v=${fs.screenshotUpdatedAt || 0}`
            : microlinkScreenshotUrl(site.url),
          screenshotUpdatedAt: fs.screenshotUpdatedAt || null,
          screenshotFallbackUrl: microlinkScreenshotUrl(site.url),
          descripcionCorta: fs.descripcionCorta || '',
          stack: fs.stack || '',
          funcionalidades: fs.funcionalidades || '',
          impacto: fs.impacto || '',
          orden: fs.orden ?? 99,
          visible: fs.visible !== false,
          clicks: stats.clicks,
          impressions: stats.impressions,
          statsError: stats.statsError,
          permissionLevel: site.permissionLevel,
        };
      })
      .filter(p => showAll || p.visible)
      .sort((a, b) => a.orden - b.orden || a.domain.localeCompare(b.domain));

    return Response.json({ success: true, proyectos });
  } catch (error) {
    return Response.json({ error: 'Error obteniendo proyectos', details: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { domain, descripcionCorta, stack, funcionalidades, impacto, orden, visible } = await request.json();
    if (!domain) return Response.json({ error: 'domain requerido' }, { status: 400 });

    const db = getDb();
    await db.collection('proyectos').doc(domain).set(
      { descripcionCorta, stack, funcionalidades, impacto, orden: Number(orden), visible, updatedAt: new Date() },
      { merge: true }
    );

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Error guardando proyecto', details: error.message }, { status: 500 });
  }
}
