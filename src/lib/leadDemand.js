import { RUBROS, rubroLabel } from '@/data/rubros';

// Cruce de los leads con "Rubros buscados". Lo usan LeadFinder.jsx y el servidor MCP.

// Demanda del rubro de un lead: { [ciudad]: respuesta de rubroDemand }. Los rubros de Maps se
// buscan por id (la etiqueta cambia con el idioma); los términos libres, por el texto.
export function demandaDe(lead, demanda, labelToId) {
  if (lead.demanda) return lead.demanda; // ya guardada en el historial
  const d = demanda[lead.ciudad];
  if (!d) return null;
  const id = labelToId[lead.tipo];
  return (id ? d.porRubro?.[id] : d.porTermino?.[lead.tipo]) || null;
}

export function labelToIdFor(ids, lang) {
  return Object.fromEntries(tipoParams(ids, lang).map(p => [p.label, p.id]));
}

export function tipoParams(ids, lang) {
  return ids.map(id => {
    const r = RUBROS.find(x => x.id === id);
    return { id, label: rubroLabel(r, lang) || id, ...(r?.query ? { query: r.query } : {}) };
  });
}
