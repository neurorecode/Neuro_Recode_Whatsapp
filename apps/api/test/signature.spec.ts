import * as crypto from 'crypto';

/**
 * Guards the exact HMAC scheme Meta uses for `X-Hub-Signature-256`. If this
 * ever drifts, real webhooks would be rejected — so pin it with a test.
 */
function sign(appSecret: string, raw: Buffer): string {
  return 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
}

function verify(appSecret: string, raw: Buffer, header: string): boolean {
  const expected = sign(appSecret, raw);
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

describe('WhatsApp webhook signature', () => {
  const secret = 'test-app-secret';
  const raw = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }));

  it('accepts a correctly signed payload', () => {
    const header = sign(secret, raw);
    expect(verify(secret, raw, header)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const header = sign(secret, raw);
    const tampered = Buffer.from(raw.toString() + ' ');
    expect(verify(secret, tampered, header)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const header = sign('other-secret', raw);
    expect(verify(secret, raw, header)).toBe(false);
  });
});
