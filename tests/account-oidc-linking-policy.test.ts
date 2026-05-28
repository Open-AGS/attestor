import { strict as assert } from 'node:assert';
import {
  hostedOidcAllowsAutomaticLinking,
  hostedOidcAllowsInsecureRequests,
  type HostedOidcCallbackIdentity,
} from '../src/service/account/account-oidc.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function identity(
  input: Partial<HostedOidcCallbackIdentity> = {},
): HostedOidcCallbackIdentity {
  return {
    issuer: 'https://idp.example',
    subject: 'sub_123',
    email: 'owner@example.com',
    emailVerified: true,
    name: 'Owner',
    claims: {},
    ...input,
  };
}

function main(): void {
  const previous = process.env.ATTESTOR_HOSTED_OIDC_ALLOW_UNVERIFIED_EMAIL_LINK;
  const previousInsecureHttp = process.env.ATTESTOR_HOSTED_OIDC_ALLOW_INSECURE_HTTP;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousHaMode = process.env.ATTESTOR_HA_MODE;

  try {
    delete process.env.ATTESTOR_HOSTED_OIDC_ALLOW_UNVERIFIED_EMAIL_LINK;
    delete process.env.ATTESTOR_HOSTED_OIDC_ALLOW_INSECURE_HTTP;
    delete process.env.NODE_ENV;
    delete process.env.ATTESTOR_HA_MODE;

    ok(
      hostedOidcAllowsAutomaticLinking(identity({ emailVerified: true })) === true,
      'OIDC linking policy: verified email may use automatic first-link fallback',
    );
    ok(
      hostedOidcAllowsAutomaticLinking(identity({ emailVerified: false })) === false,
      'OIDC linking policy: explicitly unverified email fails closed',
    );
    ok(
      hostedOidcAllowsAutomaticLinking(identity({ emailVerified: null })) === false,
      'OIDC linking policy: missing email_verified fails closed',
    );
    ok(
      hostedOidcAllowsAutomaticLinking(identity({ email: null, emailVerified: true })) === false,
      'OIDC linking policy: missing email cannot use automatic fallback',
    );

    process.env.ATTESTOR_HOSTED_OIDC_ALLOW_UNVERIFIED_EMAIL_LINK = 'true';
    ok(
      hostedOidcAllowsAutomaticLinking(identity({ emailVerified: null })) === false,
      'OIDC linking policy: generic true is not enough for unverified email override',
    );

    process.env.ATTESTOR_HOSTED_OIDC_ALLOW_UNVERIFIED_EMAIL_LINK = 'accept-the-risk';
    ok(
      hostedOidcAllowsAutomaticLinking(identity({ emailVerified: null })) === true,
      'OIDC linking policy: explicit risk-acceptance override allows missing email_verified',
    );

    ok(
      hostedOidcAllowsInsecureRequests({
        issuerUrl: 'http://localhost:8080',
        clientId: 'client',
        clientSecret: null,
        redirectUrl: 'http://localhost:3000/api/v1/auth/oidc/callback',
        scopes: 'openid email profile',
        stateTtlMinutes: 10,
      }) === true,
      'OIDC insecure HTTP: localhost issuer is allowed only outside production-like runtimes',
    );

    process.env.ATTESTOR_HA_MODE = 'true';
    assert.throws(
      () => hostedOidcAllowsInsecureRequests({
        issuerUrl: 'http://localhost:8080',
        clientId: 'client',
        clientSecret: null,
        redirectUrl: 'http://localhost:3000/api/v1/auth/oidc/callback',
        scopes: 'openid email profile',
        stateTtlMinutes: 10,
      }),
      /disabled in production-like runtimes/u,
      'OIDC insecure HTTP: production-like runtimes reject localhost HTTP issuers',
    );
    passed += 1;

    process.env.ATTESTOR_HOSTED_OIDC_ALLOW_INSECURE_HTTP = 'true';
    assert.throws(
      () => hostedOidcAllowsInsecureRequests({
        issuerUrl: 'https://idp.example',
        clientId: 'client',
        clientSecret: null,
        redirectUrl: 'https://attestor.example/api/v1/auth/oidc/callback',
        scopes: 'openid email profile',
        stateTtlMinutes: 10,
      }),
      /disabled in production-like runtimes/u,
      'OIDC insecure HTTP: explicit override is ignored in production-like runtimes',
    );
    passed += 1;

    console.log(`Account OIDC linking policy tests: ${passed} passed, 0 failed`);
  } finally {
    if (previous === undefined) delete process.env.ATTESTOR_HOSTED_OIDC_ALLOW_UNVERIFIED_EMAIL_LINK;
    else process.env.ATTESTOR_HOSTED_OIDC_ALLOW_UNVERIFIED_EMAIL_LINK = previous;
    if (previousInsecureHttp === undefined) delete process.env.ATTESTOR_HOSTED_OIDC_ALLOW_INSECURE_HTTP;
    else process.env.ATTESTOR_HOSTED_OIDC_ALLOW_INSECURE_HTTP = previousInsecureHttp;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousHaMode === undefined) delete process.env.ATTESTOR_HA_MODE;
    else process.env.ATTESTOR_HA_MODE = previousHaMode;
  }
}

main();
