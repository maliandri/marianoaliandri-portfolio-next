import { filasParaInforme } from '@/lib/leadSearch';

// Borrador del informe público (título, resumen, stats) a partir de los leads de una búsqueda.
// Lo usan el botón "Publicar informe" del admin y el servidor MCP.

export const MIN_SITIOS_INFORME = 3; // misma regla que la auditoría automática

export function rubrosTexto(labels) {
  if (!labels.length) return 'negocios locales';
  if (labels.length === 1) return labels[0];
  if (labels.length <= 3) return `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}`;
  return `${labels.slice(0, 3).join(', ')} y ${labels.length - 3} más`;
}

export function buildAuditReportDraft(leads, { ciudades, rubros, radioKm, now = new Date() }) {
  const filas = filasParaInforme(leads);
  const total = filas.length;
  const low = filas.filter(f => f.seoScore < 50).length;
  const withEmail = filas.filter(f => f.email).length;
  const avg = total ? Math.round(filas.reduce((s, f) => s + f.seoScore, 0) / total) : null;

  const fecha = now.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  const r = rubrosTexto(rubros);
  const pct = total ? Math.round((low / total) * 100) : 0;
  const title = `Auditoría SEO de páginas web de ${r} (${fecha})`;
  const summary =
    `Auditoría SEO de ${total} sitios web de ${r} en ${ciudades.join(', ') || 'varias ciudades'}. ` +
    `El ${pct}% (${low}) tiene un posicionamiento web débil y el promedio general es ${avg ?? '—'}/100. ` +
    `${withEmail} cuentan con un email público de contacto. ` +
    `El relevamiento evidencia oportunidades concretas de mejora en la presencia digital de los comercios de la zona.\n\n` +
    `🔍 Conocé el servicio Lead Finder Pro: https://marianoaliandri.com.ar/keywords`;

  return {
    filas, title, summary,
    stats: { total, withEmail, lowSeoCount: low, avgSeoScore: avg },
    config: { ciudades, pais: 'Argentina', radioKm, tiposLabels: rubros },
  };
}
