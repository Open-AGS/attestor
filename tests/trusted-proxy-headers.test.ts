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

    ok(result.address === '192.0.2.11', 'trusted proxy mode uses the rightmost forwarded-for hop by default');
    ok(result.source === 'trusted-x-forwarded-for', 'trusted forwarded-for source is explicit');
    ok(result.forwardedHeaderTrusted, 'trusted proxy mode marks forwarded headers trusted');
    ok(result.rejectedReason === null, 'trusted valid forwarded headers do not report rejection');
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
        ATTESTOR_TRUSTED_PROXY_HOPS: '2',
      }),
    });

    ok(result.address === '192.0.2.10', 'trusted proxy hop count can select the client before an upstream proxy');
    ok(result.source === 'trusted-x-forwarded-for', 'trusted proxy hop count preserves forwarded-for source');
  }

  {
    const result = resolveTrustedClientAddress({
      headers: new Headers({
        'x-forwarded-for': '192.0.2.10, not-an-ip',
      }),
      directRemoteAddress: '10.0.0.1',
      env: env({
        ATTESTOR_TRUST_PROXY_HEADERS: 'true',
        ATTESTOR_TRUSTED_PROXY_PEER_IPS: '10.0.0.1',
      }),
    });

    ok(result.address === '10.0.0.1', 'malformed selected forwarded-for hop fails closed to direct peer');
    ok(result.source === 'direct', 'malformed forwarded-for does not search for a different valid hop');
    ok(result.rejectedReason === 'invalid-forwarded-address', 'malformed forwarded-for reports invalid-forwarded-address');
  }

  {
    const result = resolveTrustedClientAddress({
      headers: new Headers({
        forwarded: 'for=198.51.100.99, for="[2001:db8::1]:443";proto=https;host=attestor.example',
      }),
      directRemoteAddress: '10.0.0.1',
      env: env({
        ATTESTOR_TRUST_PROXY_HEADERS: 'true',
        ATTESTOR_TRUSTED_PROXY_PEER_IPS: '10.0.0.1',
      }),
    });

    ok(result.address === '2001:db8::1', 'trusted proxy mode parses RFC 7239 Forwarded for values');
    ok(result.source === 'trusted-forwarded', 'trusted Forwarded source is explicit');
    ok(result.forwardedHeaderPresent, 'Forwarded header presence is observable when parsed');
    ok(result.forwardedHeaderTrusted, 'Forwarded header is trusted only after peer trust is established');
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
        'x-real-ip': '203.0.113.51',
      }),
      directRemoteAddress: '10.0.0.1',
      env: env({
        NODE_ENV: 'production',
        ATTESTOR_TRUST_PROXY_HEADERS: 'true',
        ATTESTOR_TRUSTED_PROXY_PEER_IPS: '*',
      }),
    });

    ok(result.address === '10.0.0.1', 'production-like wildcard peer trust fails closed to direct peer');
    ok(!result.forwardedHeaderTrusted, 'production-like wildcard peer trust does not trust forwarded headers');
    ok(
      result.rejectedReason === 'wildcard-proxy-trust-blocked',
      'production-like wildcard peer trust reports a specific blocker',
    );
  }

  {
    const result = resolveTrustedClientAddress({
      headers: new Headers({
        'x-real-ip': '203.0.113.52',
      }),
      directRemoteAddress: '10.0.0.1',
      env: env({
        NODE_ENV: 'production',
        ATTESTOR_TRUST_PROXY_HEADERS: 'true',
        ATTESTOR_TRUSTED_PROXY_PEER_IPS: '*',
        ATTESTOR_TRUSTED_PROXY_PEER_WILDCARD_OVERRIDE: 'accept-the-risk',
      }),
    });

    ok(result.address === '203.0.113.52', 'explicit wildcard override accepts forwarded headers in production-like runtime');
    ok(result.source === 'trusted-x-real-ip', 'explicit wildcard override keeps source explicit');
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
