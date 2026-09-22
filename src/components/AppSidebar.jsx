'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminIcon from './admin/AdminIcon';

// Sidebar colapsable (desktop) / drawer (mobile) compartido entre /admin y el área de
// cliente (mi-cuenta, mis-compras, etc.) -- mismo look, cada uno con sus propios items.
// Extraído de AdminPage.jsx (era un <aside> inline, ver git blame de este archivo).
//
// Cada item de "sections" es { id, label, icon (emoji fallback), href } para navegar con
// next/link (rutas reales, lo que usa el área de cliente) o { id, label, icon, onClick }
// para SPAs internas que cambian de "tab" sin cambiar de URL (lo que usa /admin).
export default function AppSidebar({
  sections,
  activeId,
  navOpen,
  onNavOpenChange,
  storageKey,
  headerTitle,
  headerSubtitle,
  footer,
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(storageKey) === 'true');
  }, [storageKey]);

  const toggleCollapsed = () => {
    setCollapsed(v => {
      localStorage.setItem(storageKey, String(!v));
      return !v;
    });
  };

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 shrink-0 overflow-y-auto p-3 bg-white dark:bg-[#111827] border-r border-gray-200 dark:border-[#243350] transition-[transform,width] duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-16' : 'md:w-60'} w-64`}
      >
        <div className="flex items-center justify-between px-1 pb-3 mb-2 border-b border-gray-200 dark:border-[#243350]">
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{headerTitle}</p>
              {headerSubtitle && <p className="text-[11px] text-gray-500 truncate">{headerSubtitle}</p>}
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#172033] transition-colors shrink-0"
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        <nav className="space-y-0.5">
          {sections.map(section => (
            <div key={section.id}>
              {collapsed
                ? <div className="my-2 border-t border-gray-200 dark:border-[#243350]" />
                : section.label && (
                  <p className="px-2.5 pt-4 pb-1.5 text-[10.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {section.label}
                  </p>
                )}
              {section.items.map(it => {
                const isActive = it.id === activeId;
                const itemClassName = `w-full flex items-center gap-2.5 px-2.5 min-h-[34px] rounded-lg text-[13px] text-left transition-colors ${collapsed ? 'justify-center' : ''} ${isActive
                  ? 'bg-indigo-50 dark:bg-[#232a5c] text-gray-900 dark:text-white font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#172033] font-medium'}`;
                const content = (
                  <>
                    <span className={`shrink-0 flex ${isActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                      <AdminIcon id={it.iconId || it.id} fallback={it.icon} />
                    </span>
                    {!collapsed && <span className="truncate">{it.label}</span>}
                  </>
                );
                return it.href ? (
                  <Link
                    key={it.id}
                    href={it.href}
                    title={collapsed ? it.label : undefined}
                    onClick={() => onNavOpenChange?.(false)}
                    className={itemClassName}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={it.id}
                    onClick={() => { it.onClick?.(); onNavOpenChange?.(false); }}
                    title={collapsed ? it.label : undefined}
                    className={itemClassName}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {footer && <div className="mt-4 pt-3 border-t border-gray-200 dark:border-[#243350]">{footer}</div>}
      </aside>

      {navOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => onNavOpenChange?.(false)}
        />
      )}
    </>
  );
}
