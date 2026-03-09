export const dynamic = 'force-dynamic';

import { google } from 'googleapis';
import { getGSCAuth, getVerifiedSites } from '@/lib/gscClient';
import { getDb } from '@/lib/firebase-admin';

function getDateRange(days = 28) {
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export async function GET() {
  try {
    const auth = getGSCAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // 1. Lista dinámica de sitios verificados en GSC
    const sites = await getVerifiedSites(auth);

    // 2. Stats (clicks + impresiones) para cada sitio — últimos 28 días
    const dateRange = getDateRange(28);
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
          return { domain: site.domain, clicks: row.clicks || 0, impressions: row.impressions || 0 };
        }).catch(() => ({ domain: site.domain, clicks: 0, impressions: 0 }))
      )
    );

    const statsMap = {};
    statsResults.forEach(r => {
      if (r.status === 'fulfilled') {
        statsMap[r.value.domain] = { clicks: r.value.clicks, impressions: r.value.impressions };
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
        const stats = statsMap[site.domain] || { clicks: 0, impressions: 0 };
        return {
          domain: site.domain,
          url: site.url,
          screenshotUrl: `https://api.microlink.io/?url=${encodeURIComponent(site.url)}&screenshot=true&embed=screenshot.url`,
          descripcion: fs.descripcion || '',
          orden: fs.orden ?? 99,
          visible: fs.visible !== false,
          clicks: stats.clicks,
          impressions: stats.impressions,
        };
      })
      .filter(p => p.visible)
      .sort((a, b) => a.orden - b.orden || a.domain.localeCompare(b.domain));

    return Response.json({ success: true, proyectos });
  } catch (error) {
    return Response.json({ error: 'Error obteniendo proyectos', details: error.message }, { status: 500 });
  }
}
