'use client';

const FUENTE_LABEL = {
  '(direct) / (none)': 'Directo',
  'google / organic': 'Google (orgánico)',
  'm.facebook.com / referral': 'Facebook (móvil)',
  'facebook.com / referral': 'Facebook',
  'l.facebook.com / referral': 'Facebook',
  'lm.facebook.com / referral': 'Facebook',
  'linkedin.com / referral': 'LinkedIn',
};

function Lista({ titulo, items, unidad }) {
  const max = Math.max(1, ...items.map(i => i.valor));
  return (
    <div className="min-w-0">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{titulo}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">Sin datos.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(i => (
            <li key={i.key} className="text-xs" title={i.hint}>
              <div className="flex justify-between gap-2">
                {i.href ? (
                  <a href={i.href} target="_blank" rel="noopener noreferrer"
                     className="truncate text-gray-700 dark:text-gray-200 hover:text-amber-600">{i.label}</a>
                ) : (
                  <span className="truncate text-gray-700 dark:text-gray-200">{i.label}</span>
                )}
                <span className="shrink-0 tabular-nums text-gray-500">{i.valor.toLocaleString('es-AR')} {unidad}</span>
              </div>
              <div className="h-1 mt-0.5 rounded bg-gray-100 dark:bg-gray-700">
                <div className="h-1 rounded bg-amber-500/70" style={{ width: `${(i.valor / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function tituloCorto(p) {
  if (p.path === '/') return 'Home';
  const t = (p.titulo || '').split(' | ')[0].trim();
  return t && t !== '(not set)' ? t : p.path;
}

export default function GA4DetailWidget({ data }) {
  if (!data || data.noData) return null;
  const { paginas = [], fuentes = [], ciudades = [], usuarios = 0, bots = 0 } = data;

  return (
    <>
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Qué vio la gente · 28 días</span>
        <span className="text-xs text-gray-400">
          {usuarios.toLocaleString('es-AR')} personas · sin contar {bots.toLocaleString('es-AR')} bots de data centers (Meta/Google/AWS) ni tus páginas privadas
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Lista
          titulo="Páginas más vistas"
          unidad="vistas"
          items={paginas.map(p => ({
            key: p.path, label: tituloCorto(p), valor: p.vistas, href: p.path,
            hint: `${p.path} — ${p.usuarios} personas`,
          }))}
        />
        <Lista
          titulo="De dónde llegaron"
          unidad="ses."
          items={fuentes.map(f => ({ key: f.fuente, label: FUENTE_LABEL[f.fuente] || f.fuente, valor: f.sesiones, hint: f.fuente }))}
        />
        <Lista
          titulo="Ciudades"
          unidad="pers."
          items={ciudades.map(c => ({ key: c.ciudad, label: c.ciudad === '(not set)' ? 'Desconocida' : c.ciudad, valor: c.usuarios }))}
        />
      </div>
    </>
  );
}
