'use client';
import GSCWidget from './widgets/GSCWidget';
import GA4Widget from './widgets/GA4Widget';
import NoticiasBotWidget from './widgets/NoticiasBotWidget';
import LeadsWidget from './widgets/LeadsWidget';
import AuditoriasWidget from './widgets/AuditoriasWidget';
import PresupuestosWidget from './widgets/PresupuestosWidget';
import ReelsWidget from './widgets/ReelsWidget';
import VisitasWidget from './widgets/VisitasWidget';

const ACCENT = {
  emerald: '#10b981',
  indigo:  '#6366f1',
  amber:   '#f59e0b',
  sky:     '#0ea5e9',
  orange:  '#f97316',
  rose:    '#f43f5e',
};

function KpiCard({ label, value, sub, accentColor }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex flex-col gap-0.5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: accentColor }} />
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
      <span className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</span>
      {sub && <span className="text-[11px] text-gray-400 leading-tight">{sub}</span>}
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex flex-col ${className}`}>
      {children}
    </div>
  );
}

export default function DashboardGrid({ data }) {
  const gsc          = data?.gsc;
  const ga4          = data?.ga4;
  const noticias     = data?.noticias;
  const reels        = data?.reels;
  const auditorias   = data?.auditorias;
  const presupuestos = data?.presupuestos;

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="GSC Clicks"
          value={gsc?.clicks != null ? gsc.clicks.toLocaleString('es-AR') : '—'}
          sub="últimos 28 días"
          accentColor={ACCENT.emerald}
        />
        <KpiCard
          label="Impresiones"
          value={gsc?.impresiones != null ? gsc.impresiones.toLocaleString('es-AR') : '—'}
          sub={gsc?.posicion ? `pos. promedio ${gsc.posicion}` : 'Search Console'}
          accentColor={ACCENT.indigo}
        />
        <KpiCard
          label="Sesiones GA4"
          value={ga4?.sesiones != null ? ga4.sesiones.toLocaleString('es-AR') : '—'}
          sub="últimos 28 días"
          accentColor={ACCENT.amber}
        />
        <KpiCard
          label="Noticias (30d)"
          value={noticias?.ultimos30 ?? '—'}
          sub={`${noticias?.total ?? 0} publicadas total`}
          accentColor={ACCENT.sky}
        />
        <KpiCard
          label="Auditorías"
          value={auditorias?.total ?? '—'}
          sub={`${auditorias?.emailsEnviados ?? 0} emails enviados`}
          accentColor={ACCENT.orange}
        />
        <KpiCard
          label="Presupuestos"
          value={presupuestos?.pendientes ?? '—'}
          sub={`de ${presupuestos?.total ?? 0} totales`}
          accentColor={ACCENT.rose}
        />
      </div>

      {/* GSC — full width */}
      <Card style={{ height: 260 }}>
        <GSCWidget data={gsc} />
      </Card>

      {/* GA4 + Noticias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card style={{ height: 240 }}>
          <GA4Widget data={ga4} />
        </Card>
        <Card style={{ height: 240 }}>
          <NoticiasBotWidget data={noticias} />
        </Card>
      </div>

      {/* Leads + Auditorías/Presupuestos/Reels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" style={{ height: 280 }}>
          <LeadsWidget data={auditorias} />
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="flex-1">
            <AuditoriasWidget data={auditorias} />
          </Card>
          <Card className="flex-1">
            <PresupuestosWidget data={presupuestos} />
          </Card>
        </div>
      </div>

      {/* Reels + Visitas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <ReelsWidget data={reels} />
        </Card>
        <Card>
          <VisitasWidget />
        </Card>
      </div>
    </div>
  );
}
