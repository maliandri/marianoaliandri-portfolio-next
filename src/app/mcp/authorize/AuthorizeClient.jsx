'use client';

import { useState } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';

// Aprobar: login de Google (Firebase) → POST /api/mcp-oauth/authorize/ con el idToken → redirige
// al callback de Claude con el código. Cancelar: vuelve al callback con error=access_denied.
export default function AuthorizeClient({ params, clientName, redirectHost, loopback }) {
  const { user, login, getIdToken } = useAuthUser();
  const [estado, setEstado] = useState('inicio'); // inicio | enviando | error
  const [msg, setMsg] = useState('');

  const aprobar = async () => {
    setEstado('enviando'); setMsg('');
    try {
      if (!user) await login();
      const idToken = await getIdToken();
      if (!idToken) throw new Error('No se pudo iniciar sesión con Google.');
      const res = await fetch('/api/mcp-oauth/authorize/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ params }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) throw new Error('Esta cuenta no tiene acceso. Solo entra la cuenta del administrador.');
      if (!res.ok || !data.redirectTo) throw new Error(data.error_description || data.error || `Error ${res.status}`);
      window.location.href = data.redirectTo;
    } catch (e) {
      setEstado('error');
      setMsg(e.message);
    }
  };

  const cancelar = () => {
    const to = new URL(params.redirect_uri);
    to.searchParams.set('error', 'access_denied');
    if (params.state) to.searchParams.set('state', params.state);
    window.location.href = to.toString();
  };

  return (
    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow p-8">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
        {clientName} quiere usar tus herramientas
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Va a poder buscar leads, armar y publicar auditorías, mandar mails a negocios y ver las
        estadísticas de marianoaliandri.com.ar en tu nombre.
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        Después de aprobar vuelve a: <strong className="font-mono">{redirectHost}</strong>
      </p>
      {loopback && (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mb-4">
          Este pedido vuelve a un programa de tu propia computadora ({redirectHost}). Aprobalo solo si
          lo iniciaste vos (Claude Code o MCP Inspector).
        </p>
      )}
      {user && <p className="text-xs text-gray-500 mb-4">Sesión: {user.email}</p>}
      <div className="flex gap-3">
        <button
          onClick={aprobar}
          disabled={estado === 'enviando'}
          className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-semibold"
        >
          {estado === 'enviando' ? 'Conectando…' : user ? 'Permitir' : 'Entrar con Google y permitir'}
        </button>
        <button onClick={cancelar} className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300">
          Cancelar
        </button>
      </div>
      {msg && <p className="mt-4 text-sm text-red-600">{msg}</p>}
    </div>
  );
}
