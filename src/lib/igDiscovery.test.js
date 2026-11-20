import { describe, it, expect } from 'vitest';
import { discoverAccount, DiscoveryLimitError, DiscoveryTokenError } from './igDiscovery';

const creds = { accessToken: 'TOKEN_SECRETO', igUserId: '123' };
const respuesta = (body) => async () => ({ json: async () => body });

describe('discoverAccount', () => {
  it('devuelve los datos de una cuenta profesional', async () => {
    const r = await discoverAccount({
      creds, handle: '@Panaderia_Sur',
      fetchImpl: respuesta({ business_discovery: { name: 'Panadería Sur', biography: 'Pan', website: 'https://x.com', followers_count: 1200, media_count: 80 } }),
    });
    expect(r).toEqual({ handle: 'panaderia_sur', ok: true, nombre: 'Panadería Sur', bio: 'Pan', web: 'https://x.com', seguidores: 1200, posts: 80 });
  });

  it('marca como no disponible a una cuenta personal', async () => {
    const r = await discoverAccount({ creds, handle: 'juan', fetchImpl: respuesta({ error: { code: 110, message: 'Invalid user id' } }) });
    expect(r).toEqual({ handle: 'juan', ok: false, motivo: 'personal o no disponible' });
  });

  it('corta ante el límite de uso y ante un token vencido', async () => {
    await expect(discoverAccount({ creds, handle: 'a', fetchImpl: respuesta({ error: { code: 4 } }) })).rejects.toBeInstanceOf(DiscoveryLimitError);
    await expect(discoverAccount({ creds, handle: 'a', fetchImpl: respuesta({ error: { code: 190 } }) })).rejects.toBeInstanceOf(DiscoveryTokenError);
  });

  it('no consulta usuarios con caracteres que no existen en Instagram', async () => {
    let llamadas = 0;
    const r = await discoverAccount({ creds, handle: 'x){id}', fetchImpl: async () => { llamadas++; return { json: async () => ({}) }; } });
    expect(r.ok).toBe(false);
    expect(llamadas).toBe(0);
  });

  it('no filtra el token en lo que devuelve', async () => {
    const r = await discoverAccount({ creds, handle: 'a', fetchImpl: respuesta({ error: { code: 999, message: 'TOKEN_SECRETO' } }) });
    expect(JSON.stringify(r)).not.toContain('TOKEN_SECRETO');
  });
});
