import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/firebase-admin', () => ({ getDb: () => null }));
vi.mock('@/lib/bizEmail', () => ({ sendViaResend: vi.fn() }));
import { createFakeDb } from '@/test/fakeDb';
import { sendAlert, ALERT_INTERVAL_MS } from './alert';

describe('sendAlert', () => {
  beforeEach(() => { process.env.ADMIN_EMAIL = 'yo@test.com'; delete process.env.ALERT_EMAIL; });

  it('manda una vez por hora por clave y cuenta las repeticiones en el próximo mail', async () => {
    const db = createFakeDb().db;
    const send = vi.fn(async () => {});
    const t0 = 1_000_000;
    expect(await sendAlert({ key: 'k', titulo: 'Falló', detalle: 'x' }, { db, send, now: t0 })).toEqual({ sent: true });
    expect(await sendAlert({ key: 'k', titulo: 'Falló', detalle: 'x' }, { db, send, now: t0 + 1000 })).toMatchObject({ sent: false });
    expect(await sendAlert({ key: 'k', titulo: 'Falló', detalle: 'x' }, { db, send, now: t0 + 2000 })).toMatchObject({ sent: false });
    expect(await sendAlert({ key: 'otra', titulo: 'Otra' }, { db, send, now: t0 + 3000 })).toEqual({ sent: true });
    await sendAlert({ key: 'k', titulo: 'Falló', detalle: 'x' }, { db, send, now: t0 + ALERT_INTERVAL_MS + 1 });
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[2][0].html).toContain('Se repitió 2 veces');
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'yo@test.com', subject: '[Alerta sitio] Falló' });
  });

  it('tacha secretos y escapa HTML', async () => {
    process.env.SOME_API_KEY = 'super-secreto-123456';
    const send = vi.fn(async () => {});
    await sendAlert({ key: 'k', titulo: 'Error', detalle: 'token super-secreto-123456 <script>' }, { db: createFakeDb().db, send, now: 1 });
    const { html } = send.mock.calls[0][0];
    expect(html).not.toContain('super-secreto-123456');
    expect(html).toContain('&lt;script&gt;');
    delete process.env.SOME_API_KEY;
  });

  it('nunca tira, aunque falle el envío', async () => {
    const send = vi.fn(async () => { throw new Error('resend caído'); });
    await expect(sendAlert({ key: 'k', titulo: 'x' }, { db: createFakeDb().db, send, now: 1 })).resolves.toMatchObject({ sent: false });
  });

  it('sin destinatario no hace nada', async () => {
    delete process.env.ADMIN_EMAIL;
    const send = vi.fn();
    expect(await sendAlert({ key: 'k', titulo: 'x' }, { db: createFakeDb().db, send })).toMatchObject({ sent: false });
    expect(send).not.toHaveBeenCalled();
  });
});
