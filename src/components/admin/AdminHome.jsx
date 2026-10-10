'use client';

import AdminIcon, { SECTION_ICON } from './AdminIcon';

const SECTION_DESC = {
  panel: 'Métricas del sitio, ventas y visitas',
  tienda: 'Productos, órdenes, presupuestos y clientes',
  redes: 'Publicar, reels, LinkedIn y bot de noticias',
  marketing: 'Lead Finder, auditorías SEO y consumo de Google',
  sitio: 'Proyectos, preguntas y estructura del menú',
  herramientas: 'Rubros más buscados por provincia y localidad',
  dev: 'Catálogo de servicios gratis para desarrollo',
};

const DATE_FMT = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

export default function AdminHome({ navTree, username, onGo }) {
  const name = username ? username.charAt(0).toUpperCase() + username.slice(1) : 'Mariano';
  const sections = navTree
    .map(s => ({ ...s, items: s.items.filter(i => i.id !== 'inicio') }))
    .filter(s => s.items.length > 0);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: 'var(--sh-ink)' }}>
            Hola, {name} 👋
          </h1>
          <p className="mt-1 first-letter:uppercase" style={{ color: 'var(--sh-muted)' }}>
            {DATE_FMT.format(new Date())}. Elegí por dónde arrancar.
          </p>
        </div>
        <span className="sh-card flex items-center gap-2 px-3 py-1.5 text-[11.5px] font-bold" style={{ borderRadius: 999 }}>
          <span className="w-[7px] h-[7px] rounded-full" style={{ background: 'var(--sh-ok)' }} />
          Administrador
        </span>
      </div>

      <div className="sh-eyebrow mb-3">Accesos rápidos</div>
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => onGo(s.items[0].id)}
            className="sh-card text-left p-[18px] flex flex-col gap-3 min-h-[150px] transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:[border-color:var(--sh-accent-hi)]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[11px] grid place-items-center shrink-0" style={{ background: 'var(--sh-accent-soft)', color: 'var(--sh-accent-hi)' }}>
                <AdminIcon id={SECTION_ICON[s.id] || 'folder'} fallback={s.icon} size={20} />
              </div>
              <div>
                <h3 className="text-[15px] font-extrabold tracking-tight" style={{ color: 'var(--sh-ink)' }}>{s.label}</h3>
                <p className="text-[11.5px] font-semibold" style={{ color: 'var(--sh-muted)' }}>
                  {s.items.length} {s.items.length === 1 ? 'pantalla' : 'pantallas'}
                </p>
              </div>
            </div>
            {SECTION_DESC[s.id] && (
              <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--sh-muted)' }}>{SECTION_DESC[s.id]}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-auto">
              {s.items.slice(0, 5).map(i => (
                <span
                  key={i.id}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-[7px]"
                  style={{ background: 'var(--sh-cream)', border: '1px solid var(--sh-line-soft)', color: 'var(--sh-ink-2)' }}
                >
                  {i.label}
                </span>
              ))}
              {s.items.length > 5 && (
                <span className="text-[11px] font-semibold px-2 py-0.5" style={{ color: 'var(--sh-muted)' }}>+{s.items.length - 5}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
