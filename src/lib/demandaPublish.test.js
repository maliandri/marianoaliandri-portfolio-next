import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { prepararPlacas, imagesToPdf } from './demandaPublish';
import { seccionesDe, demandaShotUrl } from './demandaReport';

// PNG de 1x1 válido.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const reporte = (n, localidades = ['Neuquén', 'Plottier']) => ({
  zona: 'Alto Valle', localidades, createdAtMs: 0,
  top: Array.from({ length: n }, (_, i) => ({ id: `r${i}`, pos: i + 1, ejemplos: i ? [] : ['x'] })),
});

describe('capturas del informe de demanda', () => {
  it('qué partes salen según el informe', () => {
    expect(seccionesDe(reporte(20))).toEqual(['portada', 'ranking2', 'localidades', 'frases', 'cierre']);
    expect(seccionesDe(reporte(8, ['Rosario']))).toEqual(['portada', 'frases', 'cierre']);
  });

  it('URL de Microlink: la parte pedida, 1080x1350 y espera a que el sitio la arme', () => {
    const u = decodeURIComponent(demandaShotUrl('abc', 'frases'));
    expect(u).toContain('/demanda/abc/?screenshot=1&seccion=frases');
    expect(u).toContain('viewport.width=1080&viewport.height=1350');
    expect(u).toContain('waitForSelector=body[data-shot-ready]');
  });

  it('baja cada captura, la sube a Cloudinary y falla si Microlink no devuelve una imagen', async () => {
    const pedidas = [];
    const fetchImpl = async (url) => {
      pedidas.push(decodeURIComponent(url).match(/seccion=(\w+)/)[1]);
      return { ok: true, headers: new Map([['content-type', 'image/png']]), arrayBuffer: async () => PNG };
    };
    const subidas = [];
    const r = await prepararPlacas(reporte(20), 'abc', { fetchImpl, upload: async (b, t, folder) => { subidas.push(folder); return `https://res.cloudinary.com/x/${subidas.length}.png`; } });
    expect(pedidas).toEqual(['portada', 'ranking2', 'localidades', 'frases', 'cierre']);
    expect(r.urls).toHaveLength(5);
    expect(subidas[0]).toBe('demanda/abc');

    const mal = async () => ({ ok: true, headers: new Map([['content-type', 'text/html']]), arrayBuffer: async () => Buffer.from('') });
    await expect(prepararPlacas(reporte(3), 'abc', { fetchImpl: mal, upload: async () => '' })).rejects.toThrow(/text\/html/);
  });

  it('PDF: una página por imagen, del tamaño de la imagen', async () => {
    const pdf = await PDFDocument.load(await imagesToPdf([{ bytes: PNG, type: 'image/png' }, { bytes: PNG, type: 'image/png' }], { title: 't' }));
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 1, height: 1 });
  });
});
