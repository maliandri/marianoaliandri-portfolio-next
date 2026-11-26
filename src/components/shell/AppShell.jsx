'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminIcon, { SECTION_ICON } from '../admin/AdminIcon';
import FolderTabs from './FolderTabs';

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Esqueleto "fichero": secciones siempre visibles a la izquierda (en celular, una fila
// de chips deslizable), y los items de la sección activa como fichas arriba.
// Items con `href` navegan por URL (área de cliente); sin href llaman a onNavigate (admin).
export default function AppShell({
  variant = 'admin',
  forceDark = false,
  className = '',
  brand,
  sections,
  activeSectionId,
  activeItemId,
  onNavigate,
  searchable = false,
  footer,
  homeItemId = null,      // celular: item que abre el botón "Inicio" de la barra de abajo
  mobilePrimary = [],     // celular: ids de secciones preferidas para la barra de abajo (el resto va a "Más")
  children,
}) {
  const router = useRouter();
  const activeSection = sections.find(s => s.id === activeSectionId) || sections[0];
  const [sheet, setSheet] = useState(null); // celular: null | id de sección | 'mas'

  const go = (section, item) => {
    const target = item || section.items[0];
    if (!target) return;
    setSheet(null);
    if (target.href) router.push(target.href);
    else onNavigate?.(section.id, target.id);
  };

  // --- Celular "como una app" (2026-11-26): barra de abajo con Inicio + secciones principales + "Más",
  // y una hoja desde abajo con las pantallas de cada sección como íconos grandes.
  const homeSection = homeItemId ? sections.find(s => s.items.some(i => i.id === homeItemId)) : null;
  const lugares = homeSection ? 3 : 4;
  const entranTodas = sections.length <= lugares + 1;
  const preferidas = mobilePrimary.map(id => sections.find(s => s.id === id)).filter(Boolean);
  const primarias = entranTodas ? sections : [...preferidas, ...sections.filter(s => !preferidas.includes(s))].slice(0, lugares);
  const resto = sections.filter(s => !primarias.includes(s));
  const conMas = resto.length > 0 || searchable;
  const activeItem = activeSection?.items.find(i => i.id === activeItemId);
  const enInicio = !!homeItemId && activeItemId === homeItemId;
  const tocarSeccion = (s) => (s.items.length === 1 ? go(s) : setSheet(cur => (cur === s.id ? null : s.id)));
  const hojaSeccion = sheet && sheet !== 'mas' ? sections.find(s => s.id === sheet) : null;

  useEffect(() => {
    if (!sheet) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSheet(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  const shellClass = [
    'app-shell',
    variant === 'client' ? 'sh-client' : '',
    forceDark ? 'sh-force-dark' : '',
    className,
  ].join(' ');

  const footActions = footer?.actions?.map(a => {
    const content = <AdminIcon id={a.icon} fallback="•" />;
    const cls = `sh-ibtn ${a.danger ? 'sh-danger' : ''}`;
    return a.href
      ? <Link key={a.id} href={a.href} className={cls} title={a.label} aria-label={a.label}>{content}</Link>
      : <button key={a.id} type="button" onClick={a.onClick} className={cls} title={a.label} aria-label={a.label}>{content}</button>;
  });

  return (
    <div className={shellClass}>
      <aside className="sh-side" aria-label="Secciones">
        <div className="sh-brand">
          <div className="sh-brand-logo">{brand?.logo || 'M'}</div>
          <div className="min-w-0">
            <div className="sh-brand-t">{brand?.title}</div>
            {brand?.subtitle && <div className="sh-brand-s">{brand.subtitle}</div>}
          </div>
          <div className="sh-foot-mobile ml-auto flex items-center gap-1">
            {footer?.extra}
            {footActions}
          </div>
        </div>

        {searchable && <ShellSearch sections={sections} onPick={go} />}

        <div className="sh-label">SECCIONES</div>
        <ul className="sh-sections">
          {sections.map(s => {
            const current = s.id === activeSection?.id;
            return (
              <li key={s.id}>
                <button type="button" className="sh-sec" aria-current={current} onClick={() => go(s)}>
                  <AdminIcon id={current ? (SECTION_ICON[s.id] || 'folder') : 'folder'} fallback="▸" size={17} />
                  <span className="truncate">{s.label}</span>
                  <span className="sh-sec-count">{s.items.length}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {footer && (
          <div className="sh-foot sh-foot-desktop">
            <div className="sh-avatar">{footer.initials}</div>
            <div className="sh-who">
              {footer.name}
              {footer.detail && <small>{footer.detail}</small>}
            </div>
            <div className="sh-foot-acts">
              {footer.extra}
              {footActions}
            </div>
          </div>
        )}
      </aside>

      <div className="sh-main">
        {/* Celular: barra de arriba con la pantalla actual */}
        <header className="sh-mtop">
          <div className="sh-brand-logo">{brand?.logo || 'M'}</div>
          <div className="min-w-0 flex-1">
            <div className="sh-mtop-t">{enInicio ? (brand?.title || 'Inicio') : (activeItem?.label || activeSection?.label)}</div>
            {!enInicio && activeSection && <div className="sh-mtop-s">{activeSection.label}</div>}
          </div>
          <div className="flex items-center gap-1">
            {footer?.extra}
            {footActions}
          </div>
        </header>

        {activeSection && !enInicio && activeSection.items.length > 1 && (
          <FolderTabs
            items={activeSection.items}
            activeId={activeItemId}
            onSelect={item => go(activeSection, item)}
          />
        )}
        {activeSection && enInicio && (
          <div className="sh-desktop-only">
            <FolderTabs items={activeSection.items} activeId={activeItemId} onSelect={item => go(activeSection, item)} />
          </div>
        )}
        <main className="sh-content">{children}</main>
      </div>

      {/* Celular: barra de abajo */}
      <nav className="sh-mbar" aria-label="Secciones">
        {homeSection && (
          <button type="button" className="sh-mbar-b" aria-current={enInicio && !sheet} onClick={() => go(homeSection, homeSection.items.find(i => i.id === homeItemId))}>
            <AdminIcon id="inicio" fallback="🏠" size={21} />
            <span>Inicio</span>
          </button>
        )}
        {primarias.map(s => (
          <button key={s.id} type="button" className="sh-mbar-b"
            aria-current={sheet ? sheet === s.id : (!enInicio && s.id === activeSection?.id)}
            aria-expanded={sheet === s.id} onClick={() => tocarSeccion(s)}>
            <AdminIcon id={SECTION_ICON[s.id] || 'folder'} fallback={s.icon || '▸'} size={21} />
            <span>{s.label}</span>
          </button>
        ))}
        {conMas && (
          <button type="button" className="sh-mbar-b"
            aria-current={sheet ? sheet === 'mas' : (!enInicio && resto.some(s => s.id === activeSection?.id))}
            aria-expanded={sheet === 'mas'} onClick={() => setSheet(cur => (cur === 'mas' ? null : 'mas'))}>
            <span className="sh-mbar-mas" aria-hidden>•••</span>
            <span>Más</span>
          </button>
        )}
      </nav>

      {/* Celular: hoja con las pantallas como íconos */}
      {sheet && (
        <div className="sh-sheet" role="dialog" aria-modal="true" aria-label={hojaSeccion ? hojaSeccion.label : 'Más'}>
          <button type="button" className="sh-sheet-bg" aria-label="Cerrar" onClick={() => setSheet(null)} />
          <div className="sh-sheet-panel">
            <div className="sh-sheet-grip" aria-hidden />
            {hojaSeccion ? (
              <>
                <div className="sh-sheet-t">{hojaSeccion.label}</div>
                <Tiles section={hojaSeccion} activeItemId={activeItemId} onPick={go} />
              </>
            ) : (
              <>
                {searchable && <ShellSearch sections={sections} onPick={go} />}
                {resto.map(s => (
                  <div key={s.id} className="sh-sheet-sec">
                    <div className="sh-sheet-t">{s.label}</div>
                    <Tiles section={s} activeItemId={activeItemId} onPick={go} />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Pantallas de una sección como íconos de app (hoja del celular y launcher del inicio).
export function Tiles({ section, activeItemId, onPick, excluir = [] }) {
  return (
    <div className="sh-tiles">
      {section.items.filter(i => !excluir.includes(i.id)).map(item => (
        <button key={item.id} type="button" className="sh-tile" aria-current={item.id === activeItemId} onClick={() => onPick(section, item)}>
          <span className="sh-tile-ic"><AdminIcon id={item.iconId || item.id} fallback={item.icon || '•'} size={22} /></span>
          <span className="sh-tile-l">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function ShellSearch({ sections, onPick }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const inputRef = useRef(null);

  const all = useMemo(
    () => sections.flatMap(s => s.items.map(item => ({ section: s, item }))),
    [sections],
  );
  const results = useMemo(() => {
    if (!q.trim()) return [];
    const nq = norm(q.trim());
    return all.filter(r => norm(r.item.label).includes(nq) || norm(r.section.label).includes(nq)).slice(0, 8);
  }, [q, all]);

  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setHl(0); }, [q]);

  const pick = r => {
    onPick(r.section, r.item);
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHl(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHl(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && results[hl]) { e.preventDefault(); pick(results[hl]); }
    else if (e.key === 'Escape') { setQ(''); inputRef.current?.blur(); }
  };

  return (
    <div className="sh-search">
      <AdminIcon id="buscar" fallback="⌕" size={14} />
      <input
        ref={inputRef}
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder="Ir a una pantalla…"
        aria-label="Buscar pantalla"
        autoComplete="off"
      />
      <kbd>Ctrl K</kbd>
      {open && results.length > 0 && (
        <div className="sh-results" role="listbox">
          {results.map((r, i) => (
            <button
              key={`${r.section.id}-${r.item.id}`}
              type="button"
              data-hl={i === hl}
              onMouseDown={e => { e.preventDefault(); pick(r); }}
            >
              <span>{r.item.label}</span>
              <small>{r.section.label}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
