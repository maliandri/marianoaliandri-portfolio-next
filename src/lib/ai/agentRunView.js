// Une el "empezó" y el "terminó" de cada herramienta (mismo id) en una sola fila de la línea de tiempo del
// visor del agente; el resto de los eventos pasan tal cual. Puro: lo usa la pantalla del admin.
export function armarFilas(eventos = []) {
  const filas = [];
  const porId = new Map();
  for (const e of eventos) {
    if (e.tipo !== 'herramienta') { filas.push(e); continue; }
    const fila = porId.get(e.id);
    if (!fila) {
      const nueva = { ...e };
      porId.set(e.id, nueva);
      filas.push(nueva);
    } else if (e.fase === 'fin') {
      Object.assign(fila, { fase: 'fin', ok: e.ok, resumen: e.resumen, ms: e.ms });
    }
  }
  return filas;
}
