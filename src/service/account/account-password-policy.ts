export interface AccountPasswordPolicyContext {
  readonly accountName?: string | null;
  readonly displayName?: string | null;
  readonly email?: string | null;
}

export interface AccountPasswordPolicyResult {
  readonly ok: boolean;
  readonly message: string | null;
}

export const ACCOUNT_PASSWORD_MIN_LENGTH = 12;

const COMMON_PASSWORD_BLOCKLIST = new Set([
  '123456789012',
  'adminpassword',
  'attestorpassword',
  'changeme1234',
  'letmein12345',
  'password1234',
  'password12345',
  'qwerty123456',
  'welcome12345',
]);

function normalizedSecret(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/gu, '');
}

function contextTerms(context: AccountPasswordPolicyContext): string[] {
  return [
    context.email?.split('@')[0],
    context.accountName,
    context.displayName,
  ]
    .flatMap((value) => value?.split(/[^a-z0-9]+/iu) ?? [])
    .map((value) => normalizedSecret(value))
    .filter((value) => value.length >= 4);
}

export function validateAccountPassword(
  password: string,
  fieldName = 'password',
  context: AccountPasswordPolicyContext = {},
): AccountPasswordPolicyResult {
  if (password.length < ACCOUNT_PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `${fieldName} must be at least ${ACCOUNT_PASSWORD_MIN_LENGTH} characters long.`,
    };
  }

  const normalized = normalizedSecret(password);
  if (COMMON_PASSWORD_BLOCKLIST.has(normalized)) {
    return {
      ok: false,
      message: `${fieldName} must not be a commonly used password.`,
    };
  }

  for (const term of contextTerms(context)) {
    if (normalized === term || normalized.includes(term)) {
      return {
        ok: false,
        message: `${fieldName} must not be derived from account or user identifiers.`,
      };
    }
  }

  return { ok: true, message: null };
}
