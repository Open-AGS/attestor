import { hkdfSync, scryptSync } from 'node:crypto';

function contextLabel(context: string): string {
  if (!/^[a-z0-9_.:-]+$/u.test(context)) {
    throw new Error('Secret derivation context must be a stable internal label.');
  }
  return `attestor:${context}`;
}

export function deriveServiceKey(rawSecret: string, context: string, length = 32): Buffer {
  const secret = rawSecret.trim();
  if (!secret) {
    throw new Error('Cannot derive service key from an empty secret.');
  }
  const label = contextLabel(context);
  return Buffer.from(hkdfSync(
    'sha256',
    Buffer.from(secret, 'utf8'),
    Buffer.from(`${label}:salt`, 'utf8'),
    Buffer.from(`${label}:key`, 'utf8'),
    length,
  ));
}

export function digestSecretForComparison(secret: string, context: string): Buffer {
  return scryptSync(
    secret,
    `${contextLabel(context)}:secret-digest`,
    32,
    {
      N: 2 ** 17,
      r: 8,
      p: 1,
      maxmem: 256 * 1024 * 1024,
    },
  );
}

export function hashSecretForLookup(secret: string, context: string): string {
  return `scrypt-sha256:${digestSecretForComparison(secret, `${context}.lookup`).toString('hex')}`;
}
