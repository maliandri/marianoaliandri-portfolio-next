'use client';

import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const track = async () => {}; // Fallback

const SECTORES = [
  { id: "retail", label: "Retail / Comercio" }, { id: "ecommerce", label: "E-commerce" },
  { id: "manufactura", label: "Manufactura" }, { id: "salud", label: "Salud" },
  { id: "educacion", label: "Educación" }, { id: "servicios", label: "Servicios Profesionales" },
  { id: "logistica", label: "Logística" }, { id: "finanzas", label: "Finanzas" },
];
// ... (KPI_BY_SECTOR data no cambia)
const KPI_BY_SECTOR = {
  retail: [
    { key: "ventas_m2", name: "Ventas por m²", importance: 95, unit: "USD/m²", formula: "Ventas / Superficie de sala de ventas", reason: "Mide productividad del espacio físico.", example: "USD 1.200/m²/mes" }, { key: "ticket_prom", name: "Ticket Promedio", importance: 88, unit: "USD", formula: "Ventas / Nº de tickets", reason: "Ayuda a estrategias de upselling y bundles.", example: "USD 18" }, { key: "conversion", name: "Tasa de Conversión", importance: 92, unit: "%", formula: "Tickets / Visitas x 100", reason: "Eficiencia del piso de ventas.", example: "2,8%" }, { key: "rotacion_stock", name: "Rotación de Stock", importance: 90, unit: "veces/año", formula: "Costo Ventas / Stock Promedio", reason: "Salud del inventario y capital inmovilizado.", example: "7,2" }, { key: "merma", name: "Merma / Shrinkage", importance: 72, unit: "%", formula: "Pérdidas / Ventas x 100", reason: "Control de pérdidas y fraudes.", example: "0,9%" },
  ],
  ecommerce: [
    { key: "cr", name: "Tasa de Conversión", importance: 96, unit: "%", formula: "Pedidos / Sesiones x 100", reason: "Impacto directo en facturación.", example: "1,6%" }, { key: "cac", name: "CAC", importance: 88, unit: "USD", formula: "Gasto Mkt / Nuevos clientes", reason: "Eficiencia de adquisición.", example: "USD 9,4" }, { key: "ltv", name: "LTV", importance: 92, unit: "USD", formula: "Ingreso neto esperado por cliente", reason: "Sustentabilidad del growth.", example: "USD 85" }, { key: "aov", name: "AOV / Ticket Prom.", importance: 84, unit: "USD", formula: "Ingresos / Nº pedidos", reason: "Palancas de upsell y cross-sell.", example: "USD 22" }, { key: "ror", name: "Return Rate", importance: 70, unit: "%", formula: "Devoluciones / Pedidos x 100", reason: "Calidad, logística y UX postventa.", example: "4,1%" },
  ],
  manufactura: [
    { key: "oee", name: "OEE", importance: 96, unit: "%", formula: "Disponibilidad x Rendimiento x Calidad", reason: "Eficiencia global de equipos.", example: "78%" }, { key: "scrap", name: "Scrap Rate", importance: 86, unit: "%", formula: "Unidades defectuosas / Producidas x 100", reason: "Desperdicio y costos de calidad.", example: "1,8%" }, { key: "lead_time", name: "Lead Time", importance: 90, unit: "días", formula: "Desde orden a entrega", reason: "Flujo y cuellos de botella.", example: "6 días" }, { key: "utilizacion", name: "Utilización", importance: 82, unit: "%", formula: "Hora máquina usada / disponible x 100", reason: "Capacidad vs demanda.", example: "74%" }, { key: "ots", name: "On-Time Shipment", importance: 80, unit: "%", formula: "Órdenes a tiempo / totales x 100", reason: "Confiabilidad operativa.", example: "93%" },
  ],
  salud: [
    { key: "ocupacion", name: "Ocupación Camas", importance: 94, unit: "%", formula: "Camas ocupadas / disponibles x 100", reason: "Uso de capacidad crítica.", example: "78%" }, { key: "espera", name: "Tiempo de Espera", importance: 88, unit: "min", formula: "Promedio triage→atención", reason: "Experiencia y seguridad del paciente.", example: "27 min" }, { key: "readm", name: "Readmisión 30d", importance: 86, unit: "%", formula: "Readmisiones / Altas x 100", reason: "Calidad de atención.", example: "5,2%" }, { key: "nosocomial", name: "Infección intrahospitalaria", importance: 84, unit: "%", formula: "Casos / Internaciones x 100", reason: "Seguridad clínica.", example: "0,6%" }, { key: "satisf", name: "Satisfacción", importance: 78, unit: "/10", formula: "Encuestas pos-alta", reason: "Valor percibido.", example: "8,7/10" },
  ],
  educacion: [
    { key: "retencion", name: "Retención", importance: 92, unit: "%", formula: "Alumnos que continúan / total x 100", reason: "Éxito formativo y caja.", example: "88%" }, { key: "graduacion", name: "Tasa de Graduación", importance: 86, unit: "%", formula: "Egresados cohorte / total x 100", reason: "Resultado académico.", example: "62%" }, { key: "empleab", name: "Empleabilidad", importance: 84, unit: "%", formula: "Egresados empleados / egresados x 100", reason: "Relevancia del plan.", example: "71%" }, { key: "nps", name: "NPS", importance: 80, unit: "score", formula: "%Promotores − %Detractores", reason: "Recomendación y marca.", example: "+42" }, { key: "ocup_aula", name: "Ocupación Aula", importance: 78, unit: "%", formula: "Asistentes / capacidad x 100", reason: "Productividad de recursos.", example: "76%" },
  ],
  servicios: [
    { key: "uti_cap", name: "Utilización de Capacidad", importance: 90, unit: "%", formula: "Horas facturables / disponibles x 100", reason: "Eficiencia del equipo.", example: "81%" }, { key: "margin", name: "Margen por Proyecto", importance: 88, unit: "%", formula: "(Ingresos − Costos) / Ingresos x 100", reason: "Rentabilidad real.", example: "27%" }, { key: "arp", name: "ARPA", importance: 84, unit: "USD", formula: "Ingresos / Nº de cuentas", reason: "Crecimiento por cliente.", example: "USD 410" }, { key: "churn", name: "Churn", importance: 86, unit: "%", formula: "Bajas / Clientes x 100 (mensual)", reason: "Fuga y satisfacción.", example: "1,9%" }, { key: "nps", name: "NPS", importance: 78, unit: "score", formula: "%Promotores − %Detractores", reason: "Recomendación.", example: "+38" },
  ],
  logistica: [
    { key: "otp", name: "On-Time Delivery", importance: 94, unit: "%", formula: "Entregas a tiempo / totales x 100", reason: "Confiabilidad de servicio.", example: "95%" }, { key: "costo_env", name: "Costo por Envío", importance: 88, unit: "USD", formula: "Costos logísticos / envíos", reason: "Eficiencia de costos.", example: "USD 2,6" }, { key: "fill_rate", name: "Fill Rate", importance: 86, unit: "%", formula: "Órdenes completas / totales x 100", reason: "Disponibilidad y picking.", example: "97%" }, { key: "dañados", name: "% Dañados", importance: 76, unit: "%", formula: "Paquetes dañados / totales x 100", reason: "Calidad de manipuleo.", example: "0,7%" }, { key: "lead_time", name: "Lead Time", importance: 82, unit: "días", formula: "Pedido→entrega", reason: "Velocidad de cadena.", example: "2,9 días" },
  ],
  finanzas: [
    { key: "roe", name: "ROE", importance: 92, unit: "%", formula: "Utilidad neta / Patrimonio x 100", reason: "Rentabilidad del capital.", example: "17%" }, { key: "morosidad", name: "Mora 30+", importance: 88, unit: "%", formula: "Cartera vencida / cartera total x 100", reason: "Riesgo crediticio.", example: "3,1%" }, { key: "coef_efic", name: "Coeficiente de Eficiencia", importance: 86, unit: "%", formula: "Gastos operativos / Ingresos x 100", reason: "Eficiencia operativa.", example: "54%" }, { key: "npl_cov", name: "Cobertura NPL", importance: 82, unit: "%", formula: "Previsiones / NPL x 100", reason: "Solvencia ante incobrables.", example: "110%" }, { key: "rwa", name: "RWA/Activos", importance: 78, unit: "%", formula: "Activos ponderados por riesgo / activos", reason: "Apetito de riesgo.", example: "67%" },
  ],
};


// ✅ 1. PROPS: Se añaden las props para control externo
export default function KpiRadar({ isOpen: isOpenProp, onClose: onCloseProp, hideFloatingButton = false }) {
  // ✅ 2. ESTADO HÍBRIDO: Se renombra 'open' a 'isOpen' para consistencia y se implementa el patrón.
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen = isOpenProp !== undefined ? isOpenProp : isOpenInternal;
  
  const [sector, setSector] = useState("retail");
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const kpis = KPI_BY_SECTOR[sector] || [];

  useEffect(() => {
    // Solo se activa si NO está controlado por un padre
    if (isOpenProp !== undefined) return;

    const path = window.location.pathname || "";
    const q = new URLSearchParams(window.location.search);
    const hash = (window.location.hash || "").replace("#", "");
    if (hash === "kpi" || q.get("tool") === "kpi" || path.includes("/radar-kpi")) {
      setIsOpenInternal(true);
    }
  }, [isOpenProp]);

  // Se usa 'isOpen' en lugar de 'open'
  useEffect(() => { if (isOpen) track({ module: "kpi_radar", event: "open" }); }, [isOpen]);

  // ✅ 3. FUNCIONES ADAPTADAS: Se crean manejadores para abrir y cerrar.
  const handleClose = () => {
    if (onCloseProp) {
      onCloseProp();
    } else {
      setIsOpenInternal(false);
    }
    // Lógica para limpiar URL (si la hubiera) iría aquí
  };

  const openWithUrl = () => {
    if (isOpenProp !== undefined) return;
    setIsOpenInternal(true);
    const u = new URL(window.location.href);
    u.hash = "kpi"; u.searchParams.set("tool", "kpi");
    window.history.replaceState({}, "", u.toString());
  };

  // ... (El resto de la lógica como radarData, copyDetails, sendInterest, etc., no cambia)
  const radarData = useMemo(() => kpis.map(k => ({ subject: k.name, Importance: k.importance, fullMark: 100 })), [kpis]);
  const shareText = `Top 5 KPI para ${SECTORES.find(s => s.id === sector)?.label}: ` + kpis.map(k => k.name).join(", ");
  const copyDetails = async () => {
    const payload = { sector, kpis, exported_at: new Date().toISOString() };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      track({ module: "kpi_radar", event: "export_json", result: { sector } });
    } catch {}
  };
  const sendInterest = async () => {
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return alert("Ingresá un email válido");
    setSending(true);
    try {
      await fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: "kpi_radar", event: "lead_sent", result: { sector, email } }) });
      alert("¡Gracias! Te contacto con un tablero demo para tu sector.");
    } catch {}
    setSending(false);
  };

  return (
    <>
      {/* ✅ 4. OCULTAR BOTÓN FLOTANTE: Se renderiza condicionalmente */}
      {!hideFloatingButton && (
        <motion.button
          onClick={openWithUrl}
          className="fixed bottom-8 left-6 z-40 bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 1.4 }}
          aria-label="Abrir Radar de KPI"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11l4.33 2.5-5.33 3.08L6.67 15.5 12 12V4h1v9z"/></svg>
          <span className="font-semibold">Radar KPI</span>
        </motion.button>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black z-[1100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose} // Se usa la nueva función de cierre
          >
            <motion.div
              className="bg-white dark:bg-gray-900 rounded-2xl w-[min(100vw-24px,1120px)] max-h-[90vh] overflow-auto shadow-2xl"
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Radar de KPI Empresariales</h2>
                  <p className="text-white/80">Seleccioná el sector y mirá los 5 indicadores clave que mueven la aguja.</p>
                </div>
                <button onClick={handleClose} className="hover:text-white/80">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              
              {/* ... (Body y Footer del modal no cambian, solo se aseguran de usar la lógica correcta) ... */}
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sector</label>
                  <select
                    value={sector}
                    onChange={(e) => { setSector(e.target.value); track({ module: "kpi_radar", event: "sector_selected", result: { sector: e.target.value } }); }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-fuchsia-500"
                  >
                    {SECTORES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                  </select>
                  <div className="space-y-4">
                    {kpis.map((k) => (
                      <div key={k.key} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition bg-white/60 dark:bg-gray-800/60">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{k.name} <span className="text-xs text-gray-500">({k.unit})</span></h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{k.reason}</p>
                          </div>
                          <span className="text-fuchsia-700 dark:text-fuchsia-300 text-sm font-semibold">{k.importance}/100</span>
                        </div>
                        <div className="mt-3 text-sm">
                          <div className="text-gray-700 dark:text-gray-300"><b>Fórmula:</b> {k.formula}</div>
                          <div className="text-gray-700 dark:text-gray-300"><b>Ejemplo:</b> {k.example}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="h-[420px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%" margin={{ top: 16, right: 16, bottom: 16, left: 16 }}><PolarGrid /><PolarAngleAxis dataKey="subject" tick={{ fill: "currentColor", fontSize: 12 }} tickLine={false} tickFormatter={(v) => (v.length > 14 ? v.slice(0, 14) + "…" : v)} /><PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "currentColor", fontSize: 11 }} /><Tooltip formatter={(v) => `${v}/100`} /><Radar name="Importancia" dataKey="Importance" stroke="#a21caf" fill="#a21caf" fillOpacity={0.35} /></RadarChart></ResponsiveContainer>
                  <div className="pt-3 text-xs text-gray-500 dark:text-gray-400">*Importancia relativa sugerida. Personalizable por empresa en un workshop.</div>
                </section>
              </div>
              <div className="px-6 pb-6 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <div className="flex gap-3">
                  <button onClick={copyDetails} className="px-4 py-2 rounded-full border border-fuchsia-600 text-fuchsia-700 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20">{copied ? "¡Copiado!" : "Exportar JSON"}</button>
                  <button onClick={async () => { try { if (navigator.share) { await navigator.share({ title: "Radar KPI", text: shareText, url: window.location.href + "#kpi" }); } else { await copyDetails(); } track({ module: "kpi_radar", event: "share" }); } catch {} }} className="px-4 py-2 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Compartir</button>
                </div>
                <div className="flex gap-2 items-center">
                  <input type="email" placeholder="tu@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm w-64"/>
                  <button disabled={sending} onClick={sendInterest} className="px-5 py-2 rounded-xl bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-60">{sending ? "Enviando…" : "Quiero un demo en Power BI"}</button>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
