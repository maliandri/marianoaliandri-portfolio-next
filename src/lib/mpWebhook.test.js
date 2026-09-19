import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { verifyMpSignature } from './mpWebhook.js';

const SECRET = 'test-webhook-secret';

function signedRequest({ dataId = 'abc123', ts = '1700000000', requestId = 'req-1', secret = SECRET, badHash = false }) {
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const hash = badHash
    ? '0'.repeat(64)
    : crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return new Request(`https://marianoaliandri.com.ar/api/subscription-webhook/?data.id=${dataId}`, {
    method: 'POST',
    headers: {
      'x-signature': `ts=${ts},v1=${hash}`,
      'x-request-id': requestId,
    },
  });
}

describe('verifyMpSignature', () => {
  const originalSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = originalSecret;
  });

  it('accepts a correctly signed webhook', () => {
    const req = signedRequest({});
    expect(verifyMpSignature(req, {})).toBe(true);
  });

  it('rejects a webhook with a tampered hash', () => {
    const req = signedRequest({ badHash: true });
    expect(verifyMpSignature(req, {})).toBe(false);
  });

  it('rejects a webhook signed with the wrong secret', () => {
    const req = signedRequest({ secret: 'someone-elses-secret' });
    expect(verifyMpSignature(req, {})).toBe(false);
  });

  it('rejects a malformed x-signature header missing ts/v1', () => {
    const req = new Request('https://marianoaliandri.com.ar/api/subscription-webhook/?data.id=abc123', {
      method: 'POST',
      headers: { 'x-signature': 'garbage', 'x-request-id': 'req-1' },
    });
    expect(verifyMpSignature(req, {})).toBe(false);
  });

  it('passes through (returns true) when MP sends no signature headers at all', () => {
    const req = new Request('https://marianoaliandri.com.ar/api/subscription-webhook/', { method: 'POST' });
    expect(verifyMpSignature(req, {})).toBe(true);
  });

  it('passes through (returns true) when MERCADOPAGO_WEBHOOK_SECRET is not configured', () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const req = signedRequest({});
    expect(verifyMpSignature(req, {})).toBe(true);
  });
});
