// Cupo gratis mensual de Google Places API (New) por SKU, y precio del excedente.
// El Lead Finder pide websiteUri / teléfono / horarios / rating → todas las llamadas
// caen en la categoría Enterprise. Si Google cambia precios o cupos, se edita solo acá.
// Precios: estimados — verificar en https://developers.google.com/maps/billing-and-pricing/pricing
export const PLACES_LIMITS = {
  details:      { label: 'Detalles (comercios auditados)', free: 1000, usdPer1000: 20 },
  searchText:   { label: 'Búsquedas por texto',            free: 1000, usdPer1000: 35 },
  searchNearby: { label: 'Búsquedas por cercanía',         free: 1000, usdPer1000: 35 },
};
