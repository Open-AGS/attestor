import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

type PackageJson = {
  readonly scripts: Readonly<Record<string, string>>;
};

type Binding = {
  readonly id: string;
  readonly script: string;
  readonly command: string;
  readonly requiredInputs?: readonly string[];
  readonly expectedArtifacts?: readonly string[];
  readonly required?: boolean;
};

type Substrate = {
  readonly id: string;
  readonly kind: string;
  readonly requiredEnv: readonly string[];
  readonly evidence: string;
};

type TargetProfile = {
  readonly profileVersion: string;
  readonly profileId: string;
  readonly targetEnvironment: {
    readonly type: string;
    readonly provider: string;
    readonly namespace: string;
    readonly regionRef: string;
    readonly clusterRef: string;
    readonly publicHostnameRef: string;
    readonly ownerRef: string;
  };
  readonly runtime: {
    readonly profile: string;
    readonly requireSharedAuthority: boolean;
    readonly noLocalFallback: boolean;
    readonly sharedAuthorityContract: string;
  };
  readonly secretPosture: {
    readonly mode: string;
    readonly plaintextSecretsAllowed: boolean;
    readonly secretStore: string;
    readonly workloadIdentityRequired: boolean;
  };
  readonly substrates: readonly Substrate[];
  readonly renderBindings: readonly Binding[];
  readonly probeBindings: readonly Binding[];
  readonly manifestPatch: {
    readonly targetEnvironment: {
      readonly type: string;
      readonly provider: string;
      readonly namespace: string;
    };
    readonly runtime: {
      readonly profile: string;
      readonly requireSharedAuthority: boolean;
      readonly noLocalFallback: boolean;
      readonly releaseAuthorityPgUrlRef: string;
      readonly redisUrlRef: string;
    };
    readonly secretPosture: {
      readonly mode: string;
      readonly plaintextSecretsAllowed: boolean;
    };
  };
  readonly stopConditions: readonly string[];
  readonly nonClaims: readonly string[];
};

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readProjectFile(...segments)) as T;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function scriptNameFromCommand(command: string): string | null {
  const match = /^npm run ([^\s]+)(?:\s|$)/u.exec(command.trim());
  return match?.[1] ?? null;
}

function profile(): TargetProfile {
  return readJson<TargetProfile>(
    'docs',
    '08-deployment',
    'production-rehearsal-targets',
    'gke-production-rehearsal.json',
  );
}

function packageScripts(): Readonly<Record<string, string>> {
  return readJson<PackageJson>('package.json').scripts;
}

function testProfilePinsGkeProductionSharedPosture(): void {
  const target = profile();

  equal(target.profileVersion, 'attestor.production-rehearsal.target-profile.v1', 'Production rehearsal target: profile version is explicit');
  equal(target.profileId, 'gke-production-rehearsal', 'Production rehearsal target: profile id is stable');
  equal(target.targetEnvironment.type, 'production-like', 'Production rehearsal target: target type is production-like');
  equal(target.targetEnvironment.provider, 'gke', 'Production rehearsal target: provider is GKE');
  equal(target.targetEnvironment.namespace, 'attestor', 'Production rehearsal target: namespace is pinned');
  equal(target.runtime.profile, 'production-shared', 'Production rehearsal target: runtime is production-shared');
  equal(target.runtime.requireSharedAuthority, true, 'Production rehearsal target: shared authority is required');
  equal(target.runtime.noLocalFallback, true, 'Production rehearsal target: local fallback is disabled');
  equal(target.runtime.sharedAuthorityContract, 'async-shared-authority-stores', 'Production rehearsal target: request path contract is explicit');
  equal(target.secretPosture.mode, 'external-secret', 'Production rehearsal target: secrets use external-secret mode');
  equal(target.secretPosture.plaintextSecretsAllowed, false, 'Production rehearsal target: plaintext secrets are blocked');
  equal(target.secretPosture.workloadIdentityRequired, true, 'Production rehearsal target: Workload Identity is required');
}

function testProfileNamesRequiredExternalSubstrates(): void {
  const target = profile();
  const substrateById = new Map(target.substrates.map((entry) => [entry.id, entry]));

  for (const expected of [
    'release-authority-postgres',
    'control-plane-postgres',
    'billing-ledger-postgres',
    'queue-redis',
    'external-secret-store',
    'gateway-tls-dns',
    'grafana-alloy-observability',
  ]) {
    ok(substrateById.has(expected), `Production rehearsal target: substrate is named: ${expected}`);
  }

  ok(substrateById.get('release-authority-postgres')?.requiredEnv.includes('ATTESTOR_RELEASE_AUTHORITY_PG_URL'), 'Production rehearsal target: release authority PG URL is required');
  ok(substrateById.get('control-plane-postgres')?.requiredEnv.includes('ATTESTOR_CONTROL_PLANE_PG_URL'), 'Production rehearsal target: control-plane PG URL is required');
  ok(substrateById.get('billing-ledger-postgres')?.requiredEnv.includes('ATTESTOR_BILLING_LEDGER_PG_URL'), 'Production rehearsal target: billing ledger PG URL is required');
  ok(substrateById.get('queue-redis')?.requiredEnv.includes('REDIS_URL'), 'Production rehearsal target: Redis URL is required');
  ok(substrateById.get('external-secret-store')?.requiredEnv.includes('ATTESTOR_GKE_WORKLOAD_IDENTITY_SERVICE_ACCOUNT'), 'Production rehearsal target: Workload Identity service account is required');
  ok(substrateById.get('gateway-tls-dns')?.requiredEnv.includes('ATTESTOR_TLS_CLUSTER_ISSUER'), 'Production rehearsal target: cert-manager cluster issuer is required');
  ok(substrateById.get('grafana-alloy-observability')?.requiredEnv.includes('ATTESTOR_OBSERVABILITY_ALERTMANAGER_URL'), 'Production rehearsal target: alertmanager URL is required');
}

function testBindingsUseExistingScriptsAndProfiles(): void {
  const target = profile();
  const scripts = packageScripts();
  const allBindings = [...target.renderBindings, ...target.probeBindings];

  for (const binding of allBindings) {
    const scriptName = scriptNameFromCommand(binding.command);
    equal(scriptName, binding.script, `Production rehearsal target: binding ${binding.id} command matches script field`);
    ok(Boolean(scripts[binding.script]), `Production rehearsal target: package script exists for ${binding.script}`);
  }

  ok(
    target.renderBindings.some((binding) => binding.command.includes('ops/kubernetes/ha/profiles/gke-production.json')),
    'Production rehearsal target: HA render uses the existing GKE production profile',
  );
  ok(
    target.renderBindings.some((binding) => binding.command.includes('ops/observability/profiles/regulated-production.json')),
    'Production rehearsal target: observability render uses the existing regulated production profile',
  );
  ok(
    existsSync(join(process.cwd(), 'ops', 'kubernetes', 'ha', 'profiles', 'gke-production.json')),
    'Production rehearsal target: GKE HA profile exists',
  );
  ok(
    existsSync(join(process.cwd(), 'ops', 'observability', 'profiles', 'regulated-production.json')),
    'Production rehearsal target: regulated observability profile exists',
  );
}

function testManifestPatchAndDocsKeepTruthBoundary(): void {
  const target = profile();
  const targetDocs = readProjectFile(
    'docs',
    '08-deployment',
    'production-rehearsal-targets',
    'README.md',
  );
  const manifestDocs = readProjectFile('docs', '08-deployment', 'production-rehearsal-manifest.md');

  equal(target.manifestPatch.targetEnvironment.type, 'production-like', 'Production rehearsal target: manifest patch keeps production-like target');
  equal(target.manifestPatch.targetEnvironment.provider, 'gke', 'Production rehearsal target: manifest patch keeps GKE provider');
  equal(target.manifestPatch.runtime.profile, 'production-shared', 'Production rehearsal target: manifest patch keeps production-shared runtime');
  equal(target.manifestPatch.runtime.noLocalFallback, true, 'Production rehearsal target: manifest patch blocks local fallback');
  equal(target.manifestPatch.secretPosture.mode, 'external-secret', 'Production rehearsal target: manifest patch keeps external-secret posture');
  ok(target.stopConditions.some((condition) => condition.includes('blocked-on-environment-inputs')), 'Production rehearsal target: blocked readiness packet is a stop condition');
  ok(target.nonClaims.some((claim) => claim.includes('not customer-operated production readiness')), 'Production rehearsal target: production readiness non-claim is explicit');
  ok(target.nonClaims.some((claim) => claim.includes('does not add a hosted crypto route')), 'Production rehearsal target: hosted crypto route non-claim is explicit');

  includes(targetDocs, 'until `npm run probe:production-rehearsal-substrates` passes for the named target', 'Production rehearsal target: target docs require the substrate probe before production proof');
  includes(manifestDocs, 'production-rehearsal-targets/gke-production-rehearsal.json', 'Production rehearsal target: manifest docs link the target profile');
  includes(manifestDocs, 'This is still not a live deployment or a production-readiness claim.', 'Production rehearsal target: manifest docs keep non-claim boundary');
}

function testTrackerMarksStep04CompleteWithoutRenumbering(): void {
  const tracker = readProjectFile('docs', '02-architecture', 'production-rehearsal-buildout.md');

  includes(tracker, '| Completed | 6 |', 'Production rehearsal target: tracker marks six steps complete');
  includes(tracker, '| Not started | 4 |', 'Production rehearsal target: tracker leaves four steps not started');
  includes(
    tracker,
    '| 04 | complete | Bind rehearsal to a concrete target environment profile |',
    'Production rehearsal target: Step 04 is complete without changing the frozen title',
  );
  includes(
    tracker,
    '| 05 | complete | Prove external substrate readiness |',
    'Production rehearsal target: Step 05 is complete after substrate probe wiring',
  );
  includes(
    tracker,
    'Implement Step 07: rehearse queue, worker, and async recovery.',
    'Production rehearsal target: immediate next step advances to queue and async recovery',
  );
}

testProfilePinsGkeProductionSharedPosture();
testProfileNamesRequiredExternalSubstrates();
testBindingsUseExistingScriptsAndProfiles();
testManifestPatchAndDocsKeepTruthBoundary();
testTrackerMarksStep04CompleteWithoutRenumbering();

console.log(`production-rehearsal-target-profile.test.ts: ${passed} assertions passed`);
