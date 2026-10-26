import { firebaseAuth } from '@/utils/firebaseservice';

// fetch para rutas de admin protegidas con requireAdmin(): agrega el idToken de Firebase de la
// sesión actual. Sin sesión hace el fetch igual y la ruta responde 401.
export async function adminFetch(url, init = {}) {
  let token = null;
  try { token = await firebaseAuth.getCurrentUser()?.getIdToken(); } catch { /* sin sesión */ }
  return fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}
