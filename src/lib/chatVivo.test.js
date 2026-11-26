import { describe, it, expect, vi } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
import { createFakeDb } from '@/test/fakeDb';
import { registrarMensaje, leerChat, mensajesDesde, cambiarEstado, listarChats, avisarChat, idValido, linkAdminChat } from './chatVivo';

const ID = 'tienda_abcdefgh123';

describe('chatVivo', () => {
  it('valida ids y arma el link del admin', () => {
    expect(idValido(ID)).toBe(true);
    expect(idValido('../x')).toBe(false);
    expect(idValido('tienda_corto')).toBe(false);
    expect(linkAdminChat(ID)).toBe('https://marianoaliandri.com.ar/admin/chat/tienda_abcdefgh123/');
  });

  it('crea el chat con el primer mensaje y guarda los siguientes en orden', async () => {
    const { db } = createFakeDb();
    const r1 = await registrarMensaje(db, ID, { rol: 'cliente', texto: 'hola' }, { origen: 'tienda', titulo: 'Visita' }, { now: 10 });
    expect(r1).toEqual({ estado: 'ia', nuevo: true });
    const r2 = await registrarMensaje(db, ID, { rol: 'asistente', texto: 'qué tal' }, { origen: 'otro' }, { now: 20 });
    expect(r2.nuevo).toBe(false);
    const chat = await leerChat(db, ID);
    expect(chat).toMatchObject({ origen: 'tienda', titulo: 'Visita', estado: 'ia', ultimoCliente: 'hola', mensajes: 2 });
    expect((await mensajesDesde(db, ID, 0)).map(m => m.texto)).toEqual(['hola', 'qué tal']);
    expect((await mensajesDesde(db, ID, 10)).map(m => m.texto)).toEqual(['qué tal']);
  });

  it('cuando Mariano toma el control el estado pasa a humano y se filtra por rol', async () => {
    const { db } = createFakeDb();
    await registrarMensaje(db, ID, { rol: 'cliente', texto: 'hola' }, {}, { now: 10 });
    await cambiarEstado(db, ID, 'humano', { now: 11 });
    await registrarMensaje(db, ID, { rol: 'mariano', texto: 'soy Mariano' }, {}, { now: 12 });
    const r = await registrarMensaje(db, ID, { rol: 'cliente', texto: 'genial' }, {}, { now: 13 });
    expect(r.estado).toBe('humano');
    expect((await mensajesDesde(db, ID, 0, { soloRol: 'mariano' })).map(m => m.texto)).toEqual(['soy Mariano']);
    await expect(cambiarEstado(db, ID, 'cualquiera')).rejects.toThrow();
    expect((await listarChats(db))[0]).toMatchObject({ id: ID, estado: 'humano', mensajes: 3 });
  });

  it('rechaza ids inválidos', async () => {
    const { db } = createFakeDb();
    await expect(registrarMensaje(db, 'malo', { rol: 'cliente', texto: 'x' })).rejects.toThrow();
    expect(await leerChat(db, 'malo')).toBeNull();
  });

  it('el aviso lleva el botón para entrar al chat y nunca tira', async () => {
    const send = vi.fn(async () => { throw new Error('caído'); });
    await avisarChat({ id: ID, texto: 'hola', send });
    expect(send.mock.calls[0][0].botones[0]).toEqual({ texto: '💬 Entrar al chat', url: linkAdminChat(ID) });
  });
});
