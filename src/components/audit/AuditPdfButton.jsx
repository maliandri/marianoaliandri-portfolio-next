'use client';

import { useState } from 'react';
import { buildAuditReportHtml } from '@/lib/auditReportHtml';

// Botón "Exportar PDF" para la página de detalle de una auditoría.
// Captura el mapa (Leaflet) con html2canvas y arma un reporte imprimible
// con la selección, localidades, texto automático, el mapa y la tabla de sitios.
export default function AuditPdfButton({ audit }) {
  const [busy, setBusy] = useState(false);

  async function exportPdf() {
    setBusy(true);
    try {
      // 1) Capturar el mapa como imagen (si existe en la página)
      let mapImage = null;
      const mapEl = document.querySelector('.leaflet-container');
      if (mapEl) {
        try {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(mapEl, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#0a0a0a',
            scale: 2,
            logging: false,
          });
          mapImage = canvas.toDataURL('image/png');
        } catch {
          mapImage = null; // si falla la captura, el reporte sale sin mapa
        }
      }

      // 2) Armar el HTML y abrir la ventana de impresión
      const html = buildAuditReportHtml({ ...audit, mapImage });
      const win = window.open('', '_blank');
      if (!win) {
        alert('El navegador bloqueó la ventana. Permití pop-ups para exportar el PDF.');
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={exportPdf}
      disabled={busy}
      className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white transition-colors"
    >
      {busy ? 'Generando PDF…' : '↓ Exportar PDF'}
    </button>
  );
}
