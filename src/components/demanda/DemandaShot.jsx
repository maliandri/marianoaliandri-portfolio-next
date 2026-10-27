'use client';

import { useEffect } from 'react';

// Modo captura por partes de un informe de demanda: /demanda/<id>/?screenshot=1&seccion=portada
// muestra solo esa parte en 1080x1350 (las capturas de Microlink son el carrusel y el PDF de cada
// post, ver src/lib/demandaPublish.js). Se resuelve en el cliente para no volver dinámica la página
// (ISR). Al terminar marca body[data-shot-ready], que es lo que espera Microlink (waitForSelector).
const CSS = `
html[data-shot] [data-sec]{display:none!important}
html[data-shot] [data-shot-only]{display:block!important}
html[data-shot] main{padding:64px 72px!important;min-height:1350px;display:flex;flex-direction:column;justify-content:center}
html[data-shot] main>div{width:100%;max-width:none!important}
html[data-shot="portada"] [data-sec~="portada"],
html[data-shot="ranking2"] [data-sec~="ranking2"],
html[data-shot="localidades"] [data-sec~="localidades"],
html[data-shot="frases"] [data-sec~="frases"],
html[data-shot="cierre"] [data-sec~="cierre"]{display:block!important}
html[data-shot="portada"] [data-grupo="b"],
html[data-shot="ranking2"] [data-grupo="a"]{display:none!important}
html[data-shot] [data-grupo]{margin-top:14px}
`;

export default function DemandaShot() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const seccion = p.get('seccion');
    if (p.get('screenshot') !== '1' || !seccion) return;
    document.documentElement.dataset.shot = seccion;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    // Dos frames: que el navegador aplique los estilos antes de avisar que está lista.
    requestAnimationFrame(() => requestAnimationFrame(() => { document.body.dataset.shotReady = '1'; }));
  }, []);
  return null;
}
