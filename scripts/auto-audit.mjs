// Auditoría SEO automática — corre en GitHub Actions, no en Vercel (Hobby corta a los 60 s).
// Se ejecuta con: npx tsx --tsconfig jsconfig.json scripts/auto-audit.mjs
// Importa con import() dinámico: un .mjs suelto no puede importar de src/ con imports estáticos
// (esos archivos se interpretan como CommonJS y no exponen las exportaciones con nombre).
const mod = await import('../src/lib/autoAuditRun.js');
const runAutoAudit = mod.runAutoAudit || mod.default?.runAutoAudit;
if (typeof runAutoAudit !== 'function') {
  console.error('[auto-audit] no se pudo cargar runAutoAudit');
  process.exit(1);
}

try {
  const result = await runAutoAudit({
    budgetMs: 8 * 60 * 1000, // sin el tope de 60 s de Vercel; el job tiene timeout de 20 min
    maxSites: 15,
    maxCandidates: 30,       // ~30 getDetails por corrida: 4 corridas/semana ≈ 520/mes, la mitad del cupo gratis (1.000)
  });
  console.log('[auto-audit]', JSON.stringify(result));
  // Falla el job solo en errores reales; "skipped" y "sin_resultados" son normales.
  if (result.estado === 'error' || result.estado === 'post_fallido') process.exit(1);
  process.exit(0);
} catch (e) {
  console.error('[auto-audit] error:', e.message);
  process.exit(1);
}
