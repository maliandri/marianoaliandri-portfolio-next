// Regla de lead compartida por el servidor (decide el cobro en /api/lead-finder-pro/run) y por
// el motor de búsqueda (src/lib/leadSearch.js). Ver
// docs/superpowers/specs/2026-10-12-lead-finder-unificado-design.md
//
// tiene web propia → lead por web · sin web → lead solo si tiene WhatsApp · si no → descartado.
// Google Places no devuelve emails (salen de leer el sitio), así que sin web el único canal es
// el teléfono. No hay forma gratis de saber si un número tiene WhatsApp: se deduce del formato.

const digitos = (s) => String(s || '').replace(/\D/g, '');

// Formato internacional de Google: "+54 9 299 541-4422". En Argentina el 9 marca celular; en
// otros países el formato no distingue celular de fijo, así que cualquier número sirve.
function whatsappDesdeInternacional(intl) {
  const d = digitos(intl);
  if (d.length < 8) return null;
  if (d.startsWith('54')) return d.startsWith('549') ? d : null;
  return d;
}

// Entradas viejas del caché (sin internacional): formato nacional argentino "0299 15-541-4422".
function whatsappDesdeNacionalAR(nacional) {
  const m = String(nacional || '').trim().match(/^0(\d{2,4})[\s-]*15[\s-]*([\d\s-]{6,})$/);
  return m ? `549${m[1]}${digitos(m[2])}` : null;
}

function whatsappDe(audit) {
  if (audit?.internationalPhone) return whatsappDesdeInternacional(audit.internationalPhone);
  return whatsappDesdeNacionalAR(audit?.phone);
}

export function clasificarLead(audit) {
  const whatsapp = whatsappDe(audit);
  if (audit?.hasWebsite && audit?.siteUrl) return { esLead: true, canal: 'web', whatsapp };
  if (whatsapp) return { esLead: true, canal: 'whatsapp', whatsapp };
  return { esLead: false, canal: null, whatsapp: null };
}
