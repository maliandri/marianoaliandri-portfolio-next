import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
vi.mock('@/lib/geminiClient', () => ({ callGemini: vi.fn(async () => 'Hola [Nombre]') })); // inválido → plantilla
vi.mock('@/lib/bizEmail', async (orig) => ({ ...(await orig()), sendViaResend: vi.fn(async () => ({ resendId: 'r1' })), getScreenshot: vi.fn(async () => null) }));
import { createFakeDb } from '@/test/fakeDb';
import { sendViaResend } from '@/lib/bizEmail';
import { draftBusinessEmailTool, sendBusinessEmailTool, listSentEmailsTool } from './email';

const user = { uid: 'u1', email: 'm@x.com' };
const at = (iso) => { const d = new Date(iso); return { __ts: d.getTime() * 1000, toDate: () => d }; };
const row = { id: 'p1', nombre: 'Panadería La Espiga', siteUrl: 'https://www.espiga.com', email: 'info@espiga.com', seoScore: 30, ciudad: 'Neuquén', tipo: 'Panadería' };

function seed(extra = {}) {
  return createFakeDb({ 'auditorias/a1': { title: 'T', results: [row] }, ...extra });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EMAIL_UNSUBSCRIBE_SECRET = 'secreto';
  delete process.env.MCP_EMAIL_DAILY_CAP;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({}) }));
});

describe('draft_business_email', () => {
  it('arma el borrador con la plantilla si Gemini no sirve', async () => {
    const { db, docs } = seed();
    const r = await draftBusinessEmailTool.handler({ audit_id: 'a1', place_id: 'p1' }, { db, user });
    expect(r.data).toMatchObject({ to: 'info@espiga.com', source: 'template', bloqueo: null });
    expect(docs[`mcp_email_drafts/${r.data.draftId}`].uid).toBe('u1');
  });
});

describe('send_business_email', () => {
  it('no le escribe a un dominio contactado hace 10 días', async () => {
    const { db } = seed({ 'sent_emails/s1': { email: 'otra@espiga.com', siteUrl: 'https://espiga.com', createdAt: at(new Date(Date.now() - 10 * 86400000).toISOString()) } });
    const r = await sendBusinessEmailTool.handler({ audit_id: 'a1', place_id: 'p1' }, { db, user });
    expect(r.data).toMatchObject({ enviado: false, motivo: 'ya_contactado' });
    expect(sendViaResend).not.toHaveBeenCalled();
  });

  it('pasados 31 días sí le escribe y lo registra con origen mcp', async () => {
    const { db, docs } = seed({ 'sent_emails/s1': { email: 'info@espiga.com', siteUrl: 'https://espiga.com', createdAt: at(new Date(Date.now() - 31 * 86400000).toISOString()) } });
    const r = await sendBusinessEmailTool.handler({ audit_id: 'a1', place_id: 'p1' }, { db, user });
    expect(r.data).toMatchObject({ enviado: true, to: 'info@espiga.com' });
    expect(JSON.stringify(r)).not.toContain('r1');
    expect(sendViaResend.mock.calls[0][0].html).toContain('/baja/?e=info%40espiga.com');
    const nuevo = Object.entries(docs).filter(([k]) => k.startsWith('sent_emails/')).map(([, v]) => v).find(v => v.origen === 'mcp');
    expect(nuevo).toMatchObject({ placeId: 'p1', dominio: 'espiga.com', resendId: 'r1' });
  });

  it('respeta el tope diario', async () => {
    process.env.MCP_EMAIL_DAILY_CAP = '1';
    const { db } = seed({ [`mcp_email_counter/${new Date().toISOString().slice(0, 10)}`]: { n: 1 } });
    const r = await sendBusinessEmailTool.handler({ audit_id: 'a1', place_id: 'p1' }, { db, user });
    expect(r.data).toMatchObject({ enviado: false, motivo: 'tope_diario' });
    expect(sendViaResend).not.toHaveBeenCalled();
  });

  it('baja → no se envía', async () => {
    const { db } = seed({ 'email_bajas/b': { email: 'info@espiga.com', dominios: [] } });
    const r = await sendBusinessEmailTool.handler({ audit_id: 'a1', place_id: 'p1' }, { db, user });
    expect(r.data).toMatchObject({ enviado: false, motivo: 'baja' });
  });

  it('dry_run no manda ni gasta cupo', async () => {
    process.env.MCP_EMAIL_DAILY_CAP = '1';
    const { db, docs } = seed();
    const r = await sendBusinessEmailTool.handler({ audit_id: 'a1', place_id: 'p1', dry_run: true }, { db, user });
    expect(r.data).toMatchObject({ enviado: false, dryRun: true });
    expect(sendViaResend).not.toHaveBeenCalled();
    expect(Object.keys(docs).some(k => k.startsWith('mcp_email_counter/'))).toBe(false);
  });

  it('envía un borrador y no lo deja reusar', async () => {
    const { db } = seed();
    const d = await draftBusinessEmailTool.handler({ audit_id: 'a1', place_id: 'p1' }, { db, user });
    const r = await sendBusinessEmailTool.handler({ draft_id: d.data.draftId }, { db, user });
    expect(r.data.enviado).toBe(true);
    await expect(sendBusinessEmailTool.handler({ draft_id: d.data.draftId }, { db, user })).rejects.toThrow(/ya se envió/);
  });
});

describe('list_sent_emails', () => {
  it('lista con origen (los viejos cuentan como admin)', async () => {
    const { db } = createFakeDb({
      'sent_emails/a': { email: 'a@a.com', nombre: 'A', status: 'delivered', createdAt: at('2026-10-01T00:00:00Z') },
      'sent_emails/b': { email: 'b@b.com', nombre: 'B', status: 'sent', origen: 'mcp', createdAt: at('2026-10-02T00:00:00Z') },
    });
    const all = await listSentEmailsTool.handler({}, { db, user });
    expect(all.data.items.map(i => [i.to, i.origen])).toEqual([['b@b.com', 'mcp'], ['a@a.com', 'admin']]);
    const mcp = await listSentEmailsTool.handler({ origen: 'mcp' }, { db, user });
    expect(mcp.data.items).toHaveLength(1);
  });
});
