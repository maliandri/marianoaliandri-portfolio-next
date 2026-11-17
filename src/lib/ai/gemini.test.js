import { describe, it, expect, vi } from 'vitest';
import { conClaves, conRespaldo, esErrorDeKey, clavesRotadas, modelosConfigurados, MODELOS_DEFAULT } from './gemini';

describe('esErrorDeKey', () => {
  it('reconoce saturación, cuota y key inválida', () => {
    for (const statusCode of [401, 403, 429, 503]) expect(esErrorDeKey({ statusCode })).toBe(true);
    expect(esErrorDeKey(new Error('The model is overloaded'))).toBe(true);
    expect(esErrorDeKey(new Error('API key not valid'))).toBe(true);
  });
  it('no reintenta errores del pedido ni timeouts totales', () => {
    expect(esErrorDeKey({ statusCode: 400, message: 'bad request' })).toBe(false);
    expect(esErrorDeKey(Object.assign(new Error('t'), { name: 'TimeoutError' }))).toBe(false);
    expect(esErrorDeKey(new Error('tool falló'))).toBe(false);
  });
});

describe('clavesRotadas', () => {
  it('empieza donde se le indica y no pierde ninguna', () => {
    expect(clavesRotadas(['a', 'b', 'c'], 1)).toEqual(['b', 'c', 'a']);
    expect(clavesRotadas(['a', 'b', 'c'], 0)).toEqual(['a', 'b', 'c']);
  });
});

describe('conClaves', () => {
  it('pasa a la siguiente key cuando una está saturada', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate'), { statusCode: 429 }))
      .mockResolvedValueOnce('ok');
    expect(await conClaves(fn, { keys: ['k1', 'k2', 'k3'] })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('no insiste con otras keys si el error es del pedido', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { statusCode: 400 }));
    await expect(conClaves(fn, { keys: ['k1', 'k2'] })).rejects.toThrow('bad');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('si fallan todas, lo dice', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { statusCode: 503 }));
    await expect(conClaves(fn, { keys: ['k1', 'k2', 'k3', 'k4'], maxKeys: 3 })).rejects.toThrow(/Todas las Gemini API keys fallaron/);
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it('sin keys configuradas falla claro', async () => {
    await expect(conClaves(vi.fn(), { keys: [] })).rejects.toThrow(/GEMINI_API_KEY/);
  });
});

describe('modelosConfigurados', () => {
  it('usa los de por defecto y respeta AI_MODELS', () => {
    expect(modelosConfigurados('')).toEqual(MODELOS_DEFAULT);
    expect(modelosConfigurados(undefined)).toEqual(MODELOS_DEFAULT);
    expect(modelosConfigurados(' a , b ,,')).toEqual(['a', 'b']);
  });
});

describe('conRespaldo', () => {
  const keys = ['k1'];
  it('si el modelo principal está saturado, usa el de respaldo con su timeout', async () => {
    const vistos = [];
    const fn = vi.fn(async (_model, timeout) => {
      vistos.push(timeout);
      if (vistos.length === 1) throw Object.assign(new Error('high demand'), { statusCode: 503 });
      return 'ok';
    });
    const r = await conRespaldo(fn, { modelos: ['a', 'b'], timeouts: [{ stepMs: 1 }, { stepMs: 2 }], keys });
    expect(r).toBe('ok');
    expect(vistos).toEqual([{ stepMs: 1 }, { stepMs: 2 }]);
  });
  it('si el principal se cuelga (timeout) también pasa al respaldo', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), { name: 'TimeoutError' }))
      .mockResolvedValueOnce('ok');
    expect(await conRespaldo(fn, { modelos: ['a', 'b'], keys })).toBe('ok');
  });
  it('puedeReintentar=false corta sin probar otro modelo (evita repetir efectos)', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { statusCode: 503 }));
    await expect(conRespaldo(fn, { modelos: ['a', 'b'], keys, puedeReintentar: () => false })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('si fallan todos los modelos, tira el último error', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { statusCode: 503 }));
    await expect(conRespaldo(fn, { modelos: ['a', 'b'], keys })).rejects.toThrow(/Todas las Gemini API keys fallaron/);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
