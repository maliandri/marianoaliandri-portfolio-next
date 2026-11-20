// Dashboard de seguidores / seguidos de Instagram (admin). Se alimenta con el export oficial de
// Instagram (JSON); se procesa en el navegador y se guarda solo en localStorage de este equipo.
// Vista de tabla tipo Excel, con datos públicos de cada cuenta (bio, web, seguidores) traídos por la
// API oficial vía /api/ig-seguidos (solo cuentas profesionales). Nada de esto se guarda en el servidor.
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { parseIgExport, cruzar, igUrl } from '@/lib/igFollowers';

const KEY = 'ig_followers_export_v1';
const KEY_DATOS = 'ig_followers_datos_v1';
const FILTROS = [
  { id: 'noMeSiguen', label: 'No me siguen' },
  { id: 'mutuos', label: 'Mutuos' },
  { id: 'noSigo', label: 'No los sigo' },
  { id: 'todos', label: 'Todos' },
];
const COLUMNAS = [
  { id: 'handle', label: 'Usuario', tipo: 'texto' },
  { id: 'meSigue', label: 'Me sigue', tipo: 'bool' },
  { id: 'loSigo', label: 'Lo sigo', tipo: 'bool' },
  { id: 'nombre', label: 'Nombre', tipo: 'texto' },
  { id: 'bio', label: 'Bio', tipo: 'texto' },
  { id: 'web', label: 'Web', tipo: 'texto' },
  { id: 'seguidores', label: 'Seguidores', tipo: 'num' },
  { id: 'posts', label: 'Posts', tipo: 'num' },
  { id: 'estado', label: 'Datos', tipo: 'texto' },
];

const leerArchivos = async (files) => {
  const out = [];
  for (const f of files) out.push({ name: f.name, json: JSON.parse(await f.text()) });
  return out;
};
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const fmt = (n) => (n == null ? '' : Number(n).toLocaleString('es-AR'));
const celdaCsv = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

const estadoDe = (d) => (!d ? 'Pendiente' : d.ok ? 'Profesional' : (d.motivo || 'No disponible'));
const valorDe = (f, col) => {
  const d = f.datos;
  switch (col) {
    case 'nombre': return d?.nombre || '';
    case 'bio': return d?.bio || '';
    case 'web': return d?.web || '';
    case 'seguidores': return d?.seguidores ?? null;
    case 'posts': return d?.posts ?? null;
    case 'estado': return estadoDe(d);
    default: return f[col];
  }
};

export default function InstagramFollowers() {
  const { getIdToken } = useAuthUser();
  const [data, setData] = useState({ seguidores: [], seguidos: [], subidoEn: null });
  const [datos, setDatos] = useState({}); // handle → resultado de /api/ig-seguidos
  const [filtro, setFiltro] = useState('noMeSiguen');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [orden, setOrden] = useState({ col: 'handle', dir: 'asc' });
  const [activo, setActivo] = useState(false);
  const [porHora, setPorHora] = useState(180);
  const [aviso, setAviso] = useState('');
  const [progreso, setProgreso] = useState(null); // { handle, n, total, proxima }
  const [ahora, setAhora] = useState(() => Date.now());
  const corriendo = useRef(false);
  const datosRef = useRef({});

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY); if (s) setData(JSON.parse(s));
      const d = localStorage.getItem(KEY_DATOS); if (d) { const p = JSON.parse(d); setDatos(p); datosRef.current = p; }
    } catch { /* sin storage */ }
    return () => { corriendo.current = false; };
  }, []);

  // Reloj de 1 s mientras se traen datos, para la cuenta regresiva de la próxima consulta.
  useEffect(() => {
    if (!activo) return undefined;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activo]);

  const guardar = (next) => {
    setData(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin storage */ }
  };

  const guardarDato = useCallback((item) => {
    const next = { ...datosRef.current, [item.handle]: item };
    datosRef.current = next;
    setDatos(next);
    try { localStorage.setItem(KEY_DATOS, JSON.stringify(next)); } catch { /* sin storage */ }
  }, []);

  const onFiles = async (e) => {
    setError('');
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    try {
      const leidos = await leerArchivos(files);
      let { seguidores, seguidos } = data;
      let nuevosSeguidores = [];
      let tocoSeguidores = false;
      let tocoSeguidos = false;
      for (const { name, json } of leidos) {
        const lista = parseIgExport(json);
        if (/following/i.test(name)) { seguidos = lista; tocoSeguidos = true; }
        else if (/followers/i.test(name)) { nuevosSeguidores = nuevosSeguidores.concat(lista); tocoSeguidores = true; }
        else throw new Error(`"${name}" no parece followers_N.json ni following.json`);
      }
      if (tocoSeguidores) seguidores = nuevosSeguidores;
      if (!tocoSeguidores && !tocoSeguidos) return;
      guardar({ seguidores, seguidos, subidoEn: Date.now() });
    } catch (err) {
      setError(err.message || 'No pude leer los archivos (tienen que ser los .json del export).');
    }
  };

  const { stats, filas } = useMemo(() => cruzar(data.seguidores, data.seguidos), [data]);

  const visibles = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^@/, '');
    const lista = filas
      .filter(f => {
        if (filtro === 'noMeSiguen' && !(f.loSigo && !f.meSigue)) return false;
        if (filtro === 'mutuos' && !(f.loSigo && f.meSigue)) return false;
        if (filtro === 'noSigo' && !(f.meSigue && !f.loSigo)) return false;
        const d = datos[f.handle];
        return !term || f.handle.includes(term) || (d?.nombre || '').toLowerCase().includes(term) || (d?.bio || '').toLowerCase().includes(term);
      })
      .map(f => ({ ...f, datos: datos[f.handle] }));
    const { col, dir } = orden;
    const tipo = COLUMNAS.find(c => c.id === col)?.tipo;
    const signo = dir === 'asc' ? 1 : -1;
    return lista.sort((a, b) => {
      const x = valorDe(a, col), y = valorDe(b, col);
      if (x == null && y == null) return 0;
      if (x == null) return 1; // los vacíos siempre al final
      if (y == null) return -1;
      if (tipo === 'num') return (x - y) * signo;
      if (tipo === 'bool') return (Number(x) - Number(y)) * signo;
      return String(x).localeCompare(String(y), 'es') * signo;
    });
  }, [filas, filtro, q, datos, orden]);

  const pendientes = useMemo(() => visibles.filter(f => !datos[f.handle]).map(f => f.handle), [visibles, datos]);

  const traerDatos = async () => {
    if (corriendo.current) return;
    corriendo.current = true;
    setActivo(true);
    setAviso('');
    try {
      for (const [i, handle] of pendientes.entries()) {
        if (!corriendo.current) break;
        if (datosRef.current[handle]) continue;
        setProgreso({ handle, n: i + 1, total: pendientes.length, proxima: null });
        const idToken = await getIdToken();
        const resp = await fetch('/api/ig-seguidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
          body: JSON.stringify({ handles: [handle] }),
        });
        const json = await resp.json().catch(() => ({}));
        for (const item of json.items || []) guardarDato(item);
        if (json.pausa) { setAviso('Meta pidió una pausa por límite de uso. Esperá un rato y volvé a apretar "Traer datos": retoma donde quedó.'); break; }
        if (!resp.ok) { setAviso(resp.status === 401 || resp.status === 403 ? 'Entrá con tu cuenta de admin para traer los datos.' : (json.error || `Error ${resp.status}`)); break; }
        const espera = 3600000 / porHora;
        setAhora(Date.now());
        setProgreso(p => (p ? { ...p, proxima: Date.now() + espera } : p));
        await dormir(espera);
      }
    } finally {
      corriendo.current = false;
      setActivo(false);
      setProgreso(null);
    }
  };
  const detener = () => { corriendo.current = false; };

  const descargarCsv = () => {
    const cab = ['usuario', 'perfil', 'me_sigue', 'lo_sigo', 'nombre', 'bio', 'web', 'seguidores', 'posts', 'datos'];
    const filasCsv = visibles.map(f => [f.handle, igUrl(f.handle), f.meSigue ? 'si' : 'no', f.loSigo ? 'si' : 'no',
      valorDe(f, 'nombre'), valorDe(f, 'bio'), valorDe(f, 'web'), valorDe(f, 'seguidores') ?? '', valorDe(f, 'posts') ?? '', valorDe(f, 'estado')]);
    const texto = '﻿' + [cab, ...filasCsv].map(r => r.map(celdaCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `instagram-${filtro}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ordenarPor = (col) => setOrden(o => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));

  const vacio = !data.seguidores.length && !data.seguidos.length;
  const cuenta = { noMeSiguen: stats.noMeSiguen, mutuos: stats.mutuos, noSigo: stats.noSigo, todos: filas.length };
  const traidos = Object.keys(datos).length;
  const profesionales = Object.values(datos).filter(d => d.ok).length;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-fg/10 p-4 space-y-2">
        <h2 className="text-lg font-semibold text-fg">Seguidores y seguidos de Instagram</h2>
        <p className="text-sm text-fg-500">
          Instagram no entrega estas listas por API. En la app: Configuración → Centro de cuentas → Tu información y permisos →
          Descargar tu información → solo “Seguidores y seguidos”, formato <b>JSON</b>. Subí <code>followers_1.json</code> (y los
          siguientes si hay) y <code>following.json</code>. La lista no sale de tu navegador.
        </p>
        <input type="file" accept=".json,application/json" multiple onChange={onFiles} aria-label="Subir export de Instagram"
          className="text-sm text-fg file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-pink-600 file:text-white file:text-xs file:font-semibold" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        {data.subidoEn && <p className="text-xs text-fg-500">Cargado el {new Date(data.subidoEn).toLocaleString('es-AR')}</p>}
      </div>

      {!vacio && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[['Seguidores', stats.seguidores], ['Seguidos', stats.seguidos], ['Mutuos', stats.mutuos],
              ['No me siguen', stats.noMeSiguen], ['No los sigo', stats.noSigo]].map(([l, n]) => (
              <div key={l} className="rounded-xl bg-fg/5 p-3">
                <div className="text-2xl font-bold text-fg">{n.toLocaleString('es-AR')}</div>
                <div className="text-xs text-fg-500">{l}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FILTROS.map(f => (
              <button key={f.id} type="button" onClick={() => setFiltro(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filtro === f.id ? 'bg-pink-600 text-white' : 'bg-fg/5 text-fg hover:bg-fg/10'}`}>
                {f.label} ({cuenta[f.id]})
              </button>
            ))}
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar usuario, nombre o bio" aria-label="Buscar"
              className="ml-auto text-sm bg-fg/5 border border-fg/10 rounded-lg px-3 py-1.5 text-fg" />
          </div>

          <div className="rounded-2xl border border-fg/10 p-3 flex flex-wrap items-center gap-3">
            {activo
              ? <button type="button" onClick={detener} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white">Detener</button>
              : <button type="button" onClick={traerDatos} disabled={!pendientes.length}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-pink-600 text-white disabled:opacity-40">
                  Traer datos ({pendientes.length} pendientes)
                </button>}
            <label className="text-xs text-fg-500 flex items-center gap-1">
              Ritmo
              <select value={porHora} onChange={e => setPorHora(Number(e.target.value))} disabled={activo}
                className="bg-fg/5 border border-fg/10 rounded-md px-1.5 py-1 text-fg text-xs">
                <option value={60}>60 por hora</option>
                <option value={120}>120 por hora</option>
                <option value={180}>180 por hora</option>
                <option value={300}>300 por hora</option>
              </select>
            </label>
            <button type="button" onClick={descargarCsv} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-fg/5 text-fg hover:bg-fg/10">
              Descargar CSV ({visibles.length})
            </button>
            <span className="text-xs text-fg-500">
              {traidos} consultadas · {profesionales} profesionales. Se traen de a una por la API oficial; dejá esta pestaña abierta.
              Las cuentas personales no devuelven datos.
            </span>
            {activo && progreso && (
              <p role="status" className="w-full text-sm text-fg">
                {progreso.proxima == null
                  ? `Consultando @${progreso.handle} (${progreso.n} de ${progreso.total})…`
                  : `Última: @${progreso.handle} (${progreso.n} de ${progreso.total}) · próxima consulta en ${Math.max(0, Math.ceil((progreso.proxima - ahora) / 1000))} s`}
                {' · '}quedan unas {Math.max(0, Math.ceil(((progreso.total - progreso.n) * 3600) / porHora / 60))} min
              </p>
            )}
            {aviso && <p className="w-full text-sm text-amber-600">{aviso}</p>}
          </div>

          <div className="overflow-auto max-h-[70vh] rounded-2xl border border-fg/10">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-bg z-10">
                <tr className="text-left text-xs text-fg-500">
                  {COLUMNAS.map(c => (
                    <th key={c.id} scope="col" aria-sort={orden.col === c.id ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="border-b border-fg/10 px-3 py-2 whitespace-nowrap">
                      <button type="button" onClick={() => ordenarPor(c.id)} className="font-semibold hover:text-fg">
                        {c.label}{orden.col === c.id ? (orden.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.slice(0, 500).map(f => (
                  <tr key={f.handle} className="border-b border-fg/5 hover:bg-fg/5 align-top">
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <a href={igUrl(f.handle)} target="_blank" rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-md bg-pink-600 hover:bg-pink-500 text-white text-xs font-medium">@{f.handle}</a>
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-md ${f.meSigue ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-500'}`}>
                        {f.meSigue ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-xs text-fg-500">{f.loSigo ? 'Sí' : 'No'}</td>
                    <td className="px-3 py-1.5 text-fg whitespace-nowrap max-w-[14rem] truncate">{valorDe(f, 'nombre')}</td>
                    <td className="px-3 py-1.5 text-fg-500 min-w-[18rem] max-w-[28rem]">
                      <div className="line-clamp-2 text-xs">{valorDe(f, 'bio')}</div>
                    </td>
                    <td className="px-3 py-1.5 max-w-[12rem] truncate text-xs">
                      {valorDe(f, 'web')
                        ? <a href={valorDe(f, 'web')} target="_blank" rel="noopener noreferrer nofollow" className="text-pink-600 hover:underline">{valorDe(f, 'web').replace(/^https?:\/\/(www\.)?/, '')}</a>
                        : null}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-fg">{fmt(valorDe(f, 'seguidores'))}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-fg-500">{fmt(valorDe(f, 'posts'))}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-xs text-fg-500">{valorDe(f, 'estado')}</td>
                  </tr>
                ))}
                {!visibles.length && <tr><td colSpan={COLUMNAS.length} className="px-4 py-6 text-sm text-fg-500 text-center">Sin resultados.</td></tr>}
              </tbody>
            </table>
          </div>
          {visibles.length > 500 && <p className="text-xs text-fg-500">Mostrando 500 de {visibles.length}; usá el buscador o los filtros para acotar. El CSV baja todo lo filtrado.</p>}
        </>
      )}
    </section>
  );
}
