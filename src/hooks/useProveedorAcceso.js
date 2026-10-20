'use client';

import { useEffect, useState } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';

// ¿El usuario logueado puede entrar a /compras/moodfit? Se cachea por uid para que el menú
// y la tarjeta del panel no hagan dos pedidos.
const cache = new Map(); // uid → Promise<boolean>

export function useProveedorAcceso() {
  const { user, getIdToken } = useAuthUser();
  const [acceso, setAcceso] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!cache.has(user.uid)) {
      cache.set(user.uid, getIdToken()
        .then((token) => (token ? fetch('/api/proveedor/acceso/', { headers: { Authorization: `Bearer ${token}` } }) : null))
        .then((r) => (r && r.ok ? r.json() : { acceso: false }))
        .then((d) => d.acceso === true)
        .catch(() => false));
    }
    let vivo = true;
    cache.get(user.uid).then((v) => vivo && setAcceso(v));
    return () => { vivo = false; };
  }, [user, getIdToken]);

  return user ? acceso : false;
}
