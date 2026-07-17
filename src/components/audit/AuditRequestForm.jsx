'use client';

import { useState, useMemo } from 'react';
import { PROVINCIAS_AR } from '../../data/localidadesAR';

export default function AuditRequestForm({ defaultSearchTerm = '', auditCity = '' }) {
  const [nombre,     setNombre]     = useState('');
  const [telefono,   setTelefono]   = useState('');
  const [email,      setEmail]      = useState('');
  const [sitioWeb,   setSitioWeb]   = useState('');
  const [searchTerm, setSearchTerm] = useState(defaultSearchTerm);
  const [provincia,  setProvincia]  = useState('');
  const [localidad,  setLocalidad]  = useState('');
  const [sending,    setSending]    = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState('');

  const localidades = useMemo(() =>
    PROVINCIAS_AR.find(p => p.provincia === provincia)?.localidades || [],
    [provincia]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/audit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono, email, sitioWeb, searchTerm, provincia, localidad }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar la solicitud');
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  if (done) return (
    <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-8 text-center">
      <div className="text-5xl mb-4">✅</div>
      <h3 className="text-white font-bold text-xl mb-2">¡Solicitud recibida!</h3>
      <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
        Vamos a analizar cómo aparece <strong className="text-white">{searchTerm}</strong> en Google
        para <strong className="text-white">{localidad}, {provincia}</strong>.
      </p>
      <p className="text-gray-500 text-sm mt-3">
        Te enviamos la confirmación a <span className="text-indigo-400">{email}</span>.<br />
        Te contactamos en las próximas 48&nbsp;hs.
      </p>
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-indigo-950/50 to-[#0e0e12] border border-indigo-500/25 rounded-2xl p-6 md:p-8">
      {/* Header */}
      <div className="mb-7">
        <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">Auditoría gratuita</span>
        <h3 className="text-white font-black text-2xl md:text-3xl mt-2 leading-tight">
          ¿Tu negocio aparece<br className="hidden md:block" /> cuando te buscan?
        </h3>
        <p className="text-gray-400 text-sm mt-2 max-w-lg leading-relaxed">
          Analizamos tu presencia en Google según tu rubro y ciudad, y te enviamos un informe
          gratuito con el estado SEO de tu sitio.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nombre y teléfono */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Nombre y apellido *</label>
            <input
              required value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Juan García"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Número de teléfono / WhatsApp *</label>
            <input
              required value={telefono} onChange={e => setTelefono(e.target.value)}
              placeholder="Ej: +54 9 11 2345 6789"
              type="tel"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">
            Email *
            <span className="text-gray-600 ml-1">— te enviamos el informe aquí</span>
          </label>
          <input
            required type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Rubro */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">
            Rubro / término de búsqueda *
            <span className="text-gray-600 ml-1">— cómo te busca tu cliente en Google</span>
          </label>
          <input
            required value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Ej: peluquería, dentista, ferretería, etc."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Provincia + Localidad */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Provincia *</label>
            <select
              required value={provincia} onChange={e => { setProvincia(e.target.value); setLocalidad(''); }}
              className="w-full bg-[#0e0e12] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
            >
              <option value="">Seleccioná...</option>
              {PROVINCIAS_AR.map(p => (
                <option key={p.provincia} value={p.provincia}>{p.provincia}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Ciudad / Localidad *</label>
            <select
              required value={localidad} onChange={e => setLocalidad(e.target.value)}
              disabled={!provincia}
              className="w-full bg-[#0e0e12] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none disabled:opacity-40"
            >
              <option value="">Seleccioná...</option>
              {localidades.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Sitio web (opcional) */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">
            URL de tu sitio web <span className="text-gray-600">(opcional)</span>
          </label>
          <input
            type="url" value={sitioWeb} onChange={e => setSitioWeb(e.target.value)}
            placeholder="https://tuempresa.com.ar"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-2">{error}</p>}

        <button
          type="submit"
          disabled={sending}
          className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          {sending ? (
            <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Enviando...</>
          ) : (
            '🔍 Solicitar mi auditoría gratuita'
          )}
        </button>

        <p className="text-xs text-gray-600 text-center leading-relaxed">
          Sin costo. Sin compromiso. Te contactamos con el informe en 48&nbsp;hs.
        </p>
      </form>
    </div>
  );
}
