// src/app/api/lead-finder/route.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: () => null })); // sin caché ni contador
vi.mock('@/lib/authServer', () => ({ getUserFromRequest: vi.fn() }));

import { runLeadFinderAction } from './route.js';

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const detalle = (over) => ({ json: async () => ({ id: 'p1', ...over }) });

describe('auditPlace', () => {
  it('pide internationalPhoneNumber y lo devuelve', async () => {
    fetchMock.mockResolvedValueOnce(detalle({ internationalPhoneNumber: '+54 9 299 541-4422', nationalPhoneNumber: '0299 15-541-4422' }));
    const data = await (await runLeadFinderAction('auditPlace', { placeId: 'p1' }, 'k')).json();
    expect(fetchMock.mock.calls[0][1].headers['X-Goog-FieldMask']).toContain('internationalPhoneNumber');
    expect(data).toMatchObject({ ok: true, hasWebsite: false, internationalPhone: '+54 9 299 541-4422', phone: '0299 15-541-4422', socialUrl: null });
  });

  it('una red social cargada como web no cuenta como sitio, pero se guarda como socialUrl', async () => {
    fetchMock.mockResolvedValueOnce(detalle({ websiteUri: 'https://www.instagram.com/negocio' }));
    const data = await (await runLeadFinderAction('auditPlace', { placeId: 'p1' }, 'k')).json();
    expect(data).toMatchObject({ hasWebsite: false, siteUrl: null, socialUrl: 'https://www.instagram.com/negocio', internationalPhone: null });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no intenta auditar el sitio
  });
});
