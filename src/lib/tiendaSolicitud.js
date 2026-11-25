// Solicitud de presupuesto desde la tienda (venta por consulta, 2026-11-25). Reemplaza al checkout directo:
// el cliente marca servicios, deja sus datos y, si quiere, pide un turno de Meet. NO se calcula ni guarda ningún
// monto: el precio lo cierra Mariano después de charlar. Queda en `presupuestos` (origen 'tienda') para el admin
// y el MCP. Las dependencias (turno libre, aviso por Telegram, catálogo) se inyectan para testear sin I/O.
import { FieldValue } from 'firebase-admin/firestore';
import { validarCliente, MAX_SERVICIOS } from '@/lib/tienda';
import { resolverDependencias } from '@/lib/tiendaDeps';
import { cargarCatalogo, PRESUPUESTOS } from '@/lib/tiendaCheckout';

export const MEET_MINUTOS = 30;
const MAX_CHAT = 20;
const MAX_TXT_CHAT = 500;

function limpiarChat(chat) {
  if (!Array.isArray(chat)) return [];
  return chat
    .filter(m => m && (m.rol === 'cliente' || m.rol === 'asistente') && String(m.texto || '').trim())
    .slice(-MAX_CHAT)
    .map(m => ({ rol: m.rol, texto: String(m.texto).trim().slice(0, MAX_TXT_CHAT) }));
}

export async function crearSolicitud(db, body = {}, {
  user = null,
  now = Date.now,
  cargar = cargarCatalogo,
  turnoValido = async () => false,
  avisar = async () => {},
} = {}) {
  if (!user) return { status: 401, error: 'Iniciá sesión con Google para pedir el presupuesto' };
  const { cliente, error } = validarCliente(body.cliente);
  if (error) return { status: 400, error };

  const pedidos = [...new Set((Array.isArray(body.servicios) ? body.servicios : []).map(String))].slice(0, MAX_SERVICIOS);
  if (!pedidos.length) return { status: 400, error: 'Marcá al menos un servicio' };
  const catalogo = (await cargar(db)).filter(s => s.activo !== false);
  const mapa = new Map(catalogo.map(s => [s.id, s]));
  if (pedidos.some(id => !mapa.has(id))) return { status: 400, error: 'Hay un servicio que ya no está disponible. Recargá la página.' };
  const { ids } = resolverDependencias(pedidos, catalogo);
  const items = ids.map(id => mapa.get(id)).filter(Boolean);

  let meet = { estado: 'sin_meet', inicio: null, fin: null };
  const inicioMs = Date.parse(body.meet?.inicio || '');
  if (Number.isFinite(inicioMs)) {
    const inicio = new Date(inicioMs).toISOString();
    if (!(await turnoValido(inicio))) return { status: 409, error: 'Ese horario ya no está libre' };
    meet = { estado: 'pedido', inicio, fin: new Date(inicioMs + MEET_MINUTOS * 60000).toISOString() };
  }

  const ref = await db.collection(PRESUPUESTOS).add({
    clientName: cliente.nombre,
    clientEmail: cliente.email,
    clientPhone: cliente.telefono,
    clientCompany: cliente.empresa,
    projectDescription: cliente.notas,
    deadline: '',
    selectedServices: items.map(i => i.label),
    servicioIds: items.map(i => i.id),
    origen: 'tienda',
    source: 'tienda',
    status: 'pending',
    userId: user.uid,
    chat: limpiarChat(body.chat),
    meet,
    sesionId: String(body.sesionId || '').slice(0, 64) || null,
    adminNotes: '',
    createdAtMs: now(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try { await avisar(ref.id); } catch (e) { console.error('[tienda] aviso de solicitud falló:', e?.message); }
  return { status: 201, id: ref.id };
}
