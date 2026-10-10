'use client';

import { useEffect, useRef, useState } from 'react';
import AdminIcon from '../admin/AdminIcon';

// Fichas de fichero: la activa toma el color de la hoja y se funde con el contenido.
// Si no entran a lo ancho se deslizan de costado, con un degradé que avisa que hay más.
export default function FolderTabs({ items, activeId, onSelect }) {
  const stripRef = useRef(null);
  const [fade, setFade] = useState({ l: false, r: false });

  const updateFade = () => {
    const el = stripRef.current;
    if (!el) return;
    setFade({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const active = el.querySelector('[aria-selected="true"]');
    if (active && (active.offsetLeft + active.offsetWidth > el.scrollLeft + el.clientWidth || active.offsetLeft < el.scrollLeft)) {
      el.scrollLeft = active.offsetLeft - 28;
    }
    updateFade();
  }, [activeId, items]);

  useEffect(() => {
    window.addEventListener('resize', updateFade);
    return () => window.removeEventListener('resize', updateFade);
  }, []);

  return (
    <div className={`sh-strip-wrap ${fade.l ? 'sh-fade-l' : ''} ${fade.r ? 'sh-fade-r' : ''}`}>
      <div className="sh-strip" role="tablist" aria-label="Pantallas de la sección" ref={stripRef} onScroll={updateFade}>
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="sh-ftab"
            aria-selected={item.id === activeId}
            onClick={() => onSelect(item)}
          >
            <span className="sh-ftab-bar" />
            <AdminIcon id={item.iconId || item.id} fallback={item.icon || '•'} size={15} />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
