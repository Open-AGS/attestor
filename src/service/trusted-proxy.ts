import { isIP } from 'node:net';
import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { envTruthy, isProductionLikeRuntimeEnv } from './deployment-safety.js';

const TRUSTED_PROXY_HOPS_ENV = 'ATTESTOR_TRUSTED_PROXY_HOPS';
const TRUSTED_PROXY_WILDCARD_OVERRIDE_ENV =
  'ATTESTOR_TRUSTED_PROXY_PEER_WILDCARD_OVERRIDE';
const TRUSTED_PROXY_WILDCARD_OVERRIDE_VALUE = 'accept-the-risk';

export interface TrustedClientAddressInput {
  headers: Headers;
  directRemoteAddress?: string | null;
  env?: Readonly<Record<string, string | undefined>>;
}

export interface TrustedClientAddressResult {
  address: string | null;
  source:
    | 'direct'
    | 'trusted-x-forwarded-for'
    | 'trusted-forwarded'
    | 'trusted-cf-connecting-ip'
    | 'trusted-x-real-ip'
    | 'unavailable';
  forwardedHeaderPresent: boolean;
  forwardedHeaderTrusted: boolean;
  rejectedReason:
    | 'not-enabled'
    | 'untrusted-peer'
    | 'wildcard-proxy-trust-blocked'
    | 'invalid-forwarded-address'
    | null;
}

function normalizeIpAddress(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  const unbracketed = value.startsWith('[') && value.includes(']')
    ? value.slice(1, value.indexOf(']'))
    : value;
  const withoutIpv4MappedPrefix = unbracketed.toLowerCase().startsWith('::ffff:')
    ? unbracketed.slice(7)
    : unbracketed;
  if (isIP(withoutIpv4MappedPrefix)) return withoutIpv4MappedPrefix;
  const ipv4WithPort = withoutIpv4MappedPrefix.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/u);
  if (ipv4WithPort?.[1] && isIP(ipv4WithPort[1])) return ipv4WithPort[1];
  return null;
}

function forwardedHeaderPresent(headers: Headers): boolean {
  return Boolean(
    headers.get('x-forwarded-for')?.trim()
      || headers.get('cf-connecting-ip')?.trim()
      || headers.get('x-real-ip')?.trim()
      || headers.get('forwarded')?.trim(),
  );
}

function trustedProxyHopCount(env: Readonly<Record<string, string | undefined>>): number {
  const raw = env[TRUSTED_PROXY_HOPS_ENV]?.trim();
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || `${parsed}` !== raw) {
    return 1;
  }
  return parsed;
}

function splitHeaderList(raw: string, separator: ',' | ';'): readonly string[] {
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  let escaped = false;

  for (const char of raw) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && quoted) {
      current += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      current += char;
      continue;
    }
    if (char === separator && !quoted) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
      continue;
    }
    current += char;
  }

  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return Object.freeze(parts);
}

function unquoteHeaderValue(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\(.)/gu, '$1');
  }
  return value;
}

function forwardedForAddresses(headers: Headers): readonly string[] {
  const raw = headers.get('forwarded')?.trim();
  if (!raw) return Object.freeze([]);

  const addresses: string[] = [];
  for (const element of splitHeaderList(raw, ',')) {
    for (const parameter of splitHeaderList(element, ';')) {
      const equalsIndex = parameter.indexOf('=');
      if (equalsIndex <= 0) continue;
      const name = parameter.slice(0, equalsIndex).trim().toLowerCase();
      if (name !== 'for') continue;
      addresses.push(unquoteHeaderValue(parameter.slice(equalsIndex + 1)));
      break;
    }
  }
  return Object.freeze(addresses);
}

function selectForwardedAddress(
  values: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): string | null {
  const hopCount = trustedProxyHopCount(env);
  const selectedIndex = values.length - hopCount;
  if (selectedIndex < 0 || selectedIndex >= values.length) return null;
  return normalizeIpAddress(values[selectedIndex]);
}

function firstForwardedAddress(
  headers: Headers,
  env: Readonly<Record<string, string | undefined>>,
): {
  address: string | null;
  source: TrustedClientAddressResult['source'];
} {
  const forwardedFor = headers.get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (forwardedFor && forwardedFor.length > 0) {
    return {
      address: selectForwardedAddress(forwardedFor, env),
      source: 'trusted-x-forwarded-for',
    };
  }

  const cloudflareAddress = normalizeIpAddress(headers.get('cf-connecting-ip'));
  if (cloudflareAddress) {
    return { address: cloudflareAddress, source: 'trusted-cf-connecting-ip' };
  }

  const realIp = normalizeIpAddress(headers.get('x-real-ip'));
  if (realIp) {
    return { address: realIp, source: 'trusted-x-real-ip' };
  }

  const forwarded = forwardedForAddresses(headers);
  if (forwarded.length > 0) {
    return {
      address: selectForwardedAddress(forwarded, env),
      source: 'trusted-forwarded',
    };
  }

  return { address: null, source: 'unavailable' };
}

function trustedProxyHeadersEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  return envTruthy(env.ATTESTOR_TRUST_PROXY_HEADERS)
    || envTruthy(env.ATTESTOR_TRUSTED_PROXY_HEADERS);
}

function trustedProxyPeers(env: Readonly<Record<string, string | undefined>>): Set<string> {
  const raw = env.ATTESTOR_TRUSTED_PROXY_PEER_IPS ?? '';
  return new Set(
    raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => normalizeIpAddress(part) ?? part),
  );
}

function wildcardPeerTrustOverrideAccepted(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return env[TRUSTED_PROXY_WILDCARD_OVERRIDE_ENV]?.trim() ===
    TRUSTED_PROXY_WILDCARD_OVERRIDE_VALUE;
}

function directPeerTrustDecision(
  directRemoteAddress: string | null,
  env: Readonly<Record<string, string | undefined>>,
): {
  trusted: boolean;
  rejectedReason: TrustedClientAddressResult['rejectedReason'];
} {
  const peers = trustedProxyPeers(env);
  if (peers.has('*')) {
    if (isProductionLikeRuntimeEnv(env) && !wildcardPeerTrustOverrideAccepted(env)) {
      return { trusted: false, rejectedReason: 'wildcard-proxy-trust-blocked' };
    }
    return { trusted: true, rejectedReason: null };
  }
  if (!directRemoteAddress) return { trusted: false, rejectedReason: 'untrusted-peer' };
  return {
    trusted: peers.has(directRemoteAddress),
    rejectedReason: peers.has(directRemoteAddress) ? null : 'untrusted-peer',
  };
}

export function directRemoteAddressFromContext(context: Context): string | null {
  try {
    return normalizeIpAddress(getConnInfo(context).remote.address ?? null);
  } catch {
    return null;
  }
}

export function resolveTrustedClientAddress(
  input: TrustedClientAddressInput,
): TrustedClientAddressResult {
  const env = input.env ?? process.env;
  const directRemoteAddress = normalizeIpAddress(input.directRemoteAddress);
  const hasForwardedHeaders = forwardedHeaderPresent(input.headers);

  if (!trustedProxyHeadersEnabled(env)) {
    return {
      address: directRemoteAddress,
      source: directRemoteAddress ? 'direct' : 'unavailable',
      forwardedHeaderPresent: hasForwardedHeaders,
      forwardedHeaderTrusted: false,
      rejectedReason: hasForwardedHeaders ? 'not-enabled' : null,
    };
  }

  const peerTrust = directPeerTrustDecision(directRemoteAddress, env);
  if (!peerTrust.trusted) {
    return {
      address: directRemoteAddress,
      source: directRemoteAddress ? 'direct' : 'unavailable',
      forwardedHeaderPresent: hasForwardedHeaders,
      forwardedHeaderTrusted: false,
      rejectedReason: hasForwardedHeaders ? peerTrust.rejectedReason : null,
    };
  }

  const forwarded = firstForwardedAddress(input.headers, env);
  if (forwarded.address) {
    return {
      address: forwarded.address,
      source: forwarded.source,
      forwardedHeaderPresent: hasForwardedHeaders,
      forwardedHeaderTrusted: true,
      rejectedReason: null,
    };
  }

  return {
    address: directRemoteAddress,
    source: directRemoteAddress ? 'direct' : 'unavailable',
    forwardedHeaderPresent: hasForwardedHeaders,
    forwardedHeaderTrusted: true,
    rejectedReason: hasForwardedHeaders ? 'invalid-forwarded-address' : null,
  };
}
