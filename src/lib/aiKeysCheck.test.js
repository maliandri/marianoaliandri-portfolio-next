import { describe, it, expect } from 'vitest';
import { listarClaves, clasificar, comprobarClaves } from './aiKeysCheck';

const env = {
  GEMINI_API_KEY: 'AIzaCOMPARTIDA1111',
  GEMINI_API_KEY_2: 'AIzaSATELITE2222',
  GEMINI_API_KEY_1: 'AIzaSATELITE1111',
  GEMINI_API_KEY_3: '',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'AIzaCOMPARTIDA1111',
  GROQ_API_KEY: 'gsk_groq9999',
  OTRA: 'x',
  AI_MODELS: 'm-a,m-b',
};

describe('listarClaves', () => {
  it('ordena como geminiClient, ignora vacías y marca duplicadas', () => {
    const c = listarClaves(env);
    expect(c.map(x => x.nombre)).toEqual(['GEMINI_API_KEY_1', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY', 'NEXT_PUBLIC_FIREBASE_API_KEY', 'GROQ_API_KEY']);
    expect(c.find(x => x.nombre === 'NEXT_PUBLIC_FIREBASE_API_KEY').duplicadaDe).toBe('GEMINI_API_KEY');
    expect(c[0].final).toBe('1111');
  });
});

describe('clasificar', () => {
  it.each([
    [200, '', 'ok'], [429, '', 'cuota'], [503, '', 'saturado'], [400, 'API key not valid', 'invalida'],
    [403, 'API key was blocked', 'bloqueada'], [404, 'model not found', 'modelo_no_disponible'], [400, 'otra cosa', 'error'],
  ])('%s %s → %s', (s, m, e) => expect(clasificar(s, m)).toBe(e));
});

describe('comprobarClaves', () => {
  it('prueba cada clave contra cada modelo, sin repetir duplicadas y sin devolver la clave', async () => {
    const llamadas = [];
    const fetchImpl = async (url) => {
      llamadas.push(url);
      if (url.includes('groq')) return new Response(JSON.stringify({ data: [] }), { status: 200 });
      if (url.includes('SATELITE2222')) return new Response(JSON.stringify({ error: { message: 'Resource exhausted' } }), { status: 429 });
      return new Response(JSON.stringify({ candidates: [] }), { status: 200 });
    };
    const r = await comprobarClaves({ env, fetchImpl, now: () => 0 });
    expect(r.modelos).toEqual(['m-a', 'm-b']);
    expect(llamadas).toHaveLength(3 * 2 + 1); // 3 Gemini distintas × 2 modelos + Groq
    const k2 = r.claves.find(c => c.nombre === 'GEMINI_API_KEY_2');
    expect(k2.pruebas.map(p => p.estado)).toEqual(['cuota', 'cuota']);
    expect(r.resumen).toEqual({ total: 5, andan: 3, sinNinguna: 1, duplicadas: 1 });
    expect(JSON.stringify(r)).not.toMatch(/AIza|gsk_/);
  });

  it('una clave colgada queda como colgada', async () => {
    const fetchImpl = async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; };
    const r = await comprobarClaves({ env: { GEMINI_API_KEY_1: 'k', AI_MODELS: 'm' }, fetchImpl, now: () => 0 });
    expect(r.claves[0].pruebas[0].estado).toBe('colgada');
  });
});
