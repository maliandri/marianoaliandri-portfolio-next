// Semilla de la auditoría automática. La primera corrida la copia a Firestore
// (auditoria_auto/config) y desde ahí se edita desde el admin.
// Ciudades: masa crítica de comercios (no se usa localidadesAR.js: trae localidades diminutas).
export const CIUDADES_SEMILLA = [
  'Neuquén', 'Cipolletti', 'Plottier', 'General Roca', 'Bariloche', 'Viedma',
  'Trelew', 'Puerto Madryn', 'Comodoro Rivadavia', 'Río Gallegos', 'Ushuaia',
  'Santa Rosa', 'Bahía Blanca', 'Mar del Plata', 'La Plata', 'Tandil', 'Olavarría',
  'Buenos Aires', 'Rosario', 'Santa Fe', 'Rafaela', 'Paraná', 'Córdoba', 'Río Cuarto',
  'Mendoza', 'San Rafael', 'San Juan', 'San Luis', 'Villa Mercedes',
  'San Miguel de Tucumán', 'Salta', 'San Salvador de Jujuy', 'Santiago del Estero',
  'San Fernando del Valle de Catamarca', 'La Rioja', 'Resistencia', 'Corrientes',
  'Posadas', 'Formosa', 'Concordia', 'Villa Carlos Paz',
];

// Cada rubro es un GRUPO de búsquedas que sale en un solo informe ("… de Aberturas en Alto Valle"):
// terminos → searchText libre, tipos → tipos de Places (searchNearby). Los grupos responden a los
// servicios que se venden.
// prioritario: negocios con etapas constructivas o de fabricación que consumen insumos
// (el tipo de sistema desarrollado en Almamod: requisiciones, stock, seguimiento, cómputo).
export const RUBROS_SEMILLA = [
  // Prioritarios (general_contractor no existe en Places API New: las constructoras van por texto)
  { label: 'Constructoras', prioritario: true, tipos: [],
    terminos: ['constructora', 'constructor', 'empresa constructora', 'maestro mayor de obras'] },
  { label: 'Estudios de arquitectura', prioritario: true, tipos: [],
    terminos: ['estudio de arquitectura', 'arquitecto'] },
  { label: 'Construcción en seco', prioritario: true, tipos: [],
    terminos: ['construcción en seco', 'durlock', 'steel framing'] },
  { label: 'Viviendas industrializadas', prioritario: true, tipos: [],
    terminos: ['casas prefabricadas', 'casas modulares', 'contenedores habitables'] },
  { label: 'Aberturas', prioritario: true, tipos: [],
    terminos: ['aberturas de aluminio', 'aberturas de PVC', 'fábrica de aberturas', 'carpintería de aluminio'] },
  { label: 'Metalúrgicas y herrerías', prioritario: true, tipos: [],
    terminos: ['metalúrgica', 'herrería', 'carpintería metálica'] },
  { label: 'Muebles a medida y carpinterías', prioritario: true, tipos: [],
    terminos: ['fábrica de muebles a medida', 'carpintería', 'amoblamientos'] },
  { label: 'Corralones y ferreterías', prioritario: true, tipos: ['hardware_store'],
    terminos: ['corralón', 'materiales de construcción'] },
  { label: 'Premoldeados y vidrierías', prioritario: true, tipos: [],
    terminos: ['fábrica de premoldeados', 'vidriería'] },
  { label: 'Electricistas, plomeros y pintores', prioritario: true,
    tipos: ['electrician', 'plumber', 'painter'], terminos: [] },
  { label: 'Confección textil', prioritario: true, tipos: [],
    terminos: ['confección textil', 'taller textil'] },
  // Secundarios — variedad de contenido
  { label: 'Gastronomía', prioritario: false, tipos: ['restaurant', 'bakery'], terminos: [] },
  { label: 'Comercios de ropa', prioritario: false, tipos: ['clothing_store'], terminos: [] },
  { label: 'Talleres mecánicos', prioritario: false, tipos: ['car_repair'], terminos: [] },
  { label: 'Inmobiliarias', prioritario: false, tipos: ['real_estate_agency'], terminos: [] },
  { label: 'Estudios contables', prioritario: false, tipos: ['accounting'], terminos: [] },
];
