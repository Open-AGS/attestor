import { strict as assert } from 'node:assert';
import { generateKeyPair } from '../src/signing/keys.js';
import { createReleaseDecisionSkeleton } from '../src/release-kernel/object-model.js';
import {
  createReleaseTokenIssuer,
  releaseTokenVerificationKeyToJwks,
  verifyIssuedReleaseToken,
  RELEASE_TOKEN_ISSUANCE_SPEC_VERSION,
  RELEASE_TOKEN_VERIFICATION_KEY_SPEC_VERSION,
  RELEASE_TOKEN_VERIFICATION_SPEC_VERSION,
} from '../src/release-kernel/release-token.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

async function throwsAsync(
  fn: () => Promise<unknown>,
  pattern: RegExp,
  message: string,
): Promise<void> {
  await assert.rejects(fn, pattern, message);
  passed += 1;
}

function makeDecision(
  status: 'accepted' | 'overridden' | 'denied' | 'hold',
  overrides: Partial<Parameters<typeof createReleaseDecisionSkeleton>[0]> = {},
) {
  return createReleaseDecisionSkeleton({
    id: `decision-${status}`,
    createdAt: '2026-04-17T20:00:00.000Z',
    status,
    policyVersion: 'finance.structured-record-release.v1',
    policyHash: 'finance.structured-record-release.v1',
    outputHash: 'sha256:output',
    consequenceHash: 'sha256:consequence',
    outputContract: {
      artifactType: 'financial-reporting.record-field',
      expectedShape: 'structured financial record payload',
      consequenceType: 'record',
      riskClass: 'R4',
    },
    capabilityBoundary: {
      allowedTools: ['xbrl-export'],
      allowedTargets: ['sec.edgar.filing.prepare'],
      allowedDataDomains: ['financial-reporting'],
    },
    requester: {
      id: 'svc.reporting-bot',
      type: 'service',
    },
    target: {
      kind: 'record-store',
      id: 'finance.reporting.record-store',
    },
    override:
      status === 'overridden'
        ? {
            reasonCode: 'emergency-filing-window',
            ticketId: 'INC-1201',
            requestedBy: {
              id: 'user.breakglass',
              type: 'user',
              role: 'risk-owner',
            },
          }
        : null,
    ...overrides,
  });
}

async function main(): Promise<void> {
  const keyPair = generateKeyPair();
  const issuer = createReleaseTokenIssuer({
    issuer: 'attestor.release.local',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });

  const acceptedDecision = makeDecision('accepted');
  const issued = await issuer.issue({
    decision: acceptedDecision,
    issuedAt: '2026-04-17T20:00:00.000Z',
  });

  equal(
    issued.version,
    RELEASE_TOKEN_ISSUANCE_SPEC_VERSION,
    'Release token: issued tokens carry a stable issuance schema version',
  );
  equal(
    issued.keyId,
    keyPair.fingerprint,
    'Release token: default key id is derived from the signing public key fingerprint',
  );
  equal(
    issued.claims.decision,
    'accepted',
    'Release token: only the accepted release decision status is embedded in the claims',
  );
  equal(
    issued.claims.aud,
    'finance.reporting.record-store',
    'Release token: the audience is bound to the downstream release target id',
  );
  ok(
    issued.token.length > 40,
    'Release token: a compact signed JWT artifact is emitted',
  );

  const verificationKey = await issuer.exportVerificationKey();
  equal(
    verificationKey.version,
    RELEASE_TOKEN_VERIFICATION_KEY_SPEC_VERSION,
    'Release token: exported verification keys carry a stable schema version',
  );
  equal(
    verificationKey.jwk.kid,
    issued.keyId,
    'Release token: JWKS export preserves the same key id used in the protected header',
  );
  const jwks = releaseTokenVerificationKeyToJwks(verificationKey);
  equal(jwks.keys.length, 1, 'Release token: JWKS export exposes exactly one active verification key');
  equal(
    jwks.keys[0]?.kid,
    issued.keyId,
    'Release token: JWKS export binds the public verification key to the token kid',
  );
  equal(
    jwks.keys[0]?.use,
    'sig',
    'Release token: JWKS export marks the key for signature verification',
  );
  equal(
    Array.isArray(jwks.keys[0]?.key_ops) ? jwks.keys[0]?.key_ops?.join(',') : null,
    'verify',
    'Release token: JWKS export limits key operations to verification',
  );
  equal(
    'd' in (jwks.keys[0] as Record<string, unknown>),
    false,
    'Release token: JWKS export does not expose private key material',
  );

  const verified = await verifyIssuedReleaseToken({
    token: issued.token,
    verificationKey,
    audience: 'finance.reporting.record-store',
    currentDate: '2026-04-17T20:01:00.000Z',
  });

  equal(
    verified.version,
    RELEASE_TOKEN_VERIFICATION_SPEC_VERSION,
    'Release token: low-level verification results carry a stable schema version',
  );
  equal(
    verified.claims.output_hash,
    acceptedDecision.outputHash,
    'Release token: verification preserves the bound output hash claim',
  );
  equal(
    verified.claims.consequence_hash,
    acceptedDecision.consequenceHash,
    'Release token: verification preserves the bound consequence hash claim',
  );
  equal(
    verified.keyId,
    issued.keyId,
    'Release token: the protected header key id survives verification',
  );

  const overriddenDecision = makeDecision('overridden');
  const overriddenToken = await issuer.issue({
    decision: overriddenDecision,
    issuedAt: '2026-04-17T20:00:00.000Z',
  });
  ok(
    overriddenToken.claims.override,
    'Release token: overridden release decisions preserve override state in the claims',
  );

  await throwsAsync(
    () =>
      issuer.issue({
        decision: makeDecision('overridden', { override: null }),
      }),
    /explicit override grant/,
    'Release token: overridden decisions require an explicit override grant before token issuance',
  );

  await throwsAsync(
    () =>
      issuer.issue({
        decision: makeDecision('overridden', {
          override: {
            reasonCode: 'emergency-filing-window',
            requestedBy: {
              id: 'user.breakglass',
              type: 'user',
            },
          },
        }),
      }),
    /override requester role/,
    'Release token: break-glass token issuance requires a role-bound requester',
  );

  await throwsAsync(
    () =>
      issuer.issue({
        decision: makeDecision('overridden', {
          override: {
            reasonCode: 'emergency-filing-window',
            requestedBy: {
              id: 'user.breakglass',
              type: 'user',
              role: 'support-agent',
            },
          },
        }),
      }),
    /authorized override requester role/,
    'Release token: break-glass token issuance rejects unauthorized requester roles',
  );

  const customOverrideIssuer = createReleaseTokenIssuer({
    issuer: 'attestor.release.local',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
    overrideAuthorityRoles: ['support-lead'],
  });
  const customOverrideToken = await customOverrideIssuer.issue({
    decision: makeDecision('overridden', {
      override: {
        reasonCode: 'customer-support-incident',
        requestedBy: {
          id: 'user.support-lead',
          type: 'user',
          role: 'support-lead',
        },
      },
    }),
    issuedAt: '2026-04-17T20:00:00.000Z',
  });
  ok(
    customOverrideToken.claims.override,
    'Release token: deployments can explicitly configure domain-specific override authority roles',
  );

  const shortLived = await issuer.issue({
    decision: acceptedDecision,
    issuedAt: '2026-04-17T20:00:00.000Z',
    ttlSeconds: 60,
  });
  equal(
    shortLived.claims.exp - shortLived.claims.iat,
    60,
    'Release token: caller-specified TTL can shorten the token lifetime below the decision maximum',
  );

  await throwsAsync(
    () =>
      issuer.issue({
        decision: acceptedDecision,
        issuedAt: '2026-04-17T20:04:00.000Z',
      }),
    /already expired/,
    'Release token: issuance fails if the release decision has already expired for token issuance',
  );

  await throwsAsync(
    () =>
      issuer.issue({
        decision: makeDecision('hold'),
      }),
    /requires an accepted or overridden decision/,
    'Release token: hold decisions cannot be turned into authorization artifacts',
  );

  await throwsAsync(
    () =>
      issuer.issue({
        decision: makeDecision('denied'),
      }),
    /requires an accepted or overridden decision/,
    'Release token: denied decisions cannot be turned into authorization artifacts',
  );

  await throwsAsync(
    () =>
      verifyIssuedReleaseToken({
        token: issued.token,
        verificationKey,
        audience: 'some.other.target',
        currentDate: '2026-04-17T20:01:00.000Z',
      }),
    /unexpected "aud" claim value/,
    'Release token: audience mismatch fails verification instead of allowing token reuse on another target',
  );

  const wrongKidIssuer = createReleaseTokenIssuer({
    issuer: 'attestor.release.local',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
    keyId: 'attacker-controlled-kid',
  });
  const wrongKidToken = await wrongKidIssuer.issue({
    decision: acceptedDecision,
    issuedAt: '2026-04-17T20:00:00.000Z',
  });
  await throwsAsync(
    () =>
      verifyIssuedReleaseToken({
        token: wrongKidToken.token,
        verificationKey,
        audience: 'finance.reporting.record-store',
        currentDate: '2026-04-17T20:01:00.000Z',
      }),
    /protected header kid does not match/,
    'Release token: verifier rejects a valid signature when the token kid is not bound to the verification key',
  );

  console.log(`\nRelease kernel release-token tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease kernel release-token tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
