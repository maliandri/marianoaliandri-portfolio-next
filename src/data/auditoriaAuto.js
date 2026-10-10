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

// kind 'type' → includedTypes de Places (searchNearby). kind 'text' → searchText libre.
// prioritario: negocios con etapas constructivas o de fabricación que consumen insumos
// (el tipo de sistema desarrollado en Almamod: requisiciones, stock, seguimiento, cómputo).
export const RUBROS_SEMILLA = [
  // Prioritarios — tipos de Places
  { label: 'Electricista', kind: 'type', value: 'electrician',        prioritario: true },
  { label: 'Plomero',      kind: 'type', value: 'plumber',            prioritario: true },
  { label: 'Pintor',       kind: 'type', value: 'painter',            prioritario: true },
  { label: 'Ferretería',   kind: 'type', value: 'hardware_store',     prioritario: true },
  // Prioritarios — texto libre (general_contractor no existe en Places API New)
  { label: 'Constructor',                kind: 'text', value: 'constructor',                prioritario: true },
  { label: 'Construcción en seco',       kind: 'text', value: 'construcción en seco',       prioritario: true },
  { label: 'Steel framing',              kind: 'text', value: 'steel framing',              prioritario: true },
  { label: 'Durlock',                    kind: 'text', value: 'durlock',                    prioritario: true },
  { label: 'Casas modulares',            kind: 'text', value: 'casas modulares',            prioritario: true },
  { label: 'Casas prefabricadas',        kind: 'text', value: 'casas prefabricadas',        prioritario: true },
  { label: 'Contenedores habitables',    kind: 'text', value: 'contenedores habitables',    prioritario: true },
  { label: 'Constructora',               kind: 'text', value: 'constructora',               prioritario: true },
  { label: 'Estudio de arquitectura',    kind: 'text', value: 'estudio de arquitectura',    prioritario: true },
  { label: 'Maestro mayor de obras',     kind: 'text', value: 'maestro mayor de obras',     prioritario: true },
  { label: 'Metalúrgica',                kind: 'text', value: 'metalúrgica',                prioritario: true },
  { label: 'Herrería',                   kind: 'text', value: 'herrería',                   prioritario: true },
  { label: 'Carpintería metálica',       kind: 'text', value: 'carpintería metálica',       prioritario: true },
  { label: 'Carpintería de aluminio',    kind: 'text', value: 'carpintería de aluminio',    prioritario: true },
  { label: 'Aberturas de aluminio',      kind: 'text', value: 'aberturas de aluminio',      prioritario: true },
  { label: 'Aberturas de PVC',           kind: 'text', value: 'aberturas de PVC',           prioritario: true },
  { label: 'Fábrica de aberturas',       kind: 'text', value: 'fábrica de aberturas',       prioritario: true },
  { label: 'Carpintería',                kind: 'text', value: 'carpintería',                prioritario: true },
  { label: 'Fábrica de muebles a medida', kind: 'text', value: 'fábrica de muebles a medida', prioritario: true },
  { label: 'Fábrica de premoldeados',    kind: 'text', value: 'fábrica de premoldeados',    prioritario: true },
  { label: 'Corralón',                   kind: 'text', value: 'corralón',                   prioritario: true },
  { label: 'Vidriería',                  kind: 'text', value: 'vidriería',                  prioritario: true },
  { label: 'Confección textil',          kind: 'text', value: 'confección textil',          prioritario: true },
  // Secundarios — variedad de contenido
  { label: 'Restaurante',  kind: 'type', value: 'restaurant',         prioritario: false },
  { label: 'Panadería',    kind: 'type', value: 'bakery',             prioritario: false },
  { label: 'Ropa',         kind: 'type', value: 'clothing_store',     prioritario: false },
  { label: 'Mecánico',     kind: 'type', value: 'car_repair',         prioritario: false },
  { label: 'Inmobiliaria', kind: 'type', value: 'real_estate_agency', prioritario: false },
  { label: 'Contabilidad', kind: 'type', value: 'accounting',         prioritario: false },
];
