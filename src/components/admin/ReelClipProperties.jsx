'use client';
import React from 'react';
import { CLIP_TRANSITIONS } from '../../utils/canvasReelService';

// Panel único del clip seleccionado — junta lo que antes estaba disperso en
// 3 lugares distintos de la pantalla: transición de entrada, tamaño del texto,
// y (para clips de video) su propio volumen.
export default function ReelClipProperties({ clip, onUpdateClip, isScrubbing, onResumePreview }) {
  if (!clip) {
    return (
      <div className="text-xs text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-3 text-center">
        Elegí contenido para ver las propiedades del clip acá.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
          Clip: {clip.title || '(sin título)'} {clip.type === 'video' && <span className="text-purple-400">🎬</span>}
        </p>
        {isScrubbing && (
          <button onClick={onResumePreview} className="text-[10px] px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-full transition-colors shrink-0">
            ▶ Reanudar
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 shrink-0 w-24">Transición</span>
        <select
          value={clip.transitionIn || 'cut'}
          onChange={(e) => onUpdateClip({ transitionIn: e.target.value })}
          className="flex-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1"
        >
          {CLIP_TRANSITIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 shrink-0 w-24">Tamaño texto</span>
        <input type="range" min="0.5" max="2" step="0.05" value={clip.textScale ?? 1}
          onChange={(e) => onUpdateClip({ textScale: parseFloat(e.target.value) })}
          className="flex-1 accent-purple-500"
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
        Duración: {clip.duration?.toFixed(1)}s — arrastrá el título en el preview para moverlo
        {clip.type === 'video' && ' · el video mantiene su propio audio, solo suena mientras está activo'}.
      </p>
    </div>
  );
}
