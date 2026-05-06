import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReleaseDecisionSkeleton } from '../src/release-kernel/object-model.js';
import { ATTESTOR_RELEASE_DECISION_LOG_PATH_ENV } from '../src/release-kernel/release-decision-log.js';
import { ATTESTOR_RELEASE_EVIDENCE_PACK_STORE_PATH_ENV } from '../src/release-kernel/release-evidence-pack.js';
import { ATTESTOR_RELEASE_TOKEN_INTROSPECTION_STORE_PATH_ENV } from '../src/release-kernel/release-introspection.js';
import { verifyIssuedReleaseToken } from '../src/release-kernel/release-token.js';
import { ATTESTOR_RELEASE_REVIEWER_QUEUE_STORE_PATH_ENV } from '../src/release-kernel/reviewer-queue.js';
import {
  ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV,
  ATTESTOR_RELEASE_RUNTIME_PKI_ROTATION_ID_ENV,
  createReleaseRuntimeBootstrap,
} from '../src/service/bootstrap/release-runtime.js';
import {
  ATTESTOR_RUNTIME_PROFILE_ENV,
  resolveRuntimeProfile,
} from '../src/service/bootstrap/runtime-profile.js';
import { createRequestSigners } from '../src/service/request-context.js';
import { resetKeylessCa } from '../src/signing/keyless-signer.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function notEqual<T>(actual: T, expected: T, message: string): void {
  assert.notEqual(actual, expected, message);
  passed += 1;
}

function makeAcceptedDecision() {
  return createReleaseDecisionSkeleton({
    id: 'decision-runtime-pki-rotation',
    createdAt: '2026-04-29T10:00:00.000Z',
    status: 'accepted',
    policyVersion: 'finance.structured-record-release.v1',
    policyHash: 'sha256:policy-runtime-pki-rotation',
    outputHash: 'sha256:output-runtime-pki-rotation',
    consequenceHash: 'sha256:consequence-runtime-pki-rotation',
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
  });
}

const STORE_PATH_ENV = [
  ATTESTOR_RUNTIME_PROFILE_ENV,
  ATTESTOR_RELEASE_DECISION_LOG_PATH_ENV,
  ATTESTOR_RELEASE_REVIEWER_QUEUE_STORE_PATH_ENV,
  ATTESTOR_RELEASE_TOKEN_INTROSPECTION_STORE_PATH_ENV,
  ATTESTOR_RELEASE_EVIDENCE_PACK_STORE_PATH_ENV,
  'ATTESTOR_RELEASE_ENFORCEMENT_DEGRADED_MODE_STORE_PATH',
  'ATTESTOR_POLICY_CONTROL_PLANE_STORE_PATH',
  'ATTESTOR_POLICY_ACTIVATION_APPROVAL_STORE_PATH',
  'ATTESTOR_POLICY_MUTATION_AUDIT_LOG_PATH',
  ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV,
  ATTESTOR_RELEASE_RUNTIME_PKI_ROTATION_ID_ENV,
] as const;

function configureDurableRuntimePaths(root: string, rotationId: string): void {
  process.env[ATTESTOR_RUNTIME_PROFILE_ENV] = 'single-node-durable';
  process.env[ATTESTOR_RELEASE_DECISION_LOG_PATH_ENV] = join(root, 'release-decision-log.jsonl');
  process.env[ATTESTOR_RELEASE_REVIEWER_QUEUE_STORE_PATH_ENV] = join(root, 'release-reviewer-queue.json');
  process.env[ATTESTOR_RELEASE_TOKEN_INTROSPECTION_STORE_PATH_ENV] = join(root, 'release-token-introspection.json');
  process.env[ATTESTOR_RELEASE_EVIDENCE_PACK_STORE_PATH_ENV] = join(root, 'release-evidence-packs.json');
  process.env.ATTESTOR_RELEASE_ENFORCEMENT_DEGRADED_MODE_STORE_PATH = join(root, 'degraded-mode-grants.json');
  process.env.ATTESTOR_POLICY_CONTROL_PLANE_STORE_PATH = join(root, 'policy-control-plane.json');
  process.env.ATTESTOR_POLICY_ACTIVATION_APPROVAL_STORE_PATH = join(root, 'policy-activation-approvals.json');
  process.env.ATTESTOR_POLICY_MUTATION_AUDIT_LOG_PATH = join(root, 'policy-mutation-audit.json');
  process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV] = join(root, 'release-runtime-pki.json');
  process.env[ATTESTOR_RELEASE_RUNTIME_PKI_ROTATION_ID_ENV] = rotationId;
}

function restoreEnvironment(previous: Map<string, string | undefined>): void {
  for (const key of STORE_PATH_ENV) {
    const value = previous.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'attestor-runtime-pki-rotation-'));
  const previousEnv = new Map<string, string | undefined>(
    STORE_PATH_ENV.map((key) => [key, process.env[key]]),
  );

  try {
    configureDurableRuntimePaths(root, 'rotation-a');
    resetKeylessCa();
    const firstProfile = resolveRuntimeProfile({ env: process.env });
    const first = await createReleaseRuntimeBootstrap({ runtimeProfile: firstProfile });
    const firstVerificationKey = await first.apiReleaseVerificationKeyPromise;
    const issued = await first.apiReleaseTokenIssuer.issue({
      decision: makeAcceptedDecision(),
      issuedAt: '2026-04-29T10:00:00.000Z',
    });

    equal(first.pkiPersistence.mode, 'file', 'PKI rotation: durable profile uses file-backed issuer material');
    equal(first.pkiPersistence.rotationId, 'rotation-a', 'PKI rotation: first boot records the configured rotation id');
    equal(first.pkiPersistence.retiredVerificationKeyCount, 0, 'PKI rotation: first boot has no retired verification keys');
    equal(issued.keyId, firstVerificationKey.keyId, 'PKI rotation: issued token is signed by the first active key');
    equal(
      createRequestSigners('operator_asserted').signer.caPublicKeyPem,
      first.pki.ca.keyPair.publicKeyPem,
      'PKI rotation: request keyless signer uses the persisted runtime CA trust root',
    );

    configureDurableRuntimePaths(root, 'rotation-b');
    const secondProfile = resolveRuntimeProfile({ env: process.env });
    const second = await createReleaseRuntimeBootstrap({ runtimeProfile: secondProfile });
    const secondVerificationKey = await second.apiReleaseVerificationKeyPromise;
    const verificationKeys = await second.apiReleaseVerificationKeysPromise;

    equal(second.pkiPersistence.mode, 'file', 'PKI rotation: rotated runtime remains file-backed');
    equal(second.pkiPersistence.rotated, true, 'PKI rotation: rotation id change performs an explicit rotation');
    equal(second.pkiPersistence.rotationId, 'rotation-b', 'PKI rotation: rotated runtime records the new rotation id');
    equal(second.pkiPersistence.retiredVerificationKeyCount, 1, 'PKI rotation: rotated runtime keeps one retired verification key');
    equal(
      createRequestSigners('operator_asserted').signer.caPublicKeyPem,
      second.pki.ca.keyPair.publicKeyPem,
      'PKI rotation: request keyless signer follows the rotated runtime CA trust root',
    );
    notEqual(
      secondVerificationKey.keyId,
      firstVerificationKey.keyId,
      'PKI rotation: rotated runtime uses a new active signing key',
    );
    equal(
      verificationKeys[0]?.keyId,
      secondVerificationKey.keyId,
      'PKI rotation: JWKS rollover lists the active key first',
    );
    ok(
      verificationKeys.some((key) => key.keyId === firstVerificationKey.keyId),
      'PKI rotation: JWKS rollover keeps the retired public verification key for existing tokens',
    );

    const retiredVerificationKey = verificationKeys.find(
      (key) => key.keyId === firstVerificationKey.keyId,
    );
    ok(retiredVerificationKey, 'PKI rotation: retired verification key can be selected by token kid');
    await verifyIssuedReleaseToken({
      token: issued.token,
      verificationKey: retiredVerificationKey!,
      audience: 'finance.reporting.record-store',
      currentDate: '2026-04-29T10:01:00.000Z',
    });
    passed += 1;

    const pkiPath = process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV]!;
    ok(existsSync(pkiPath), 'PKI rotation: runtime PKI store exists after rotation');
    const stored = JSON.parse(readFileSync(pkiPath, 'utf8')) as {
      retiredVerificationKeys?: Array<Record<string, unknown>>;
    };
    equal(
      stored.retiredVerificationKeys?.length,
      1,
      'PKI rotation: file store records one retired verification key',
    );
    equal(
      'privateKeyPem' in (stored.retiredVerificationKeys?.[0] ?? {}),
      false,
      'PKI rotation: retired key history stores public verification material only',
    );
  } finally {
    restoreEnvironment(previousEnv);
    rmSync(root, { recursive: true, force: true });
  }

  console.log(`production-runtime-pki-rotation.test.ts: ${passed} assertions passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
