import { stableJsonStringify } from './json-stable.js';

export type SecretEnvelopeProvider = 'vault_transit';

export interface SecretEnvelopeRecord {
  provider: SecretEnvelopeProvider;
  keyName: string;
  ciphertext: string;
  contextBase64: string;
  sealedAt: string;
}

export interface SecretEnvelopeStatus {
  configured: boolean;
  provider: SecretEnvelopeProvider | null;
  recoveryEnabled: boolean;
  backend: 'external' | 'disabled';
  vaultBaseUrl: string | null;
  keyName: string | null;
}

export class SecretEnvelopeError extends Error {
  constructor(
    public readonly code: 'MISCONFIGURED' | 'PROVIDER_ERROR' | 'DISABLED',
    message: string,
  ) {
    super(message);
    this.name = 'SecretEnvelopeError';
  }
}

function configuredProvider(): SecretEnvelopeProvider | null {
  const raw = process.env.ATTESTOR_SECRET_ENVELOPE_PROVIDER?.trim().toLowerCase() ?? '';
  if (!raw) return null;
  if (raw === 'vault_transit') return 'vault_transit';
  throw new SecretEnvelopeError(
    'MISCONFIGURED',
    `Unsupported ATTESTOR_SECRET_ENVELOPE_PROVIDER '${raw}'. Supported providers: vault_transit.`,
  );
}

function recoveryEnabled(): boolean {
  return process.env.ATTESTOR_TENANT_KEY_RECOVERY_ENABLED?.trim().toLowerCase() === 'true';
}

function vaultConfig(): {
  baseUrl: string;
  token: string;
  keyName: string;
  mountPath: string;
  namespace: string | null;
} {
  const baseUrl = process.env.ATTESTOR_VAULT_TRANSIT_BASE_URL?.trim() ?? '';
  const token = process.env.ATTESTOR_VAULT_TRANSIT_TOKEN?.trim() ?? '';
  const keyName = process.env.ATTESTOR_VAULT_TRANSIT_KEY_NAME?.trim() ?? '';
  const mountPath = process.env.ATTESTOR_VAULT_TRANSIT_MOUNT_PATH?.trim() || 'transit';
  const namespace = process.env.ATTESTOR_VAULT_NAMESPACE?.trim() || null;
  if (!baseUrl || !token || !keyName) {
    throw new SecretEnvelopeError(
      'MISCONFIGURED',
      'Vault Transit requires ATTESTOR_VAULT_TRANSIT_BASE_URL, ATTESTOR_VAULT_TRANSIT_TOKEN, and ATTESTOR_VAULT_TRANSIT_KEY_NAME.',
    );
  }
  return {
    baseUrl: normalizeVaultBaseUrl(baseUrl),
    token,
    keyName: normalizeVaultPath(keyName, 'ATTESTOR_VAULT_TRANSIT_KEY_NAME').join('/'),
    mountPath: normalizeVaultPath(mountPath, 'ATTESTOR_VAULT_TRANSIT_MOUNT_PATH').join('/'),
    namespace,
  };
}

function encodeContext(context: Record<string, unknown>): string {
  return Buffer.from(stableJsonStringify(context), 'utf8').toString('base64');
}

function normalizeVaultBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SecretEnvelopeError('MISCONFIGURED', 'ATTESTOR_VAULT_TRANSIT_BASE_URL must be a valid URL.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new SecretEnvelopeError('MISCONFIGURED', 'ATTESTOR_VAULT_TRANSIT_BASE_URL must use http or https.');
  }
  if (url.username || url.password) {
    throw new SecretEnvelopeError(
      'MISCONFIGURED',
      'ATTESTOR_VAULT_TRANSIT_BASE_URL must not contain credentials; use ATTESTOR_VAULT_TRANSIT_TOKEN.',
    );
  }
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/u, '');
  return url.toString().replace(/\/+$/u, '');
}

function normalizeVaultPath(value: string, name: string): string[] {
  const normalized = value.trim().replace(/^\/+|\/+$/gu, '');
  if (!normalized) {
    throw new SecretEnvelopeError('MISCONFIGURED', `${name} must not be empty.`);
  }
  const segments = normalized.split('/');
  for (const segment of segments) {
    if (!/^[A-Za-z0-9_.-]+$/u.test(segment)) {
      throw new SecretEnvelopeError(
        'MISCONFIGURED',
        `${name} contains an unsupported Vault path segment.`,
      );
    }
  }
  return segments;
}

function vaultTransitUrl(config: ReturnType<typeof vaultConfig>, pathSegments: readonly string[]): string {
  const url = new URL(config.baseUrl);
  const basePath = url.pathname.replace(/\/+$/u, '');
  const mountSegments = normalizeVaultPath(config.mountPath, 'ATTESTOR_VAULT_TRANSIT_MOUNT_PATH');
  const normalizedPathSegments = pathSegments.flatMap((segment, index) => (
    normalizeVaultPath(segment, `Vault Transit request path segment ${index + 1}`)
  ));
  const encodedPath = ['v1', ...mountSegments, ...normalizedPathSegments]
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  url.pathname = `${basePath}/${encodedPath}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function vaultTransitRequestBody(payload: Record<string, unknown>): string {
  for (const [key, value] of Object.entries(payload)) {
    if (!/^[A-Za-z0-9_.-]+$/u.test(key)) {
      throw new SecretEnvelopeError('MISCONFIGURED', 'Vault Transit request contains an unsupported field name.');
    }
    if (typeof value !== 'string') {
      throw new SecretEnvelopeError('MISCONFIGURED', 'Vault Transit request fields must be strings.');
    }
    if (value.length > 16_384 || /[\u0000-\u001f\u007f]/u.test(value)) {
      throw new SecretEnvelopeError('MISCONFIGURED', 'Vault Transit request contains an invalid field value.');
    }
  }
  // codeql[js/file-access-to-http]
  return JSON.stringify(payload);
}

async function vaultTransitRequest<T>(pathSegments: readonly string[], payload: Record<string, unknown>): Promise<T> {
  const config = vaultConfig();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-vault-token': config.token,
  };
  if (config.namespace) headers['x-vault-namespace'] = config.namespace;

  const response = await fetch(vaultTransitUrl(config, pathSegments), {
    method: 'POST',
    headers,
    body: vaultTransitRequestBody(payload),
  });
  const body = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok) {
    const errors = Array.isArray((body as { errors?: unknown }).errors)
      ? (body as { errors: unknown[] }).errors
      : [];
    const message = typeof errors[0] === 'string'
      ? String(errors[0])
      : `Vault Transit request failed with status ${response.status}.`;
    throw new SecretEnvelopeError('PROVIDER_ERROR', message);
  }
  return body as T;
}

export function getSecretEnvelopeStatus(): SecretEnvelopeStatus {
  const provider = configuredProvider();
  if (!provider) {
    return {
      configured: false,
      provider: null,
      recoveryEnabled: recoveryEnabled(),
      backend: 'disabled',
      vaultBaseUrl: null,
      keyName: null,
    };
  }
  if (provider === 'vault_transit') {
    const rawBaseUrl = process.env.ATTESTOR_VAULT_TRANSIT_BASE_URL?.trim() || null;
    const rawKeyName = process.env.ATTESTOR_VAULT_TRANSIT_KEY_NAME?.trim() || null;
    let baseUrl: string | null = null;
    let keyName: string | null = null;
    try {
      baseUrl = rawBaseUrl ? normalizeVaultBaseUrl(rawBaseUrl) : null;
      keyName = rawKeyName ? normalizeVaultPath(rawKeyName, 'ATTESTOR_VAULT_TRANSIT_KEY_NAME').join('/') : null;
    } catch {
      baseUrl = null;
      keyName = null;
    }
    return {
      configured: Boolean(baseUrl && keyName),
      provider,
      recoveryEnabled: recoveryEnabled(),
      backend: 'external',
      vaultBaseUrl: baseUrl,
      keyName,
    };
  }
  return {
    configured: false,
    provider: null,
    recoveryEnabled: recoveryEnabled(),
    backend: 'disabled',
    vaultBaseUrl: null,
    keyName: null,
  };
}

export async function sealSecretEnvelope(
  plaintext: string,
  context: Record<string, unknown>,
): Promise<SecretEnvelopeRecord | null> {
  const provider = configuredProvider();
  if (!provider) return null;
  if (provider === 'vault_transit') {
    const config = vaultConfig();
    const contextBase64 = encodeContext(context);
    const response = await vaultTransitRequest<{ data?: { ciphertext?: string } }>(
      ['encrypt', config.keyName],
      {
        plaintext: Buffer.from(plaintext, 'utf8').toString('base64'),
        context: contextBase64,
      },
    );
    const ciphertext = response.data?.ciphertext?.trim();
    if (!ciphertext) {
      throw new SecretEnvelopeError('PROVIDER_ERROR', 'Vault Transit encrypt response did not include ciphertext.');
    }
    return {
      provider,
      keyName: config.keyName,
      ciphertext,
      contextBase64,
      sealedAt: new Date().toISOString(),
    };
  }
  return null;
}

export async function recoverSecretEnvelope(record: SecretEnvelopeRecord): Promise<string> {
  const provider = configuredProvider();
  if (!provider) {
    throw new SecretEnvelopeError(
      'DISABLED',
      'Secret envelope provider is not configured. Set ATTESTOR_SECRET_ENVELOPE_PROVIDER before attempting recovery.',
    );
  }
  if (provider !== record.provider) {
    throw new SecretEnvelopeError(
      'MISCONFIGURED',
      `Configured secret envelope provider '${provider}' does not match record provider '${record.provider}'.`,
    );
  }
  if (provider === 'vault_transit') {
    const response = await vaultTransitRequest<{ data?: { plaintext?: string } }>(
      ['decrypt', record.keyName],
      {
        ciphertext: record.ciphertext,
        context: record.contextBase64,
      },
    );
    const plaintext = response.data?.plaintext?.trim();
    if (!plaintext) {
      throw new SecretEnvelopeError('PROVIDER_ERROR', 'Vault Transit decrypt response did not include plaintext.');
    }
    return Buffer.from(plaintext, 'base64').toString('utf8');
  }
  throw new SecretEnvelopeError('MISCONFIGURED', `Unsupported provider '${record.provider}'.`);
}

export function assertTenantKeyRecoveryEnabled(): void {
  if (!recoveryEnabled()) {
    throw new SecretEnvelopeError(
      'DISABLED',
      'Tenant key recovery is disabled. Set ATTESTOR_TENANT_KEY_RECOVERY_ENABLED=true to allow break-glass recovery.',
    );
  }
}
