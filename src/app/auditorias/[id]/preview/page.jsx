import { notFound } from 'next/navigation';
import { getDb } from '@/lib/firebase-admin';
import AuditMapLoader from '../AuditMapLoader';

export const dynamic = 'force-dynamic';

// No indexar esta página
export const metadata = { robots: { index: false, follow: false } };

async function getAuditoria(id) {
  try {
    const db = getDb();
    if (!db) return null;
    const doc = await db.collection('auditorias').doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
    };
  } catch { return null; }
}

export default async function AuditoriaPreviewPage({ params }) {
  const { id } = await params;
  const a = await getAuditoria(id);
  if (!a) notFound();

  const results  = a.results || [];
  const ciudades = (a.config?.ciudades || []).join(' · ') || '';
  const scored   = results.filter(r => typeof r.seoScore === 'number');
  const nScored  = scored.length;
  const bands = [
    { key: 'debil', label: 'Débil',     sublabel: '< 40',   color: '#ef4444', n: scored.filter(r => r.seoScore < 40).length },
    { key: 'medio', label: 'Mejorable', sublabel: '40–69',  color: '#f59e0b', n: scored.filter(r => r.seoScore >= 40 && r.seoScore < 70).length },
    { key: 'bueno', label: 'Aceptable', sublabel: '70+',    color: '#22c55e', n: scored.filter(r => r.seoScore >= 70).length },
  ];
  const pct = (n) => (nScored ? Math.round((n / nScored) * 100) : 0);

  const hasMap = results.some(r => typeof r.lat === 'number' && typeof r.lon === 'number');

  return (
    <main
      className="bg-[#0a0a0a] min-h-screen"
      style={{ padding: '28px 32px 32px', fontFamily: 'system-ui,sans-serif' }}
    >
      {/* Header compacto */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: '#6366f1', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 6px' }}>
          Auditoría SEO · marianoaliandri.com.ar
        </p>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.2 }}>
          {a.title}
        </h1>
        {ciudades && (
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>📍 {ciudades}</p>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { value: a.stats?.total        ?? '—', label: 'Sitios analizados', color: '#ffffff' },
          { value: a.stats?.withEmail    ?? '—', label: 'Con email público',  color: '#4ade80' },
          { value: a.stats?.lowSeoCount  ?? '—', label: 'SEO débil',          color: '#f87171' },
          { value: a.stats?.avgSeoScore  ?? '—', label: 'Score promedio',     color: '#818cf8' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#111', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '14px 10px', textAlign: 'center',
          }}>
            <div style={{ color: s.color, fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
            <div style={{ color: '#6b7280', fontSize: 11, marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Distribución */}
      {nScored > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#6366f1', fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 8px' }}>
            Distribución de Score SEO
          </p>
          <div style={{ display: 'flex', gap: 2, height: 32, borderRadius: 6, overflow: 'hidden' }}>
            {bands.filter(b => b.n > 0).map(b => (
              <div key={b.key} style={{
                width: `${pct(b.n)}%`, background: b.color, minWidth: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.7)',
              }}>
                {pct(b.n) >= 8 ? `${b.n}` : ''}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
            {bands.map(b => (
              <span key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 11 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: b.color, display: 'inline-block' }} />
                {b.label} ({b.sublabel})
                <span style={{ color: '#e5e7eb', fontWeight: 700 }}>{b.n}</span>
                <span style={{ color: '#4b5563' }}>{pct(b.n)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Análisis Gemini */}
      {a.summary && (
        <div style={{
          background: '#111', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}>
          <p style={{ color: '#6366f1', fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 6px' }}>
            Análisis
          </p>
          <p style={{ color: '#d1d5db', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
            {a.summary}
          </p>
        </div>
      )}

      {/* Mapa */}
      {hasMap && (
        <div>
          <p style={{ color: '#6366f1', fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 8px' }}>
            Mapa de los negocios
          </p>
          <AuditMapLoader results={results} radioKm={a.config?.radioKm} ownDomains={[]} height={380} />
        </div>
      )}
    </main>
  );
}
