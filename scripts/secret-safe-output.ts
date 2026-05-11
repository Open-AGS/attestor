import { createHash } from 'node:crypto';

const SENSITIVE_OUTPUT_PATTERNS: readonly {
  readonly pattern: RegExp;
  readonly replacement: string | ((match: string, ...groups: string[]) => string);
}[] = Object.freeze([
  {
    pattern: /\b([rs]k)_(live|test)_[A-Za-z0-9_]+\b/gu,
    replacement: (_match, keyKind, mode) => `${keyKind}_${mode}_[redacted]`,
  },
  {
    pattern: /\bwhsec_[A-Za-z0-9_]+\b/gu,
    replacement: 'whsec_[redacted]',
  },
  {
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gu,
    replacement: 'Bearer [redacted]',
  },
  {
    pattern: /\b(postgres(?:ql)?:\/\/[^:\s/@]+):[^@\s/]+@/giu,
    replacement: '$1:[redacted]@',
  },
  {
    pattern: /\b(redis:\/\/):[^@\s/]+@/giu,
    replacement: '$1[redacted]@',
  },
  {
    pattern: /\b(cus|sub|cs|bps|evt|we|acct)_[A-Za-z0-9_]+\b/gu,
    replacement: (_match, prefix) => `${prefix}_[redacted]`,
  },
]);

export function redactSensitiveOutput(value: string): string {
  return SENSITIVE_OUTPUT_PATTERNS.reduce(
    (current, entry) => current.replace(entry.pattern, entry.replacement as never),
    value,
  );
}

export function digestReference(kind: string, value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  const digest = createHash('sha256')
    .update(`attestor:${kind}\0${normalized}`, 'utf8')
    .digest('hex')
    .slice(0, 24);
  return `${kind}:${digest}`;
}

export function sanitizeForOperatorOutput(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitiveOutput(value);
  if (Array.isArray(value)) return value.map((entry) => sanitizeForOperatorOutput(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sanitizeForOperatorOutput(entry),
      ]),
    );
  }
  return value;
}

export function stringifySecretSafe(value: unknown): string {
  return JSON.stringify(sanitizeForOperatorOutput(value), null, 2);
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return redactSensitiveOutput(error.stack ?? error.message);
  }
  return redactSensitiveOutput(String(error));
}
