import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { slideTrees, topPorLocalidad, renderDemandaSlides, slidesToPdf } from './demandaSlides';

const rubro = (i, extra = {}) => ({
  id: `r${i}`, label: `Rubro ${i}`, pos: i, interes: 100 - i, ejemplos: [`rubro ${i} neuquen`], cambio: null, nuevo: false,
  porLocalidad: [{ localidad: 'Neuquén', interes: 100 - i }, { localidad: 'Plottier', interes: i === 5 ? 100 : 50 }], ...extra,
});
const reporte = (n, extra = {}) => ({
  zona: 'Alto Valle', localidades: ['Neuquén', 'Plottier'], createdAtMs: Date.UTC(2026, 9, 28, 21),
  top: Array.from({ length: n }, (_, i) => rubro(i + 1)), ...extra,
});

describe('placas de demanda', () => {
  it('zona agrupada con 20 rubros: portada, podio, 4–10, 11–20, por localidad y cierre', () => {
    expect(slideTrees(reporte(20))).toHaveLength(6);
  });

  it('suma "los que más subieron" solo si hay subidas, y saca lo que no aplica a una ciudad sola', () => {
    const conSubidas = reporte(20);
    conSubidas.top[4].cambio = 3;
    expect(slideTrees(conSubidas)).toHaveLength(7);
    expect(slideTrees(reporte(8, { localidades: ['Rosario'] }))).toHaveLength(4);
  });

  it('rubro más buscado de cada localidad', () => {
    expect(topPorLocalidad(reporte(20))).toEqual([
      { localidad: 'Neuquén', rubro: 'Rubro 1' },
      { localidad: 'Plottier', rubro: 'Rubro 5' },
    ]);
  });

  it('renderiza PNGs 1080x1350 y un PDF con una página por placa', async () => {
    const pngs = await renderDemandaSlides(reporte(20));
    expect(pngs).toHaveLength(6);
    expect(pngs[0].subarray(1, 4).toString()).toBe('PNG');
    const pdf = await PDFDocument.load(await slidesToPdf(pngs.slice(0, 2), { title: 'x' }));
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 1080, height: 1350 });
  }, 30000);
});
