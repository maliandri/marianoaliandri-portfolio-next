import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
const sendViaResend = vi.fn(async () => ({}));
vi.mock('@/lib/bizEmail', () => ({ sendViaResend: (...a) => sendViaResend(...a) }));
const prompts = [];
vi.mock('@/lib/contenidoRun', async (orig) => ({
  ...(await orig()),
  generarConRespaldo: vi.fn(async (prompt, parse) => {
    prompts.push(prompt);
    const n = Number(prompt.match(/Escribí (\d+) guion/)[1]);
    const g = (i) => ({ titulo: `Guion ${i}`, formato: 'mito', gancho: 'Gancho', tomas: [{ decir: 'a', mostrar: 'b' }, { decir: 'c', mostrar: 'd' }], cierre: 'C', caption: 'P', musica: 'Lo-fi', edicion: 'Cortes rápidos' });
    return { ...parse(JSON.stringify({ guiones: Array.from({ length: n }, (_, i) => g(i + 1)) })), proveedor: 'gemini-3.8' };
  }),
}));

import { createFakeDb } from '@/test/fakeDb';
import { generarGuiones, regenerarGuion, actualizarGuion, listarGuiones } from './guionesRun';
import { validateGuionesConfig, diaAR, parseGuiones } from './guiones';
import { validateContenidoPatch } from './contenido';
import { dispararReel, textoReel } from './reelDispatch';

const seed = () => createFakeDb({
  'contenidos/c1': { titulo: 'Qué es un MCP', estado: 'publicado', createdAtMs: 5 },
  'demanda_reportes/d1': { zona: 'Alto Valle', top: [{ label: 'Farmacia', ejemplos: ['farmacia de turno'] }], createdAtMs: 1 },
});

beforeEach(() => { prompts.length = 0; sendViaResend.mockClear(); });

describe('guiones: generar, editar, regenerar', () => {
  it('genera la cantidad pedida sobre el tema, los guarda uno por doc y solo manda mail si se pide', async () => {
    const { db } = seed();
    process.env.ADMIN_EMAIL = 'm@x.com';
    const r = await generarGuiones(db, { cantidad: 4, tema: 'Supabase vs Excel', origen: 'mcp', now: 100 });
    expect(r.guiones).toHaveLength(4);
    expect(prompts[0]).toContain('Supabase vs Excel');
    expect(prompts[0]).toContain('Qué es un MCP');
    expect(prompts[0]).toContain('Alto Valle');
    expect(sendViaResend).not.toHaveBeenCalled();
    const lista = await listarGuiones(db);
    expect(lista).toHaveLength(4);
    expect(lista[0]).toMatchObject({ estado: 'pendiente', tema: 'Supabase vs Excel', origen: 'mcp', musica: 'Lo-fi' });

    await generarGuiones(db, { cantidad: 1, mail: true });
    expect(sendViaResend.mock.calls[0][0].to).toBe('m@x.com');
  });

  it('edita texto y estado, valida, y regenerar rehace uno manteniendo el formato', async () => {
    const { db } = seed();
    const { guiones: [g] } = await generarGuiones(db, { cantidad: 1, now: 1 });
    const e = await actualizarGuion(db, g.id, { estado: 'grabado', gancho: '  Nuevo gancho ' });
    expect(e).toMatchObject({ estado: 'grabado', gancho: 'Nuevo gancho' });
    await expect(actualizarGuion(db, g.id, { estado: 'volando' })).rejects.toThrow(/estado/);
    await expect(actualizarGuion(db, g.id, { tomas: [] })).rejects.toThrow(/toma/);

    const r = await regenerarGuion(db, g.id);
    expect(r.estado).toBe('pendiente');
    expect(prompts.at(-1)).toContain('Todos con este formato');
    expect(prompts.at(-1)).toContain('Guion 1');
  });

  it('config: cantidad 1–6 y días válidos; el día se calcula en hora de Argentina', () => {
    expect(validateGuionesConfig({ cantidad: 5, dias: [4, 1, 1, 9] })).toEqual({ update: { cantidad: 5, dias: [1, 4], mail: true } });
    expect(validateGuionesConfig({ cantidad: 9 }).error).toBeTruthy();
    expect(diaAR(Date.UTC(2026, 10, 3, 2))).toBe(1); // martes 02:00 UTC = lunes 23:00 en Argentina
  });

  it('con cantidad 1 alcanza un guion; un formato desconocido cae en pantalla', () => {
    const g = { titulo: 'A', formato: 'cualquiera', gancho: 'G', tomas: [{ decir: 'a' }, { decir: 'b' }] };
    expect(parseGuiones(JSON.stringify({ guiones: [g] }), { cantidad: 1 }).guiones[0].formato).toBe('pantalla');
  });
});

describe('próxima pieza: cola y reel', () => {
  it('valida la cola de ideas', () => {
    const { update } = validateContenidoPatch({ cola: [{ tema: 'Supabase para un taller', conReel: true }] });
    expect(update.cola[0]).toMatchObject({ tema: 'Supabase para un taller', conReel: true, serieId: null });
    expect(validateContenidoPatch({ cola: [{ tema: 'x' }] }).error).toBeTruthy();
  });

  it('dispara el workflow del reel con la pieza; sin token queda para la corrida automática', async () => {
    delete process.env.GITHUB_DISPATCH_TOKEN;
    expect(await dispararReel('c1')).toEqual({ ok: false, motivo: 'sin_token' });
    expect(textoReel({ ok: false, motivo: 'sin_token' })).toMatch(/próxima corrida/);

    process.env.GITHUB_DISPATCH_TOKEN = 't';
    const fetchImpl = vi.fn(async () => ({ status: 204 }));
    expect(await dispararReel('c1', { fetchImpl })).toEqual({ ok: true });
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toContain('/actions/workflows/reel-bot.yml/dispatches');
    expect(JSON.parse(opts.body)).toEqual({ ref: 'main', inputs: { tipo: 'explicador', contenido_id: 'c1' } });
    delete process.env.GITHUB_DISPATCH_TOKEN;
  });
});
