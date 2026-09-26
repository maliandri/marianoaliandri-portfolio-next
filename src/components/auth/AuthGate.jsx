'use client';

import { useState, useEffect } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { db } from '@/utils/firebaseservice';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const INTERESTS = [
  {
    id: 'tienda',
    label: 'Sitio web o sistema',
    description: 'Quiero contratar un desarrollo',
    emoji: '🛒',
  },
  {
    id: 'leadfinder_dev',
    label: 'Lead Finder (dev)',
    description: 'Soy desarrollador y quiero integrarlo',
    emoji: '👨‍💻',
  },
  {
    id: 'leadfinder_comercio',
    label: 'Lead Finder (negocio)',
    description: 'Tengo un negocio y busco clientes',
    emoji: '🏪',
  },
  {
    id: 'analitica',
    label: 'Analítica regional',
    description: 'Quiero ver demanda por zona y rubro',
    emoji: '📊',
  },
];

const STORAGE_KEY = 'authgate_pending_interest';

// Envuelve contenido que requiere estar logueado.
// - loading → spinner
// - sin user → muro de login con selector de interés
// - con user → children
export default function AuthGate({ children, title = 'Contenido para usuarios registrados', subtitle, lang = 'es', defaultInterest = '' }) {
  const { user, loading, login } = useAuthUser();
  const [selectedInterest, setSelectedInterest] = useState(defaultInterest);
  const loginLabel = lang === 'en' ? 'Sign up with Google' : 'Registrarme con Google';
  const freeLabel = lang === 'en' ? 'Free. No card required.' : 'Gratis. Sin tarjeta.';

  // Cuando el usuario completa el login, guardar el interés pendiente en Firestore
  useEffect(() => {
    if (!user) return;
    const pending = sessionStorage.getItem(STORAGE_KEY);
    if (!pending) return;
    sessionStorage.removeItem(STORAGE_KEY);
    setDoc(
      doc(db, 'users', user.uid),
      {
        interest: pending,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL || null,
        registeredAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});
  }, [user]);

  async function handleLogin() {
    if (selectedInterest) sessionStorage.setItem(STORAGE_KEY, selectedInterest);
    await login();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-3xl">
          🔒
        </div>
        <h2 className="text-2xl font-black text-white mb-2">{title}</h2>
        <p className="text-gray-500 text-sm mb-6">
          {subtitle || 'Registrate gratis para acceder a la Analítica. Incluye 1 búsqueda de rubros sin cargo.'}
        </p>

        {/* Selector de interés */}
        <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-3">
          ¿Qué te trajo por acá?
        </p>
        <div className="grid grid-cols-2 gap-2 mb-6 text-left">
          {INTERESTS.map((item) => {
            const active = selectedInterest === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedInterest(active ? '' : item.id)}
                className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${
                  active
                    ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                    : 'bg-white/5 border-white/10 hover:border-indigo-500/50 hover:bg-white/8'
                }`}
              >
                <span className="text-xl leading-none">{item.emoji}</span>
                <span className={`text-xs font-semibold leading-tight ${active ? 'text-indigo-300' : 'text-white'}`}>
                  {item.label}
                </span>
                <span className="text-[11px] text-gray-400 leading-tight">{item.description}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleLogin}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          {loginLabel}
        </button>
        <p className="text-gray-600 text-xs mt-4">{freeLabel}</p>
      </div>
    );
  }

  return children;
}
