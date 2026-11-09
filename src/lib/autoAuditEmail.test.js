import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));
vi.mock('@/lib/bizEmail', () => ({
  buildBizEmailDraft: vi.fn(),
  renderBizEmailHtml: vi.fn(() => '<html/>'),
  sendViaResend: vi.fn(async () => ({ resendId: 'r1' })),
  validateGeneratedEmail: vi.fn(() => true),
}));
vi.mock('@/lib/emailGuards', () => ({
  checkBlocked: vi.fn(async () => null),
  normalizeDomain: (u) => String(u).replace(/^https?:\/\//, ''),
  reserveSend: vi.fn(),
  unsubscribeUrl: () => 'https://x/baja',
}));

import { enviarMailsAuditoria } from '@/lib/autoAuditEmail';
import { buildBizEmailDraft, sendViaResend, validateGeneratedEmail } from '@/lib/bizEmail';
import { checkBlocked, reserveSend } from '@/lib/emailGuards';

const combo = { ciudad: 'Neuquén', rubro: { label: 'Durlock' } };
const results = [
  { id: 'a', nombre: 'A', siteUrl: 'https://a.com', email: 'a@a.com', seoScore: 30 },
  { id: 'b', nombre: 'B', siteUrl: 'https://b.com', email: null, seoScore: 50 },
  { id: 'c', nombre: 'C', siteUrl: 'https://c.com', email: 'c@c.com', seoScore: 40 },
];

function fakeDb(sentStatuses = []) {
  const added = [];
  return {
    added,
    collection: () => ({
      where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs: sentStatuses.map(s => ({ data: () => ({ status: s }) })) }) }) }) }),
      add: async (d) => { added.push(d); },
    }),
  };
}

const configRef = () => ({ set: vi.fn(async () => {}) });

beforeEach(() => {
  vi.clearAllMocks();
  buildBizEmailDraft.mockResolvedValue({ subject: 's', emailText: 'texto', source: 'gemini', screenshotUrl: null, extraServices: [] });
  reserveSend.mockResolvedValue({ ok: true, release: vi.fn() });
  validateGeneratedEmail.mockReturnValue(true);
  checkBlocked.mockResolvedValue(null);
});

describe('enviarMailsAuditoria', () => {
  it('no hace nada si emailAuto está apagado', async () => {
    const out = await enviarMailsAuditoria(fakeDb(), { combo, results, auditoriaId: 'x', config: { emailAuto: false }, configRef: configRef() });
    expect(out.enviados).toBe(0);
    expect(sendViaResend).not.toHaveBeenCalled();
  });

  it('manda a los que tienen email, registra origen auto y avisa', async () => {
    const db = fakeDb();
    const out = await enviarMailsAuditoria(db, { combo, results, auditoriaId: 'x', config: { emailAuto: true, emailTope: 10 }, configRef: configRef() });
    expect(out.enviados).toBe(2);
    expect(db.added.map(d => d.origen)).toEqual(['auto', 'auto']);
    expect(sendViaResend).toHaveBeenCalledTimes(3); // 2 negocios + resumen
  });

  it('no escribe a los que tienen 70 o más de SEO', async () => {
    const altos = [
      { id: 'x', nombre: 'X', siteUrl: 'https://x.com', email: 'x@x.com', seoScore: 100 },
      { id: 'y', nombre: 'Y', siteUrl: 'https://y.com', email: 'y@y.com', seoScore: 70 },
      { id: 'z', nombre: 'Z', siteUrl: 'https://z.com', email: 'z@z.com', seoScore: 69 },
    ];
    const out = await enviarMailsAuditoria(fakeDb(), { combo, results: altos, auditoriaId: 'x', config: { emailAuto: true }, configRef: configRef() });
    expect(out.enviados).toBe(1);
    expect(out.omitidos.seo_alto).toBe(2);
  });

  it('respeta la lista de bajas y rebotes', async () => {
    checkBlocked.mockResolvedValueOnce('baja');
    const out = await enviarMailsAuditoria(fakeDb(), { combo, results, auditoriaId: 'x', config: { emailAuto: true }, configRef: configRef() });
    expect(out.enviados).toBe(1);
    expect(out.omitidos.baja).toBe(1);
  });

  it('no manda un texto que no pasa la validación', async () => {
    validateGeneratedEmail.mockReturnValue(false);
    const out = await enviarMailsAuditoria(fakeDb(), { combo, results, auditoriaId: 'x', config: { emailAuto: true }, configRef: configRef() });
    expect(out.enviados).toBe(0);
    expect(out.omitidos.texto_invalido).toBe(2);
  });

  it('corta al llegar al tope diario', async () => {
    reserveSend.mockResolvedValueOnce({ ok: true, release: vi.fn() }).mockResolvedValueOnce({ ok: false, motivo: 'tope_diario' });
    const out = await enviarMailsAuditoria(fakeDb(), { combo, results, auditoriaId: 'x', config: { emailAuto: true, emailTope: 1 }, configRef: configRef() });
    expect(out.enviados).toBe(1);
    expect(out.omitidos.tope_diario).toBe(1);
  });

  it('se pausa y apaga emailAuto si hay rebotes recientes', async () => {
    const ref = configRef();
    const out = await enviarMailsAuditoria(fakeDb(['sent', 'bounced', 'complained']), { combo, results, auditoriaId: 'x', config: { emailAuto: true }, configRef: ref });
    expect(out.pausado).toBe(true);
    expect(out.enviados).toBe(0);
    expect(ref.set).toHaveBeenCalledWith({ emailAuto: false }, { merge: true });
  });

  it('un error de envío libera la reserva y sigue con el próximo', async () => {
    const release = vi.fn();
    reserveSend.mockResolvedValueOnce({ ok: true, release });
    sendViaResend.mockRejectedValueOnce(new Error('resend caído'));
    const out = await enviarMailsAuditoria(fakeDb(), { combo, results, auditoriaId: 'x', config: { emailAuto: true }, configRef: configRef() });
    expect(release).toHaveBeenCalled();
    expect(out.enviados).toBe(1);
    expect(out.omitidos.error_envio).toBe(1);
  });
});
