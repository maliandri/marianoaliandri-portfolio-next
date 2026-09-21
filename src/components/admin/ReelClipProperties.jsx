'use client';
import React from 'react';
import { CLIP_TRANSITIONS, TEXT_EFFECTS, FONT_FAMILIES } from '../../utils/canvasReelService';
import { MIN_CLIP_DURATION } from '../../utils/canvasReelService';

// Panel único del clip seleccionado — junta lo que antes estaba disperso o era
// global: texto, duración, fuente, efecto de entrada, transición, y (para
// clips de video) su propio volumen. Cada clip es 100% independiente del resto.
export default function ReelClipProperties({ clip, onUpdateClip, isScrubbing, onResumePreview }) {
  if (!clip) {
    return (
      <div className="text-xs text-gray-500 border border-dashed border-gray-200 dark:border-neutral-700 rounded-xl p-4 text-center">
        Elegí contenido para ver las propiedades del clip acá.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Clip seleccionado {clip.type === 'video' && <span className="text-indigo-600 dark:text-indigo-400 normal-case tracking-normal font-semibold">· video</span>}
        </p>
        {isScrubbing && (
          <button onClick={onResumePreview} className="text-[11px] px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors shrink-0">
            Reanudar
          </button>
        )}
      </div>

      {/* Texto — título y subtítulo editables de este clip puntual */}
      <div className="space-y-1.5">
        <input
          value={clip.title || ''}
          onChange={(e) => onUpdateClip({ title: e.target.value, titleManuallyEdited: true })}
          placeholder="Título de este clip"
          className="w-full text-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5"
        />
        <input
          value={clip.subtitle || ''}
          onChange={(e) => onUpdateClip({ subtitle: e.target.value, titleManuallyEdited: true })}
          placeholder="Subtítulo de este clip (opcional)"
          className="w-full text-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5"
        />
      </div>

      {/* Duración exacta — alternativa a arrastrar el borde en el timeline */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 shrink-0 w-24">Duración (s)</span>
        <input type="number" min={MIN_CLIP_DURATION} step="0.1" value={Number(clip.duration ?? 0).toFixed(1)}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) onUpdateClip({ duration: Math.max(MIN_CLIP_DURATION, v) });
          }}
          className="flex-1 text-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1"
        />
      </div>

      {/* Fuente */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 shrink-0 w-24">Fuente</span>
        <select
          value={clip.fontFamily || FONT_FAMILIES[0].css}
          onChange={(e) => onUpdateClip({ fontFamily: e.target.value })}
          className="flex-1 text-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1"
        >
          {FONT_FAMILIES.map((f) => <option key={f.id} value={f.css}>{f.label}</option>)}
        </select>
      </div>

      {/* Efecto de entrada del texto — por clip, no global */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 shrink-0 w-24">Efecto entrada</span>
        <select
          value={clip.textEffect || 'slideup'}
          onChange={(e) => onUpdateClip({ textEffect: e.target.value })}
          className="flex-1 text-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1"
        >
          {TEXT_EFFECTS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 shrink-0 w-24">Transición</span>
        <select
          value={clip.transitionIn || 'cut'}
          onChange={(e) => onUpdateClip({ transitionIn: e.target.value })}
          className="flex-1 text-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1"
        >
          {CLIP_TRANSITIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 shrink-0 w-24">Tamaño texto</span>
        <input type="range" min="0.5" max="2" step="0.05" value={clip.textScale ?? 1}
          onChange={(e) => onUpdateClip({ textScale: parseFloat(e.target.value) })}
          className="flex-1 accent-indigo-500"
        />
        <span className="text-[10px] text-gray-400 w-9 text-right">{(clip.textScale ?? 1).toFixed(2)}×</span>
      </div>

      {clip.type === 'video' && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 shrink-0 w-24">Volumen video</span>
          <input type="range" min="0" max="1" step="0.05" value={clip.videoVolume ?? 1}
            onChange={(e) => onUpdateClip({ videoVolume: parseFloat(e.target.value) })}
            className="flex-1 accent-pink-500"
          />
          <span className="text-[10px] text-gray-400 w-9 text-right">{Math.round((clip.videoVolume ?? 1) * 100)}%</span>
        </div>
      )}

      <p className="text-[10px] text-gray-600">
        Arrastrá el título en el preview para moverlo
        {clip.type === 'video' && ' · el video mantiene su propio audio, solo suena mientras está activo'}.
      </p>
    </div>
  );
}
