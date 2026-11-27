import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/firebase-admin', () => ({ getDb: () => null }));
import { createFakeDb } from '@/test/fakeDb';
import { adminUrl, avisar, avisarUnaVez, botonWhatsapp, buscarMensaje } from './avisos';

describe('avisos a Telegram', () => {
  it('arma el link a la pantalla del admin', () => {
    expect(adminUrl('presupuestos', 'solicitudes')).toBe('https://marianoaliandri.com.ar/admin/?tab=presupuestos&sub=solicitudes');
    expect(adminUrl('inicio')).toBe('https://marianoaliandri.com.ar/admin/');
  });

  it('suma el botón del admin abajo de los botones propios y recuerda el mensaje si hay ref', async () => {
    const { db } = createFakeDb();
    const send = vi.fn(async () => ({ ok: true, messageId: 77 }));
    await avisar({ texto: 'hola', tab: 'emails', botones: [{ texto: 'A', data: 'x:1' }], ref: { tipo: 'chat', id: 'tienda_abcdefgh' }, db, send });
    const { filas } = send.mock.calls[0][0];
    expect(filas[0]).toEqual([{ texto: 'A', data: 'x:1' }]);
    expect(filas[1][0].url).toBe('https://marianoaliandri.com.ar/admin/?tab=emails');
    expect(await buscarMensaje(db, 77)).toMatchObject({ tipo: 'chat', id: 'tienda_abcdefgh' });
  });

  it('avisarUnaVez no repite la misma clave', async () => {
    const { db } = createFakeDb();
    const send = vi.fn(async () => ({ ok: true, messageId: 1 }));
    await avisarUnaVez('pago:9', { texto: 'pago', send }, { db });
    const r = await avisarUnaVez('pago:9', { texto: 'pago', send }, { db });
    expect(send).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ ok: false, error: 'repetido' });
  });

  it('nunca tira aunque falle el envío', async () => {
    const send = vi.fn(async () => { throw new Error('caído'); });
    await expect(avisar({ texto: 'x', send })).resolves.toMatchObject({ ok: false });
  });

  it('botón de WhatsApp: celular argentino sin código → +54 9', () => {
    expect(botonWhatsapp('299 541-4422').url).toBe('https://wa.me/5492995414422');
    expect(botonWhatsapp('+54 9 299 541 4422').url).toBe('https://wa.me/5492995414422');
    expect(botonWhatsapp('54 299 541 4422').url).toBe('https://wa.me/5492995414422');
    expect(botonWhatsapp('123')).toBeNull();
    expect(botonWhatsapp(undefined)).toBeNull();
  });
});
