// Métricas de redes (admin): Instagram por la Graph API y LinkedIn con lo publicado desde el sitio.
// Datos de /api/redes-stats (solo admin). LinkedIn no da métricas hasta que apruebe la Community Management API.
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es-AR'));
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—');
const TIPOS = { reel: 'Reel', carousel_album: 'Carrusel', image: 'Imagen', video: 'Video' };
const ORIGEN = { pieza: 'Pieza', reel: 'Reel', demanda: 'Demanda' };
const ORDENES = [
  { id: 'fecha', label: 'Más nuevos' },
  { id: 'alcance', label: 'Alcance' },
  { id: 'vistas', label: 'Vistas' },
  { id: 'interacciones', label: 'Interacciones' },
];

function Tarjeta({ label, valor, nota }) {
  return (
    <div className="rounded-xl bg-fg/5 p-3">
      <div className="text-2xl font-bold text-fg">{fmt(valor)}</div>
      <div className="text-xs text-fg-500">{label}</div>
      {nota && <div className="text-[11px] text-fg-500 mt-0.5">{nota}</div>}
    </div>
  );
}

// Línea simple de seguidores por día. Con menos de 2 días de datos no hay evolución que mostrar.
function Evolucion({ serie }) {
  if (!serie || serie.length < 2) {
    return <p className="text-xs text-fg-500">La evolución se arma sola: se guarda una foto de seguidores por día cada vez que se abre esta pantalla.</p>;
  }
  const w = 600, h = 80, pad = 6;
  const vals = serie.map(s => s.seguidores);
  const min = Math.min(...vals), max = Math.max(...vals);
  const rango = max - min || 1;
  const pts = serie.map((s, i) => {
    const x = pad + (i / (serie.length - 1)) * (w - pad * 2);
    const y = h - pad - ((s.seguidores - min) / rango) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" role="img" aria-label="Evolución de seguidores">
        <polyline points={pts} fill="none" stroke="#db2777" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[11px] text-fg-500">
        <span>{serie[0].fecha} · {fmt(serie[0].seguidores)}</span>
        <span>{serie[serie.length - 1].fecha} · {fmt(serie[serie.length - 1].seguidores)}</span>
      </div>
    </div>
  );
}

export default function RedesStats() {
  const { user, getIdToken } = useAuthUser();
  const [days, setDays] = useState(28);
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [orden, setOrden] = useState('fecha');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const idToken = await getIdToken();
      const resp = await fetch(`/api/redes-stats?days=${days}`, { headers: idToken ? { Authorization: `Bearer ${idToken}` } : {} });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
      setData(json);
    } catch (e) {
      setError(e.message || 'No se pudieron cargar las métricas.');
    } finally {
      setCargando(false);
    }
  }, [getIdToken, days]);

  useEffect(() => { if (user) cargar(); }, [user, cargar]);

  const ig = data?.instagram;
  const li = data?.linkedin;
  const c = ig?.insights?.cuenta;

  const posts = useMemo(() => {
    const lista = [...(ig?.posts || [])];
    if (orden === 'fecha') return lista.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    return lista.sort((a, b) => (b[orden] ?? -1) - (a[orden] ?? -1));
  }, [ig, orden]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-fg mr-auto">Métricas de redes</h2>
        {[7, 28].map(d => (
          <button key={d} type="button" onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${days === d ? 'bg-pink-600 text-white' : 'bg-fg/5 text-fg hover:bg-fg/10'}`}>
            {d} días
          </button>
        ))}
        <button type="button" onClick={cargar} disabled={cargando}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-fg/5 text-fg hover:bg-fg/10 disabled:opacity-50">
          {cargando ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!data && cargando && <p className="text-sm text-fg-500">Consultando Instagram y LinkedIn…</p>}

      {ig && (
        <div className="rounded-2xl border border-fg/10 p-4 space-y-4">
          <h3 className="font-semibold text-fg">Instagram {ig.perfil && <span className="text-fg-500 font-normal">@{ig.perfil.usuario}</span>}</h3>
          {ig.error ? <p className="text-sm text-red-500">{ig.error}</p> : (
            <>
              {ig.insights?.error && <p className="text-sm text-amber-600">{ig.insights.error}</p>}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <Tarjeta label="Seguidores" valor={ig.perfil.seguidores} nota={ig.insights?.seguidoresNuevos != null ? `+${ig.insights.seguidoresNuevos} en ${ig.insights.dias} d` : null} />
                <Tarjeta label="Alcance" valor={c?.reach} nota={c ? `${ig.insights.dias} días` : null} />
                <Tarjeta label="Vistas" valor={c?.views} />
                <Tarjeta label="Interacciones" valor={c?.total_interactions} />
                <Tarjeta label="Compartidos" valor={c?.shares} />
                <Tarjeta label="Cuentas que interactuaron" valor={c?.accounts_engaged} />
              </div>
              <Evolucion serie={ig.evolucion} />

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-fg-500">Ordenar por</span>
                {ORDENES.map(o => (
                  <button key={o.id} type="button" onClick={() => setOrden(o.id)}
                    className={`px-2.5 py-1 rounded-md text-xs ${orden === o.id ? 'bg-pink-600 text-white' : 'bg-fg/5 text-fg hover:bg-fg/10'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-fg-500">
                      <th className="py-1 pr-3">Fecha</th><th className="pr-3">Tipo</th><th className="pr-3">Texto</th>
                      <th className="pr-3 text-right">Alcance</th><th className="pr-3 text-right">Vistas</th>
                      <th className="pr-3 text-right">Likes</th><th className="pr-3 text-right">Coment.</th><th className="text-right">Interac.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-fg/10">
                    {posts.map(p => (
                      <tr key={p.id}>
                        <td className="py-1.5 pr-3 whitespace-nowrap text-fg-500">{fecha(p.fecha)}</td>
                        <td className="pr-3 whitespace-nowrap text-fg">{TIPOS[p.tipo] || p.tipo}</td>
                        <td className="pr-3 max-w-[22rem] truncate">
                          {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline">{p.texto || '(sin texto)'}</a> : (p.texto || '(sin texto)')}
                        </td>
                        <td className="pr-3 text-right text-fg">{fmt(p.alcance)}</td>
                        <td className="pr-3 text-right text-fg">{fmt(p.vistas)}</td>
                        <td className="pr-3 text-right text-fg">{fmt(p.likes)}</td>
                        <td className="pr-3 text-right text-fg">{fmt(p.comentarios)}</td>
                        <td className="text-right text-fg">{fmt(p.interacciones)}</td>
                      </tr>
                    ))}
                    {!posts.length && <tr><td colSpan={8} className="py-4 text-center text-fg-500">Sin publicaciones.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {li && (
        <div className="rounded-2xl border border-fg/10 p-4 space-y-3">
          <h3 className="font-semibold text-fg">LinkedIn</h3>
          {li.error ? <p className="text-sm text-red-500">{li.error}</p> : (
            <>
              <p className="text-sm text-fg-500">
                {li.conexion?.conectado
                  ? `Conectado${li.conexion.diasRestantes != null ? ` · el token vence en ${li.conexion.diasRestantes} días` : ''}.`
                  : 'Desconectado: reconectá desde Redes Sociales → LinkedIn.'}
                {' '}{li.posts.length} publicaciones en {data.dias} días{li.fallidos ? `, ${li.fallidos} fallidas` : ''}.
              </p>
              <p className="text-xs text-fg-500">
                Las métricas (impresiones, reacciones) todavía no están disponibles: LinkedIn tiene que aprobar la Community Management API
                (pedido enviado). Mientras tanto se ven en LinkedIn → Actividad → “Ver analíticas”.
              </p>
              <ul className="divide-y divide-fg/10">
                {li.posts.map((p, i) => (
                  <li key={`${p.fecha}-${i}`} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                    <span className="text-xs text-fg-500 w-12">{fecha(p.fecha)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-fg/5 text-fg">{ORIGEN[p.origen] || p.origen}</span>
                    {p.url
                      ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline truncate">{p.titulo || '(sin título)'}</a>
                      : <span className="text-fg truncate">{p.titulo || '(sin título)'}</span>}
                  </li>
                ))}
                {!li.posts.length && <li className="py-3 text-sm text-fg-500">Sin publicaciones en el período.</li>}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
