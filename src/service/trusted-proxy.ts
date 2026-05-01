import { isIP } from 'node:net';
import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { envTruthy } from './deployment-safety.js';

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
    | 'trusted-cf-connecting-ip'
    | 'trusted-x-real-ip'
    | 'unavailable';
  forwardedHeaderPresent: boolean;
  forwardedHeaderTrusted: boolean;
  rejectedReason: 'not-enabled' | 'untrusted-peer' | 'invalid-forwarded-address' | null;
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
  return isIP(withoutIpv4MappedPrefix) ? withoutIpv4MappedPrefix : null;
}

function forwardedHeaderPresent(headers: Headers): boolean {
  return Boolean(
    headers.get('x-forwarded-for')?.trim()
      || headers.get('cf-connecting-ip')?.trim()
      || headers.get('x-real-ip')?.trim()
      || headers.get('forwarded')?.trim(),
  );
}

function firstForwardedAddress(headers: Headers): {
  address: string | null;
  source: TrustedClientAddressResult['source'];
} {
  const forwardedFor = headers.get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (forwardedFor && forwardedFor.length > 0) {
    return {
      address: normalizeIpAddress(forwardedFor[0]),
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

function directPeerIsTrusted(
  directRemoteAddress: string | null,
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  const peers = trustedProxyPeers(env);
  if (peers.has('*')) return true;
  if (!directRemoteAddress) return false;
  return peers.has(directRemoteAddress);
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

  if (!directPeerIsTrusted(directRemoteAddress, env)) {
    return {
      address: directRemoteAddress,
      source: directRemoteAddress ? 'direct' : 'unavailable',
      forwardedHeaderPresent: hasForwardedHeaders,
      forwardedHeaderTrusted: false,
      rejectedReason: hasForwardedHeaders ? 'untrusted-peer' : null,
    };
  }

  const forwarded = firstForwardedAddress(input.headers);
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
