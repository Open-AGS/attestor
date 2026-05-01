import assert from 'node:assert/strict';
import {
  resolveTrustedClientAddress,
} from '../src/service/trusted-proxy.js';

let passed = 0;

function ok(condition: boolean, message: string): void {
  assert.ok(condition, message);
  passed++;
}

function env(input: Record<string, string | undefined> = {}): Readonly<Record<string, string | undefined>> {
  return input;
}

function run(): void {
  console.log('\nTrusted Proxy Header Tests');

  {
    const result = resolveTrustedClientAddress({
      headers: new Headers({
        'x-forwarded-for': '192.0.2.10',
        'x-real-ip': '192.0.2.11',
      }),
      directRemoteAddress: '198.51.100.10',
      env: env(),
    });

    ok(result.address === '198.51.100.10', 'forwarded headers are ignored unless trusted proxy mode is enabled');
    ok(result.source === 'direct', 'untrusted forwarded headers keep the direct peer source');
    ok(result.forwardedHeaderPresent, 'forwarded header presence is still observable');
    ok(!result.forwardedHeaderTrusted, 'forwarded headers are not marked trusted by default');
    ok(result.rejectedReason === 'not-enabled', 'disabled trust mode reports not-enabled');
  }

  {
    const result = resolveTrustedClientAddress({
      headers: new Headers({
        'x-forwarded-for': '192.0.2.10',
      }),
      env: env(),
    });

    ok(result.address === null, 'forwarded headers without a direct peer do not become a source by default');
    ok(result.source === 'unavailable', 'missing direct peer reports unavailable source');
  }

  {
    const result = resolveTrustedClientAddress({
      headers: new Headers({
        'x-forwarded-for': '192.0.2.10, 192.0.2.11',
      }),
      directRemoteAddress: '10.0.0.1',
      env: env({
        ATTESTOR_TRUST_PROXY_HEADERS: 'true',
        ATTESTOR_TRUSTED_PROXY_PEER_IPS: '10.0.0.1',
      }),
    });

    ok(result.address === '192.0.2.10', 'trusted proxy mode uses the first forwarded-for hop');
    ok(result.source === 'trusted-x-forwarded-for', 'trusted forwarded-for source is explicit');
    ok(result.forwardedHeaderTrusted, 'trusted proxy mode marks forwarded headers trusted');
    ok(result.rejectedReason === null, 'trusted valid forwarded headers do not report rejection');
  }

  {
    const result = resolveTrustedClientAddress({
      headers: new Headers({
        'x-forwarded-for': 'not-an-ip, 192.0.2.10',
      }),
      directRemoteAddress: '10.0.0.1',
      env: env({
        ATTESTOR_TRUST_PROXY_HEADERS: 'true',
        ATTESTOR_TRUSTED_PROXY_PEER_IPS: '10.0.0.1',
      }),
    });

    ok(result.address === '10.0.0.1', 'malformed first forwarded-for hop fails closed to direct peer');
    ok(result.source === 'direct', 'malformed forwarded-for does not search for a later valid hop');
    ok(result.rejectedReason === 'invalid-forwarded-address', 'malformed forwarded-for reports invalid-forwarded-address');
  }

  {
    const result = resolveTrustedClientAddress({
      headers: new Headers({
        'cf-connecting-ip': '::ffff:192.0.2.20',
      }),
      directRemoteAddress: '10.0.0.1',
      env: env({
        ATTESTOR_TRUST_PROXY_HEADERS: 'true',
        ATTESTOR_TRUSTED_PROXY_PEER_IPS: '10.0.0.1',
      }),
    });

    ok(result.address === '192.0.2.20', 'ipv4-mapped addresses are normalized before use');
    ok(result.source === 'trusted-cf-connecting-ip', 'trusted cloudflare source is explicit');
  }

  {
    const result = resolveTrustedClientAddress({
      headers: new Headers({
        'x-real-ip': '203.0.113.50',
      }),
      env: env({
        ATTESTOR_TRUST_PROXY_HEADERS: 'true',
        ATTESTOR_TRUSTED_PROXY_PEER_IPS: '*',
      }),
    });

    ok(result.address === '203.0.113.50', 'wildcard peer trust is explicit and accepts forwarded addresses');
    ok(result.source === 'trusted-x-real-ip', 'trusted x-real-ip source is explicit');
  }

  {
    const result = resolveTrustedClientAddress({
      headers: new Headers({
        'x-forwarded-for': '192.0.2.99',
      }),
      directRemoteAddress: '10.0.0.2',
      env: env({
        ATTESTOR_TRUST_PROXY_HEADERS: 'true',
        ATTESTOR_TRUSTED_PROXY_PEER_IPS: '10.0.0.1',
      }),
    });

    ok(result.address === '10.0.0.2', 'trusted proxy mode rejects forwarded headers from untrusted direct peers');
    ok(result.rejectedReason === 'untrusted-peer', 'untrusted peer rejection is explicit');
  }

  console.log(`Trusted Proxy Header Tests: ${passed} passed, 0 failed`);
}

run();
