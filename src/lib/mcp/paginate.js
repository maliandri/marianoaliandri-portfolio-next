import { ToolError } from './defineTool';

// Cursores opacos de las tools que devuelven listas (base64url de un JSON).
export const encodeCursor = (obj) => (obj == null ? null : Buffer.from(JSON.stringify(obj)).toString('base64url'));

export function decodeCursor(str) {
  if (str == null || str === '') return null;
  try {
    return JSON.parse(Buffer.from(String(str), 'base64url').toString('utf8'));
  } catch {
    throw new ToolError('Cursor inválido: usá el nextCursor que devolvió la llamada anterior.');
  }
}

// Paginado de una lista ya en memoria (ej. los leads de una búsqueda).
export function pageArray(list, { cursor, limit = 20 }) {
  const offset = decodeCursor(cursor)?.o || 0;
  const items = list.slice(offset, offset + limit);
  const next = offset + limit < list.length ? encodeCursor({ o: offset + limit }) : null;
  return { items, nextCursor: next, total: list.length };
}
