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
  children,
}) {
  const router = useRouter();
  const activeSection = sections.find(s => s.id === activeSectionId) || sections[0];

  const go = (section, item) => {
    const target = item || section.items[0];
    if (!target) return;
    if (target.href) router.push(target.href);
    else onNavigate?.(section.id, target.id);
  };

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
        {activeSection && (
          <FolderTabs
            items={activeSection.items}
            activeId={activeItemId}
            onSelect={item => go(activeSection, item)}
          />
        )}
        <main className="sh-content">{children}</main>
      </div>
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
