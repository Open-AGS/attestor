import { createHash } from 'node:crypto';

const SENSITIVE_OUTPUT_PATTERNS: readonly {
  readonly pattern: RegExp;
  readonly replacement: string | ((match: string, ...groups: string[]) => string);
}[] = Object.freeze([
  {
    pattern: /-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----[\s\S]*?-----END \1-----/gu,
    replacement: (_match, label) => `-----BEGIN ${label}-----\n[redacted]\n-----END ${label}-----`,
  },
  {
    pattern: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/gu,
    replacement: (_match, prefix) => `${prefix}[redacted]`,
  },
  {
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/gu,
    replacement: 'AIza[redacted]',
  },
  {
    pattern: /\bya29\.[0-9A-Za-z._-]+\b/gu,
    replacement: 'ya29.[redacted]',
  },
  {
    pattern: /\bgithub_pat_[0-9A-Za-z_]{20,}\b/gu,
    replacement: 'github_pat_[redacted]',
  },
  {
    pattern: /\bgh[pousr]_[0-9A-Za-z_]{20,}\b/gu,
    replacement: (_match) => `${_match.slice(0, 4)}[redacted]`,
  },
  {
    pattern: /\bsk-ant-api\d{2}-[0-9A-Za-z_-]{16,}\b/gu,
    replacement: 'sk-ant-api[redacted]',
  },
  {
    pattern: /\bsk-(?:proj-)?[0-9A-Za-z_-]{20,}\b/gu,
    replacement: 'sk-[redacted]',
  },
  {
    pattern: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/gu,
    replacement: (_match) => `${_match.slice(0, 5)}[redacted]`,
  },
  {
    pattern: /\beyJ[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}\b/gu,
    replacement: 'jwt.[redacted]',
  },
  {
    pattern: /\b([rs]k)_(live|test)_[A-Za-z0-9_]+\b/gu,
    replacement: (_match, keyKind, mode) => `${keyKind}_${mode}_[redacted]`,
  },
  {
    pattern: /\bwhsec_[A-Za-z0-9_]+\b/gu,
    replacement: 'whsec_[redacted]',
  },
  {
    pattern: /\b((?:Authorization|Proxy-Authorization)\s*[:=]\s*)Bearer\s+[A-Za-z0-9._~+/=-]+\b/giu,
    replacement: '$1Bearer [redacted]',
  },
  {
    pattern: /\bBearer\s+(?=[A-Za-z0-9._~+/=-]{16,}\b)(?=[A-Za-z0-9._~+/=-]*[._~+/=-])[A-Za-z0-9._~+/=-]+\b/gu,
    replacement: 'Bearer [redacted]',
  },
  {
    pattern: /\b(secret=)[^\s&"']+/giu,
    replacement: '$1[redacted]',
  },
  {
    pattern: /\b(release-token=)[^\s&"']+/giu,
    replacement: '$1[redacted]',
  },
  {
    pattern: /\b(attestor-release-token\s*[:=]\s*)[A-Za-z0-9._~+/=-]+\b/giu,
    replacement: '$1[redacted]',
  },
  {
    pattern: /\b(private[_-]?key\s*[:=]\s*)[^\s,"'}]+/giu,
    replacement: '$1[redacted]',
  },
  {
    pattern: /\b(jwt[.:=]\s*)[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}\b/giu,
    replacement: '$1[redacted]',
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
