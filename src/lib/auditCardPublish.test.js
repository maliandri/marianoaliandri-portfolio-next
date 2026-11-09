import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/cloudinaryServer', () => ({ uploadPng: vi.fn(async () => 'https://res.cloudinary.com/x/image/upload/v1/auditorias/abc123/card.png') }));
vi.mock('@/lib/imageCheck', () => ({ imageIsReachable: vi.fn(async () => ({ ok: true, detail: '' })) }));

import { uploadPng } from '@/lib/cloudinaryServer';
import { imageIsReachable } from '@/lib/imageCheck';
import { auditIdFromReportUrl, cardDataFromAudit, uploadAuditCard, withAuditCard } from './auditCardPublish.js';

const AUDIT = {
  config: { tiposLabels: ['Constructoras'], ciudades: ['Comodoro Rivadavia', 'Rada Tilly'] },
  results: [{ id: 'a', seoScore: 30 }, { id: 'b', seoScore: 80 }],
  stats: { total: 2, avgSeoScore: 55, lowSeoCount: 1 },
};
const dbCon = (data) => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: data !== undefined, data: () => data }) }) }) });

beforeEach(() => { vi.clearAllMocks(); imageIsReachable.mockResolvedValue({ ok: true, detail: '' }); });

describe('auditCardPublish', () => {
  it('saca el id del link del informe', () => {
    expect(auditIdFromReportUrl('https://marianoaliandri.com.ar/auditorias/abc123')).toBe('abc123');
    expect(auditIdFromReportUrl('https://marianoaliandri.com.ar/auditorias/abc123/?x=1')).toBe('abc123');
    expect(auditIdFromReportUrl('https://marianoaliandri.com.ar/tienda')).toBeNull();
  });

  it('arma los datos de la tarjeta desde la auditoría guardada', () => {
    expect(cardDataFromAudit(AUDIT)).toMatchObject({ rubro: 'Constructoras', ciudad: 'Comodoro Rivadavia · Rada Tilly', stats: { total: 2 } });
    expect(cardDataFromAudit({ config: { tiposLabels: ['A', 'B'] }, results: [] }).rubro).toBe('A, B');
    expect(cardDataFromAudit({ results: [{ seoScore: 10 }] }).rubro).toBe('negocios');
  });

  it('dibuja, sube y devuelve la URL', async () => {
    const url = await uploadAuditCard(dbCon(AUDIT), 'abc123');
    expect(url).toContain('res.cloudinary.com');
    expect(uploadPng.mock.calls[0][1]).toBe('auditorias/abc123');
  });

  it('si la subida o la imagen fallan, tira error (no se publica)', async () => {
    uploadPng.mockRejectedValueOnce(new Error('Cloudinary 500'));
    await expect(uploadAuditCard(dbCon(AUDIT), 'abc123')).rejects.toThrow(/No se pudo armar la imagen/);
    imageIsReachable.mockResolvedValueOnce({ ok: false, detail: 'HTTP 404' });
    await expect(uploadAuditCard(dbCon(AUDIT), 'abc123')).rejects.toThrow(/404/);
    await expect(uploadAuditCard(dbCon(undefined), 'abc123')).rejects.toThrow(/No existe/);
  });

  it('withAuditCard cambia la imagen solo en payloads de auditoría', async () => {
    const payload = { text: 'x', imageUrl: 'micro', url: 'micro', reportUrl: 'https://marianoaliandri.com.ar/auditorias/abc123', metadata: { topic: 'auditoria' } };
    const out = await withAuditCard(dbCon(AUDIT), payload);
    expect(out.imageUrl).toContain('res.cloudinary.com');
    expect(out.url).toBe(out.imageUrl);
    expect(out.reportUrl).toBe(payload.reportUrl);
    const otro = { text: 'y', imageUrl: 'z', metadata: { topic: 'producto' } };
    expect(await withAuditCard(dbCon(AUDIT), otro)).toBe(otro);
  });
});
