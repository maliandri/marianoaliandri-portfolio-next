'use client';

import React, { useState } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';

// Historia de Instagram desde Publicación Libre. No pasa por Make (no tiene módulo de historias):
// /api/publish-story/ arma el medio en 9:16 y lo publica directo con la Graph API.
const TIPOS = [
  { id: 'texto', label: 'Texto', hint: 'Tarjeta de marca 9:16 con tu texto' },
  { id: 'imagen', label: 'Imagen', hint: 'Se ajusta a 9:16 sin recortar (fondo desenfocado)' },
  { id: 'video', label: 'Video', hint: 'MP4 vertical, se recorta a 60 s' },
];
const MAX_TITULO = 150;

async function uploadRaw(file, resourceType) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dlshym1te';
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', 'portfolio_reels');
  form.append('folder', 'social/historias');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: 'POST', body: form });
  const data = await res.json();
  if (!data.secure_url) throw new Error(data.error?.message || 'No se pudo subir el archivo');
  return data.secure_url;
}

export default function StoryComposer({ showMessage }) {
  const { getIdToken } = useAuthUser();
  const [tipo, setTipo] = useState('texto');
  const [titulo, setTitulo] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState('');

  const reset = () => { setMediaUrl(''); setPreviewUrl(''); };

  const call = async (body) => {
    const token = await getIdToken();
    const res = await fetch('/api/publish-story/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy('Subiendo…');
    setPreviewUrl('');
    try {
      setMediaUrl(await uploadRaw(file, tipo === 'video' ? 'video' : 'image'));
    } catch (err) {
      showMessage('error', err.message);
    } finally {
      setBusy('');
    }
  };

  const handlePreview = async () => {
    setBusy('Armando la vista previa…');
    try {
      const { previewUrl: url } = await call({ tipo, titulo, etiqueta, mediaUrl, dryRun: true });
      setPreviewUrl(url);
    } catch (err) {
      showMessage('error', err.message);
    } finally {
      setBusy('');
    }
  };

  const handlePublish = async () => {
    setBusy(tipo === 'video' ? 'Publicando (el video puede tardar un par de minutos)…' : 'Publicando…');
    try {
      await call({ tipo, previewUrl });
      showMessage('success', '¡Historia publicada en Instagram!');
      setTitulo('');
      reset();
    } catch (err) {
      showMessage('error', `La historia no se publicó: ${err.message}`);
    } finally {
      setBusy('');
    }
  };

  const listo = tipo === 'texto' ? titulo.trim().length > 0 : Boolean(mediaUrl);

  return (
    <div className="space-y-4">
      <div className="p-3 bg-pink-50 dark:bg-pink-500/10 border border-pink-200 dark:border-pink-500/30 rounded-xl text-xs sm:text-sm text-pink-700 dark:text-pink-300">
        Se publica solo en <strong>Instagram</strong> (@marianoaliandri), directo y sin Make. Visible 24 h.
        No admite stickers, links ni música: lo que quieras decir va en la imagen.
      </div>

      <div className="flex flex-wrap gap-2">
        {TIPOS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTipo(t.id); reset(); }}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              tipo === t.id
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{TIPOS.find(t => t.id === tipo).hint}</p>

      {tipo === 'texto' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
              Texto de la historia
            </label>
            <textarea
              value={titulo}
              onChange={e => { setTitulo(e.target.value.slice(0, MAX_TITULO)); setPreviewUrl(''); }}
              rows={3}
              placeholder="Ej: ¿Tu web aparece en Google? Respondé esta historia y te mando un informe gratis"
              className="w-full p-3 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{titulo.length}/{MAX_TITULO}</div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
              Etiqueta (opcional)
            </label>
            <input
              value={etiqueta}
              onChange={e => { setEtiqueta(e.target.value.slice(0, 34)); setPreviewUrl(''); }}
              placeholder="Mariano Aliandri"
              className="w-full p-2.5 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
        </div>
      ) : (
        <input
          key={tipo}
          type="file"
          accept={tipo === 'video' ? 'video/mp4,video/quicktime,video/webm' : 'image/*'}
          disabled={Boolean(busy)}
          onChange={handleFile}
          className="w-full text-xs sm:text-sm text-gray-500 dark:text-gray-400 file:mr-2 sm:file:mr-4 file:py-2 file:px-3 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-500/10 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-500/20 disabled:opacity-50"
        />
      )}

      {previewUrl && (
        <div className="flex justify-center">
          {tipo === 'video' ? (
            <video src={previewUrl} controls className="h-96 aspect-[9/16] rounded-xl bg-black" />
          ) : (
            <img src={previewUrl} alt="Vista previa de la historia" className="h-96 aspect-[9/16] object-cover rounded-xl shadow" />
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handlePreview}
          disabled={Boolean(busy) || !listo}
          className="flex-1 py-3 text-sm sm:text-base bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Vista previa
        </button>
        <button
          onClick={handlePublish}
          disabled={Boolean(busy) || !previewUrl}
          className="flex-1 py-3 text-sm sm:text-base bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Publicar historia
        </button>
      </div>
      {busy && <p className="text-xs text-gray-500 dark:text-gray-400 text-center">{busy}</p>}
    </div>
  );
}
