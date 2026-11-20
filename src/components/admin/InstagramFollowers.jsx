// Dashboard de seguidores / seguidos de Instagram (admin). Se alimenta con el export oficial de
// Instagram (JSON); se procesa en el navegador y se guarda solo en localStorage de este equipo.
'use client';

import { useState, useEffect, useMemo } from 'react';
import { parseIgExport, cruzar, igUrl } from '@/lib/igFollowers';

const KEY = 'ig_followers_export_v1';
const FILTROS = [
  { id: 'noMeSiguen', label: 'No me siguen' },
  { id: 'mutuos', label: 'Mutuos' },
  { id: 'noSigo', label: 'No los sigo' },
  { id: 'todos', label: 'Todos' },
];

const leerArchivos = async (files) => {
  const out = [];
  for (const f of files) out.push({ name: f.name, json: JSON.parse(await f.text()) });
  return out;
};

export default function InstagramFollowers() {
  const [data, setData] = useState({ seguidores: [], seguidos: [], subidoEn: null });
  const [filtro, setFiltro] = useState('noMeSiguen');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setData(JSON.parse(s)); } catch { /* sin storage */ }
  }, []);

  const guardar = (next) => {
    setData(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin storage */ }
  };

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
    return filas.filter(f => {
      if (filtro === 'noMeSiguen' && !(f.loSigo && !f.meSigue)) return false;
      if (filtro === 'mutuos' && !(f.loSigo && f.meSigue)) return false;
      if (filtro === 'noSigo' && !(f.meSigue && !f.loSigo)) return false;
      return !term || f.handle.includes(term);
    });
  }, [filas, filtro, q]);

  const vacio = !data.seguidores.length && !data.seguidos.length;
  const cuenta = { noMeSiguen: stats.noMeSiguen, mutuos: stats.mutuos, noSigo: stats.noSigo, todos: filas.length };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-fg/10 p-4 space-y-2">
        <h2 className="text-lg font-semibold text-fg">Seguidores y seguidos de Instagram</h2>
        <p className="text-sm text-fg-500">
          Instagram no entrega estas listas por API. En la app: Configuración → Centro de cuentas → Tu información y permisos →
          Descargar tu información → solo “Seguidores y seguidos”, formato <b>JSON</b>. Subí <code>followers_1.json</code> (y los
          siguientes si hay) y <code>following.json</code>. No sale de tu navegador.
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
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar @usuario" aria-label="Buscar usuario"
              className="ml-auto text-sm bg-fg/5 border border-fg/10 rounded-lg px-3 py-1.5 text-fg" />
          </div>

          <ul className="rounded-2xl border border-fg/10 divide-y divide-fg/10">
            {visibles.slice(0, 500).map(f => (
              <li key={f.handle} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <a href={igUrl(f.handle)} target="_blank" rel="noopener noreferrer"
                  className="px-2 py-0.5 rounded-md bg-pink-600 hover:bg-pink-500 text-white text-xs font-medium">@{f.handle}</a>
                <span className={`text-xs px-2 py-0.5 rounded-md ${f.meSigue ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-500'}`}>
                  {f.meSigue ? 'Me sigue' : 'No me sigue'}
                </span>
                <span className="text-xs text-fg-500">{f.loSigo ? 'Lo sigo' : 'No lo sigo'}</span>
              </li>
            ))}
            {!visibles.length && <li className="px-4 py-6 text-sm text-fg-500 text-center">Sin resultados.</li>}
          </ul>
          {visibles.length > 500 && <p className="text-xs text-fg-500">Mostrando 500 de {visibles.length}; usá el buscador para acotar.</p>}
        </>
      )}
    </section>
  );
}
