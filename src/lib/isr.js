// Páginas públicas con ISR (export const revalidate): se generan una vez y se sirven
// desde el CDN, en vez de correr una función en cada visita (cupo de Active CPU de
// Vercel Hobby). Si leer Firestore falla al regenerar, hay que tirar el error: Next
// conserva la última versión buena. Devolver una lista vacía la dejaría cacheada.
// Excepción: el build (ej. CI sin credenciales) sí renderiza el estado vacío.
export const isBuildPhase = () => process.env.NEXT_PHASE === 'phase-production-build';
