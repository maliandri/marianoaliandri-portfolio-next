// Zonas iniciales de los informes de demanda (/demanda). Se editan desde el admin
// (Marketing → Informes de demanda); esto es solo el punto de partida.
// Una zona puede ser una ciudad o un grupo de localidades que salen en un mismo informe.
export const ZONAS_SEMILLA = [
  {
    id: 'alto-valle',
    nombre: 'Alto Valle',
    localidades: [
      { provincia: 'Neuquén', localidad: 'Neuquén' },
      { provincia: 'Neuquén', localidad: 'Plottier' },
      { provincia: 'Neuquén', localidad: 'Centenario' },
      { provincia: 'Río Negro', localidad: 'Cipolletti' },
      { provincia: 'Río Negro', localidad: 'Cinco Saltos' },
      { provincia: 'Río Negro', localidad: 'Allen' },
      { provincia: 'Río Negro', localidad: 'General Roca' },
    ],
  },
  { id: 'cordoba', nombre: 'Córdoba', localidades: [{ provincia: 'Córdoba', localidad: 'Córdoba' }] },
  { id: 'rosario', nombre: 'Rosario', localidades: [{ provincia: 'Santa Fe', localidad: 'Rosario' }] },
  { id: 'caba', nombre: 'CABA', localidades: [{ provincia: 'Ciudad de Buenos Aires', localidad: 'Ciudad Autónoma de Buenos Aires' }] },
];
