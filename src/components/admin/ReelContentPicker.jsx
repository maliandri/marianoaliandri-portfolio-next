'use client';
import React, { useRef, useState } from 'react';

const CATEGORIES = [
  { id: 'producto',    label: 'Producto' },
  { id: 'tecnologia',  label: 'Tecnología' },
  { id: 'proyecto',    label: 'Proyecto' },
  { id: 'herramienta', label: 'Herramientas' },
];

// Selector de contenido para el generador de reels — mezcla libre entre
// categorías: cada fila del catálogo (de CUALQUIER pestaña) se puede tildar
// independientemente, y todas conviven en la misma bandeja (`tray`) del padre.
// Ya no hay un "modo multi" separado: elegir 1 sola cosa es simplemente una
// bandeja con 1 item.
export default function ReelContentPicker({
  activeCategory, onActiveCategoryChange,
  products, techItems, projects, tools,
  tray, onToggleItem, maxItems = 10,
  onUploadImage, onUploadVideo, uploadingMedia,
}) {
  const [projectsLoading] = useState(false);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const isInTray = (sourceCategory, sourceId) =>
    tray.some((t) => t.sourceCategory === sourceCategory && t.sourceId === sourceId);

  const trayFull = tray.length >= maxItems;

  function handleImageFile(e) {
    const file = e.target.files?.[0];
    if (file) onUploadImage(file);
    e.target.value = '';
  }
  function handleVideoFile(e) {
    const file = e.target.files?.[0];
    if (file) onUploadVideo(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => onActiveCategoryChange(c.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === c.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >{c.label}</button>
        ))}
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-neutral-800 rounded-xl p-2">
        {activeCategory === 'producto' && products.length === 0 && (
          <p className="text-xs text-gray-400 p-2">Sin productos disponibles.</p>
        )}
        {activeCategory === 'producto' && products.map((p) => {
          const checked = isInTray('producto', p.id);
          return (
            <button key={p.id}
              disabled={!checked && trayFull}
              onClick={() => onToggleItem({
                sourceCategory: 'producto', sourceId: p.id, mediaType: 'image',
                mediaUrl: p.image, name: p.name, subtitleHint: '',
                raw: { ...p, type: 'producto' },
              })}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-40 ${
                checked
                  ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            ><span>{checked ? '☑' : '☐'}</span>{p.name}</button>
          );
        })}

        {activeCategory === 'tecnologia' && techItems.map((t) => {
          const checked = isInTray('tecnologia', t.id);
          return (
            <button key={t.id}
              disabled={!checked && trayFull}
              onClick={() => onToggleItem({
                sourceCategory: 'tecnologia', sourceId: t.id, mediaType: 'image',
                mediaUrl: t.imageUrl, name: t.name, subtitleHint: t.category,
                raw: { ...t, type: 'tecnologia' },
              })}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-40 ${
                checked
                  ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            ><span>{checked ? '☑' : '☐'}</span>{t.name} <span className="text-gray-400">— {t.category}</span></button>
          );
        })}

        {activeCategory === 'proyecto' && projects.length === 0 && (
          <p className="text-xs text-gray-400 p-2">{projectsLoading ? 'Cargando proyectos…' : 'Sin proyectos disponibles.'}</p>
        )}
        {activeCategory === 'proyecto' && projects.map((p) => {
          const checked = isInTray('proyecto', p.domain);
          return (
            <button key={p.domain}
              disabled={!checked && trayFull}
              onClick={() => onToggleItem({
                sourceCategory: 'proyecto', sourceId: p.domain, mediaType: 'image',
                mediaUrl: p.screenshotUrl, name: p.domain, subtitleHint: '',
                raw: { ...p, id: p.domain, name: p.domain, type: 'proyecto' },
              })}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-40 ${
                checked
                  ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            ><span>{checked ? '☑' : '☐'}</span>{p.domain}</button>
          );
        })}

        {activeCategory === 'herramienta' && tools.map((tool, i) => {
          const checked = isInTray('herramienta', tool.href);
          return (
            <button key={tool.href}
              disabled={!checked && trayFull}
              onClick={() => onToggleItem({
                sourceCategory: 'herramienta', sourceId: tool.href, mediaType: 'image',
                mediaUrl: null, // se resuelve en el padre (placeholder generado por canvas)
                toolIndex: i,
                name: tool.label, subtitleHint: tool.desc,
                raw: { ...tool, type: 'herramienta' },
              })}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-40 ${
                checked
                  ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            ><span>{checked ? '☑' : '☐'}</span>{tool.icon} {tool.label} <span className="text-gray-400">— {tool.desc}</span></button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoFile} />
        <button onClick={() => imageInputRef.current?.click()} disabled={trayFull || uploadingMedia}
          className="flex-1 py-2 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
        >{uploadingMedia === 'image' ? 'Subiendo…' : 'Subir imagen'}</button>
        <button onClick={() => videoInputRef.current?.click()} disabled={trayFull || uploadingMedia}
          className="flex-1 py-2 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
        >{uploadingMedia === 'video' ? 'Subiendo…' : 'Subir video'}</button>
      </div>
      {trayFull && <p className="text-[11px] text-amber-600 dark:text-amber-400">Máximo {maxItems} items en el reel — sacá uno para agregar otro.</p>}
    </div>
  );
}
