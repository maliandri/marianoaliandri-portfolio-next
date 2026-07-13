'use client';

import { useState, useEffect, useCallback } from 'react';
import { firebaseAuth } from '@/utils/firebaseservice';

// Hook de autenticación reutilizable.
// - user: { uid, displayName, email, photoURL } | null
// - loading: true hasta que Firebase resuelve el estado inicial
// - getIdToken(): Promise<string|null> — token para llamar a las APIs protegidas
// - login(): inicia sesión con Google
export function useAuthUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = firebaseAuth.onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, []);

  const getIdToken = useCallback(async () => {
    const current = firebaseAuth.getCurrentUser();
    if (!current) return null;
    try {
      return await current.getIdToken();
    } catch {
      return null;
    }
  }, []);

  const login = useCallback(async () => {
    return firebaseAuth.loginWithGoogle();
  }, []);

  return { user, loading, getIdToken, login };
}
