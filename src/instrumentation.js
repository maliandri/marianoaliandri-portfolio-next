// Next llama a onRequestError con cualquier error no capturado del servidor (rutas, páginas,
// server actions). Manda una alerta por mail (src/lib/alert.js, máx. una por hora por error).
export async function onRequestError(err, request, context) {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return;
  const { alertError } = await import('@/lib/alert');
  const path = String(request?.path || '').split('?')[0]; // sin query: puede traer códigos o tokens
  const ruta = context?.routePath || path || '?';
  await alertError(`req:${ruta}:${String(err?.message).slice(0, 60)}`, `Error en ${ruta}`, err, {
    ruta: path,
    metodo: request?.method,
    tipo: context?.routeType,
    digest: err?.digest,
  });
}
