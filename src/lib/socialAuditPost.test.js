import { describe, it, expect } from 'vitest';
import { auditReportUrl, auditScreenshotUrl, buildAuditPublishPayload } from './socialAuditPost.js';

const SHOT = 'https://api.microlink.io/?url=https%3A%2F%2Fmarianoaliandri.com.ar%2Fauditorias%2Fabc123%3Fscreenshot%3D1&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1280&viewport.height=980';

describe('socialAuditPost', () => {
  it('auditReportUrl y auditScreenshotUrl', () => {
    expect(auditReportUrl('abc123')).toBe('https://marianoaliandri.com.ar/auditorias/abc123');
    expect(auditScreenshotUrl('abc123')).toBe(SHOT);
  });

  it('fija el payload completo del contrato probado', () => {
    const networks = ['linkedin', 'facebook'];
    const payload = buildAuditPublishPayload({ caption: 'Hola\n\nmundo', networks, auditoriaId: 'abc123' });
    expect(payload).toEqual({
      text: 'Hola\n\nmundo',
      content: 'Hola\n\nmundo',
      caption: 'Hola\n\nmundo',
      description: 'Hola\n\nmundo',
      message: 'Hola\n\nmundo',
      networks: ['linkedin', 'facebook'],
      type: 'service',
      useAI: false,
      aiProvider: 'gemini',
      imageUrl: SHOT,
      url: SHOT,
      link: 'https://marianoaliandri.com.ar/auditorias/abc123',
      reportUrl: 'https://marianoaliandri.com.ar/auditorias/abc123',
      metadata: {
        topic: 'auditoria',
        reportUrl: 'https://marianoaliandri.com.ar/auditorias/abc123',
        link: 'https://marianoaliandri.com.ar/auditorias/abc123',
      },
    });
    expect(payload.url).toBe(payload.imageUrl);
    expect(payload.link).toBe(payload.reportUrl);
    expect(payload.type).toBe('service');
    expect(payload.useAI).toBe(false);
    expect(Array.isArray(payload.networks)).toBe(true);
    expect(networks).toEqual(['linkedin', 'facebook']);
  });

  it('el body es idéntico al que armaba el botón "Publicar en redes" (copia literal del código viejo)', () => {
    const pubCaption = 'Caption de prueba';
    const networks = ['instagram', 'facebook', 'linkedin'];
    const id = 'zzz999';
    const reportUrl = `https://marianoaliandri.com.ar/auditorias/${id}`;
    const screenshotUrl = `${reportUrl}?screenshot=1`;
    const imageUrl = `https://api.microlink.io/?url=${encodeURIComponent(screenshotUrl)}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1280&viewport.height=980`;
    const old = {
      text: pubCaption, content: pubCaption, caption: pubCaption, description: pubCaption, message: pubCaption,
      networks, type: 'service', useAI: false, aiProvider: 'gemini',
      imageUrl, url: imageUrl, link: reportUrl, reportUrl,
      metadata: { topic: 'auditoria', reportUrl, link: reportUrl },
    };
    const next = buildAuditPublishPayload({ caption: pubCaption, networks, auditoriaId: id });
    expect(JSON.stringify(next)).toBe(JSON.stringify(old));
  });
});
