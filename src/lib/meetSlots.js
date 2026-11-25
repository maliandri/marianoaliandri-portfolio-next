// Turnos para el Meet de la venta por consulta (2026-11-25). Módulo puro: recibe la config de horarios, lo
// ocupado del Google Calendar de Mariano y "ahora", y devuelve los inicios libres en ISO (UTC).
// Argentina es UTC−3 todo el año (sin horario de verano): se calcula con ese corrimiento fijo, sin depender de la
// zona horaria del servidor (Vercel corre en UTC).

export const MEET_DEFAULT = { dias: [1, 2, 3, 4, 5], desde: '09:00', hasta: '12:00', minutos: 30, minAnticipacionH: 24, maxDias: 14 };
const ART_MS = -3 * 3600000;
const DIA = 86400000;

const aMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };

export function normalizarConfig(c = {}) {
  const cfg = { ...MEET_DEFAULT, ...c };
  cfg.dias = (Array.isArray(cfg.dias) ? cfg.dias : MEET_DEFAULT.dias).map(Number).filter(d => d >= 0 && d <= 6);
  cfg.minutos = Math.min(120, Math.max(15, Number(cfg.minutos) || 30));
  cfg.minAnticipacionH = Math.min(168, Math.max(1, Number(cfg.minAnticipacionH) || 24));
  cfg.maxDias = Math.min(60, Math.max(1, Number(cfg.maxDias) || 14));
  return cfg;
}

const pisa = (ini, fin, ocupados) => ocupados.some(o => ini < Date.parse(o.fin) && fin > Date.parse(o.inicio));

export function turnosLibres({ config, ocupados = [], now = Date.now() }) {
  const cfg = normalizarConfig(config);
  const desde = aMin(cfg.desde);
  const hasta = aMin(cfg.hasta);
  const dur = cfg.minutos * 60000;
  const minIni = now + cfg.minAnticipacionH * 3600000;
  const maxIni = now + cfg.maxDias * DIA;
  // Medianoche argentina de hoy, expresada en ms UTC.
  // (hora argentina = UTC + ART_MS; la medianoche local en UTC = medianoche "local" − ART_MS)
  const hoyArt = Math.floor((now + ART_MS) / DIA) * DIA - ART_MS;
  const out = [];
  for (let d = 0; d <= cfg.maxDias; d++) {
    const dia0 = hoyArt + d * DIA;
    const diaSemana = new Date(dia0 + ART_MS).getUTCDay();
    if (!cfg.dias.includes(diaSemana)) continue;
    for (let m = desde; m + cfg.minutos <= hasta; m += cfg.minutos) {
      const ini = dia0 + m * 60000;
      if (ini < minIni || ini > maxIni) continue;
      if (pisa(ini, ini + dur, ocupados)) continue;
      out.push(new Date(ini).toISOString());
    }
  }
  return out;
}

export function turnoValido(inicioISO, { config, ocupados = [], now = Date.now() }) {
  const ms = Date.parse(inicioISO);
  if (!Number.isFinite(ms)) return false;
  return turnosLibres({ config, ocupados, now }).includes(new Date(ms).toISOString());
}
