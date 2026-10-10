const KINDS = [
  ['details',      'getPlaceRequests'],
  ['searchText',   'searchTextRequests'],
  ['searchNearby', 'searchNearbyRequests'],
];

const round2 = n => Math.round(n * 100) / 100;

function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// rows: docs de leadfinder_usage ({ id: 'YYYY-MM-DD', getPlaceRequests, ... }).
// "comercios" = getPlace: un detalle por comercio auditado.
export function buildUsageReport(rows, { month, today, limits }) {
  const days = (rows || [])
    .filter(r => r.id?.startsWith(`${month}-`))
    .sort((a, b) => a.id.localeCompare(b.id));

  const totals = { details: 0, searchText: 0, searchNearby: 0 };
  const freeDetails = limits.details.free;

  const tableDays = days.map(r => {
    const comercios = r.getPlaceRequests || 0;
    const busquedas = (r.searchTextRequests || 0) + (r.searchNearbyRequests || 0);
    for (const [kind, field] of KINDS) totals[kind] += r[field] || 0;
    return {
      date: r.id,
      comercios,
      busquedas,
      acumulado: totals.details,
      restantes: Math.max(0, freeDetails - totals.details),
    };
  });

  const total = daysInMonth(month);
  const currentMonth = today.slice(0, 7);
  let factor = 1;
  if (month === currentMonth) {
    const elapsed = Number(today.slice(8, 10));
    factor = total / elapsed;
  }

  const proyeccion = {};
  const excedente = {};
  let costo = 0;
  for (const [kind] of KINDS) {
    proyeccion[kind] = month > currentMonth ? 0 : Math.round(totals[kind] * factor);
    excedente[kind] = Math.max(0, totals[kind] - limits[kind].free);
    const excedenteProyectado = Math.max(0, proyeccion[kind] - limits[kind].free);
    costo += (excedenteProyectado / 1000) * limits[kind].usdPer1000;
  }

  return {
    days: tableDays,
    totals,
    restantes: Math.max(0, freeDetails - totals.details),
    proyeccion,
    excedente,
    costoEstimadoUSD: round2(costo),
  };
}
