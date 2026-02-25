'use client';

// src/components/LinkedInShareButton.jsx
import React, { useEffect, useRef, useState } from 'react';

export default function LinkedInShareButton({
  url = typeof window !== 'undefined' ? window.location.href : '',
  counter = 'right',        // 'right' | 'top' | ''
  className = '',
  fallback = false,         // ⬅️ por defecto NO mostramos el botón extra
  forceLink = false,        // ⬅️ si true, NO usa plugin, solo el botón grande
}) {
  const containerRef = useRef(null);
  const [hasSDK, setHasSDK] = useState(false);

  useEffect(() => {
    // ¿Está el SDK de LinkedIn disponible?
    const sdkReady =
      typeof window !== 'undefined' &&
      window.IN &&
      typeof window.IN.parse === 'function';

    setHasSDK(!!sdkReady);

    // Si se forzó el link, no intentamos renderizar el plugin
    if (forceLink) return;

    // Render del plugin solo si hay SDK
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    if (sdkReady) {
      const s = document.createElement('script');
      s.type = 'IN/Share';
      if (url) s.setAttribute('data-url', url);
      if (counter) s.setAttribute('data-counter', counter);
      containerRef.current.appendChild(s);
      window.IN.parse(containerRef.current);
    }
  }, [url, counter, forceLink]);

  const shareHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    url
  )}`;

  // Si pediste "solo link", devolvemos solo el botón grande
  if (forceLink) {
    return (
      <a
        href={shareHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A66C2] text-white font-semibold hover:opacity-90`}
        aria-label="Compartir en LinkedIn"
      >
        Compartir en LinkedIn
      </a>
    );
  }

  // Caso normal: plugin oficial; fallback solo si NO hay SDK y lo pediste
  return (
    <div className={className}>
      <div ref={containerRef} />
      {fallback && !hasSDK && (
        <a
          href={shareHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A66C2] text-white font-semibold hover:opacity-90 mt-2"
          aria-label="Compartir en LinkedIn"
        >
          Compartir en LinkedIn
        </a>
      )}
    </div>
  );
}
