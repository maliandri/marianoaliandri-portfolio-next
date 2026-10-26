export const dynamic = 'force-dynamic';

// Seguimiento de prospectos de Instagram (admin). Colección ig_prospectos/{handle}, solo Admin SDK.
// GET → lista · POST { lead, regenerar? } → crea/actualiza y genera el DM · PATCH { handle, estado?, dm?, notas? }
// La lógica vive en src/lib/igProspectosStore.js (compartida con el servidor MCP).
import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { listProspectos, upsertProspecto, updateProspecto } from '@/lib/igProspectosStore';

const reply = (r) => (r.error ? Response.json({ error: r.error }, { status: r.status }) : Response.json({ item: r.item }));

export async function GET(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const { items } = await listProspectos(getDb(), { limit: 500 });
  return Response.json({ items });
}

export async function POST(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const { lead, regenerar = false } = await request.json().catch(() => ({}));
  return reply(await upsertProspecto(getDb(), lead, { regenerar }));
}

export async function PATCH(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const { handle, estado, dm, notas } = await request.json().catch(() => ({}));
  return reply(await updateProspecto(getDb(), handle, { estado, dm, notas }));
}
