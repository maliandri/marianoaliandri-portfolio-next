import { describe, it, expect, vi, beforeAll } from 'vitest';

// Valores centinela: si alguno aparece en una respuesta de una tool, se filtró un secreto.
const S = {
  GEMINI_API_KEY: 'sentinel-gemini-1234567890',
  RESEND_API_KEY: 'sentinel-resend-1234567890',
  GOOGLE_PLACES_API_KEY: 'sentinel-places-1234567890',
  MAKE_SOCIAL_WEBHOOK_URL: 'https://hook.us2.make.com/sentinel-make-123',
  FIREBASE_PRIVATE_KEY: 'sentinel-private-key-1234567890',
  EMAIL_UNSUBSCRIBE_SECRET: 'sentinel-unsub-1234567890',
};
const LEAK = 'boom con sentinel-gemini-1234567890 adentro';

vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/geminiClient', () => ({ callGemini: vi.fn(async () => { throw new Error(LEAK); }) }));
vi.mock('@/lib/leadFinderPro', () => ({ makeLeadFinderCall: vi.fn(() => async () => ({ ok: true })) }));
vi.mock('@/lib/auditoriasStore', () => ({ saveAuditoria: vi.fn(async () => ({ id: 'aud1' })) }));
vi.mock('@/lib/imageCheck', () => ({ imageIsReachable: vi.fn(async () => ({ ok: false, detail: LEAK })) }));
vi.mock('@/lib/makeSocial', () => ({ postToMakeSocial: vi.fn(async () => { throw new Error(LEAK); }) }));
vi.mock('@/lib/siteStats', () => ({
  fetchGA4: vi.fn(async () => ({ sesiones: 1, usuarios: 1, paginasVistas: 1, bots: 0, paginas: [], fuentes: [{ fuente: LEAK, sesiones: 1 }], ciudades: [] })),
  fetchGSC: vi.fn(async () => { throw new Error(LEAK); }),
}));
vi.mock('@/lib/rubroDemand', async (orig) => ({
  ...(await orig()),
  analyzeAll: vi.fn(async () => [{ id: 'panaderia', label: 'Panadería', count: 3, raw: 3000, suggestions: [LEAK] }]),
}));
vi.mock('@/lib/bizEmail', async (orig) => ({
  ...(await orig()),
  sendViaResend: vi.fn(async () => { throw new Error(LEAK); }),
}));

import { createFakeDb } from '@/test/fakeDb';
import { registerTools } from './defineTool';
import { ALL_TOOLS } from './register';

const row = { id: 'p1', nombre: 'Panadería La Espiga', siteUrl: 'https://espiga.com', email: 'info@espiga.com', seoScore: 30, canal: 'web' };
const seed = () => createFakeDb({
  'auditorias/a1': { title: 'T', summary: LEAK, results: [row, { ...row, id: 'p2' }, { ...row, id: 'p3' }] },
  'leadfinder_searches/u1/items/s1': { ciudades: ['Neuquén'], tipos: [], terminos: ['x'], results: [row, { ...row, id: 'p2' }, { ...row, id: 'p3' }] },
  'mcp_lead_jobs/j1': { uid: 'u1', status: 'error', error: LEAK, totals: {}, avisos: [LEAK], leads: [row] },
  'ig_prospectos/pana': { handle: 'pana', estado: 'pendiente', dm: LEAK },
  'sent_emails/x': { email: 'z@z.com', siteUrl: 'https://z.com' },
});

// Argumentos de ejemplo por tool (camino feliz y camino de error).
const ARGS = {
  search_leads: [{ localidades: ['Neuquén'], terminos: ['durlock'], cantidad: 2 }, { localidades: ['Neuquén'], cantidad: 2 }],
  get_lead_search: [{ job_id: 'j1' }, { job_id: 'nope' }],
  list_lead_searches: [{}, { cursor: '%%' }],
  rank_rubros_by_demand: [{ localidad: 'Neuquén' }],
  list_audits: [{}],
  get_audit: [{ id: 'a1' }, { id: 'nope' }],
  create_audit_report: [{ search_id: 's1' }, { search_id: 'nope' }],
  publish_audit_social: [{ id: 'a1', networks: ['facebook'], dry_run: true }, { id: 'a1', networks: ['facebook'] }],
  draft_business_email: [{ audit_id: 'a1', place_id: 'p1' }, { audit_id: 'a1', place_id: 'nope' }],
  send_business_email: [{ audit_id: 'a1', place_id: 'p1' }, { audit_id: 'a1', place_id: 'p1', dry_run: true }],
  list_sent_emails: [{}],
  list_ig_prospects: [{}],
  update_ig_prospect: [{ handle: 'pana', estado: 'contactado' }, { handle: 'pana', estado: 'volando' }],
  get_places_usage: [{}],
  get_site_stats: [{}],
  publish_free_post: [
    { texto: 'Hola', redes: ['linkedin'], dry_run: true },
    { texto: 'Hola', redes: ['facebook_instagram'], imagenes: ['https://ejemplo.com/a.png', 'https://ejemplo.com/b.png'] },
  ],
  publish_ig_story: [{ tipo: 'imagen', url: 'https://ejemplo.com/a.png', dry_run: true }, { tipo: 'texto', texto: 'Hola' }],
};

describe('servidor MCP — nada de secretos en las respuestas', () => {
  beforeAll(() => {
    Object.assign(process.env, S);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error(LEAK); }));
  });

  it('están exactamente las tools de ARGS, en snake_case', () => {
    expect(ALL_TOOLS.map(t => t.name).sort()).toEqual(Object.keys(ARGS).sort());
    for (const t of ALL_TOOLS) expect(t.name).toMatch(/^[a-z]+(_[a-z]+)*$/);
  });

  it.each(Object.keys(ARGS))('%s no devuelve secretos', async (name) => {
    const server = { tools: {}, registerTool(n, c, cb) { this.tools[n] = cb; } };
    const fake = seed();
    registerTools(server, ALL_TOOLS, { getDb: () => fake.db });
    const ctx = { http: { authInfo: { extra: { uid: 'u1', email: 'm@x.com' } } } };
    for (const args of ARGS[name]) {
      const res = await server.tools[name](args, ctx);
      const dump = JSON.stringify(res);
      for (const v of Object.values(S)) expect(dump).not.toContain(v);
      expect(dump).not.toContain('hook.us2.make.com');
    }
  });
});
