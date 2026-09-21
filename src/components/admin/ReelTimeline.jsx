'use client';
import React, { useRef, useState } from 'react';

const TRACK_HEIGHT = 56;

// Timeline tipo CapCut, solo con Pointer Events (sin librería de drag-and-drop).
// Tres gestos sobre el mismo track: arrastrar el cuerpo de un bloque reordena,
// arrastrar su borde derecho cambia su duración (resta lo mismo al siguiente),
// y arrastrar en cualquier otra parte del track mueve el playhead (scrub).
export default function ReelTimeline({
  clips, selectedClipId, currentTime, totalDuration,
  onSelectClip, onReorder, onResizeDuration,
  onScrubStart, onScrub, onScrubEnd,
}) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(null);

  const total = totalDuration || 1;

  function pxToTime(clientX) {
    const rect = trackRef.current.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return frac * total;
  }

  function handleTrackPointerDown(e) {
    // Solo dispara scrub si el click no vino de un bloque/handle (esos hacen
    // stopPropagation en su propio pointerdown).
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({ type: 'scrub' });
    onScrubStart?.();
    onScrub?.(pxToTime(e.clientX));
  }

  function handleTrackPointerMove(e) {
    if (!dragging) return;
    if (dragging.type === 'scrub') {
      onScrub?.(pxToTime(e.clientX));
      return;
    }
    if (dragging.type === 'resize') {
      const rect = trackRef.current.getBoundingClientRect();
      const deltaSec = ((e.clientX - dragging.startX) / rect.width) * total;
      onResizeDuration?.(dragging.clipId, dragging.startDuration + deltaSec);
      return;
    }
    if (dragging.type === 'reorder') {
      const blocks = trackRef.current.querySelectorAll('[data-clip-idx]');
      for (const el of blocks) {
        const r = el.getBoundingClientRect();
        const mid = r.left + r.width / 2;
        const overIdx = Number(el.dataset.clipIdx);
        const from = dragging.fromIdx;
        if (overIdx !== from && ((from < overIdx && e.clientX > mid) || (from > overIdx && e.clientX < mid))) {
          onReorder?.(from, overIdx);
          setDragging((d) => (d ? { ...d, fromIdx: overIdx } : d));
          break;
        }
      }
    }
  }

  function handlePointerUp() {
    if (dragging?.type === 'scrub') onScrubEnd?.();
    setDragging(null);
  }

  function handleBlockPointerDown(idx, clip) {
    return (e) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      onSelectClip?.(clip.id);
      setDragging({ type: 'reorder', fromIdx: idx });
    };
  }

  function handleResizePointerDown(clip) {
    return (e) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging({ type: 'resize', clipId: clip.id, startX: e.clientX, startDuration: clip.duration });
    };
  }

  return (
    <div className="space-y-1">
      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={handlePointerUp}
        className="relative bg-[#0a0a0a] border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden cursor-pointer select-none"
        style={{ height: TRACK_HEIGHT, touchAction: 'none' }}
      >
        <div className="flex h-full">
          {clips.map((clip, idx) => (
            <div
              key={clip.id}
              data-clip-idx={idx}
              onPointerDown={handleBlockPointerDown(idx, clip)}
              className={`relative h-full border-r border-black/40 shrink-0 bg-cover bg-center flex items-center justify-center ${
                selectedClipId === clip.id ? 'ring-2 ring-indigo-400 ring-inset' : ''
              }`}
              style={
                clip.type === 'video'
                  ? { width: `${(clip.duration / total) * 100}%`, background: 'linear-gradient(135deg,#7c3aed,#db2777)' }
                  : {
                      width: `${(clip.duration / total) * 100}%`,
                      backgroundImage: clip.imageUrl ? `url(${clip.imageUrl})` : undefined,
                      backgroundColor: clip.imageUrl ? undefined : '#333',
                    }
              }
            >
              {clip.type === 'video' && <span className="text-white text-sm drop-shadow">▶</span>}
              <span className="absolute bottom-0.5 left-1 text-[9px] text-white bg-black/60 px-1 rounded leading-tight">
                {clip.duration.toFixed(1)}s
              </span>
              <div
                onPointerDown={handleResizePointerDown(clip)}
                className="absolute top-0 right-0 h-full w-2 cursor-ew-resize bg-white/10 hover:bg-white/40"
              />
            </div>
          ))}
        </div>
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none"
          style={{ left: `${Math.min(100, Math.max(0, (currentTime / total) * 100))}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-500 text-center">
        Arrastrá un bloque para reordenar · el borde derecho para su duración · el track para saltar a un punto
      </p>
    </div>
  );
}
