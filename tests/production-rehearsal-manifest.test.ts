import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

type PackageJson = {
  readonly scripts: Readonly<Record<string, string>>;
};

type RehearsalCommand = {
  readonly id: string;
  readonly command: string;
  readonly required: boolean;
  readonly stopOnFailure: boolean;
  readonly evidenceIds: readonly string[];
};

type RehearsalEvidence = {
  readonly id: string;
  readonly required: boolean;
  readonly producer: string;
  readonly status: string;
  readonly verification?: string;
};

type RehearsalManifest = {
  readonly schemaVersion: string;
  readonly rehearsalId: string;
  readonly targetEnvironment: {
    readonly name: string;
    readonly type: string;
    readonly provider: string;
    readonly owner: string;
  };
  readonly source: {
    readonly repository: string;
    readonly commit: string;
    readonly workflowRuns: Readonly<Record<string, string>>;
  };
  readonly runtime: {
    readonly profile: string;
    readonly requireSharedAuthority: boolean;
    readonly noLocalFallback: boolean;
  };
  readonly secretPosture: {
    readonly mode: string;
    readonly plaintextSecretsAllowed: boolean;
    readonly redactedFields: readonly string[];
  };
  readonly commandPlan: readonly RehearsalCommand[];
  readonly evidenceItems: readonly RehearsalEvidence[];
  readonly stopConditions: readonly string[];
  readonly nonClaims: readonly string[];
  readonly goNoGo: {
    readonly verdict: string;
    readonly notes: string;
  };
};

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readProjectFile(...segments)) as T;
}

function npmScriptName(command: string): string | null {
  const match = /^npm run ([^\s]+)$/u.exec(command.trim());
  return match?.[1] ?? null;
}

function testSchemaAndDocsNameTheSameContract(): void {
  const schema = readJson<{
    readonly title: string;
    readonly properties: {
      readonly schemaVersion: { readonly const: string };
    };
  }>('docs', '08-deployment', 'production-rehearsal-manifest.schema.json');
  const doc = readProjectFile('docs', '08-deployment', 'production-rehearsal-manifest.md');

  equal(schema.title, 'Attestor Production Rehearsal Manifest', 'Production rehearsal manifest: schema has the expected title');
  equal(schema.properties.schemaVersion.const, 'attestor.production-rehearsal.manifest.v1', 'Production rehearsal manifest: schema version is frozen at v1');
  includes(doc, 'production-rehearsal-manifest.schema.json', 'Production rehearsal manifest: doc links the schema');
  includes(doc, 'production-rehearsal-manifest.example.json', 'Production rehearsal manifest: doc links the example');
  includes(doc, 'does not claim production readiness', 'Production rehearsal manifest: doc keeps the non-claim boundary clear');
}

function testExampleManifestKeepsProductionTruthBoundaries(): void {
  const manifest = readJson<RehearsalManifest>('docs', '08-deployment', 'production-rehearsal-manifest.example.json');

  equal(manifest.schemaVersion, 'attestor.production-rehearsal.manifest.v1', 'Production rehearsal manifest: example uses v1 schema');
  equal(manifest.source.repository, '0xlamarr-labs/attestor', 'Production rehearsal manifest: example is bound to the Attestor repo');
  ok(/^[a-f0-9]{7,40}$/u.test(manifest.source.commit), 'Production rehearsal manifest: source commit field is commit-shaped');
  equal(manifest.runtime.profile, 'production-shared', 'Production rehearsal manifest: example targets the shared production profile');
  equal(manifest.runtime.requireSharedAuthority, true, 'Production rehearsal manifest: shared authority is explicitly required');
  equal(manifest.runtime.noLocalFallback, true, 'Production rehearsal manifest: local fallback is explicitly blocked');
  equal(manifest.secretPosture.plaintextSecretsAllowed, false, 'Production rehearsal manifest: plaintext secrets are not allowed');
  ok(manifest.secretPosture.redactedFields.includes('ATTESTOR_RELEASE_AUTHORITY_PG_URL'), 'Production rehearsal manifest: release authority URL is redacted');
  equal(manifest.goNoGo.verdict, 'pending', 'Production rehearsal manifest: example does not claim a go verdict');
  ok(manifest.nonClaims.some((claim) => claim.includes('not a hosted public SaaS launch')), 'Production rehearsal manifest: hosted SaaS non-claim is recorded');
  ok(manifest.nonClaims.some((claim) => claim.includes('not market validation')), 'Production rehearsal manifest: market validation non-claim is recorded');
}

function testCommandPlanUsesExistingScriptsAndCoversEvidence(): void {
  const manifest = readJson<RehearsalManifest>('docs', '08-deployment', 'production-rehearsal-manifest.example.json');
  const packageJson = readJson<PackageJson>('package.json');
  const evidenceIds = new Set(manifest.evidenceItems.map((item) => item.id));

  for (const command of manifest.commandPlan) {
    ok(command.required, `Production rehearsal manifest: command ${command.id} is marked required in the first template`);
    ok(command.stopOnFailure, `Production rehearsal manifest: command ${command.id} stops on failure`);
    for (const evidenceId of command.evidenceIds) {
      ok(evidenceIds.has(evidenceId), `Production rehearsal manifest: command ${command.id} references existing evidence ${evidenceId}`);
    }

    const scriptName = npmScriptName(command.command);
    if (scriptName) {
      ok(Boolean(packageJson.scripts[scriptName]), `Production rehearsal manifest: npm script exists for ${command.command}`);
    }
  }

  ok(
    manifest.commandPlan.some((command) => command.command === 'npm run render:production-readiness-packet'),
    'Production rehearsal manifest: command plan includes the production readiness packet renderer',
  );
  ok(
    manifest.commandPlan.some((command) => command.command === 'npm run probe:ha-runtime-connectivity'),
    'Production rehearsal manifest: command plan includes HA runtime connectivity probe',
  );
  ok(
    manifest.commandPlan.some((command) => command.command.startsWith('gh attestation verify ')),
    'Production rehearsal manifest: command plan includes release provenance verification',
  );
}

function testEvidenceAndStopConditionsAreFailClosed(): void {
  const manifest = readJson<RehearsalManifest>('docs', '08-deployment', 'production-rehearsal-manifest.example.json');
  const evidence = manifest.evidenceItems;

  ok(evidence.every((item) => item.status === 'pending'), 'Production rehearsal manifest: example evidence starts pending');
  ok(evidence.every((item) => item.required), 'Production rehearsal manifest: example evidence is required');
  ok(evidence.every((item) => item.verification && item.verification.length > 20), 'Production rehearsal manifest: each evidence item explains verification');
  ok(
    manifest.stopConditions.some((condition) => condition.includes('Target environment identity is missing')),
    'Production rehearsal manifest: missing target identity is a stop condition',
  );
  ok(
    manifest.stopConditions.some((condition) => condition.includes('silently falls back to local/process memory')),
    'Production rehearsal manifest: silent local fallback is a stop condition',
  );
  ok(
    manifest.stopConditions.some((condition) => condition.includes('plaintext secrets')),
    'Production rehearsal manifest: plaintext secrets are a stop condition',
  );
}

function testTrackerMarksStep02CompleteWithoutRenumbering(): void {
  const tracker = readProjectFile('docs', '02-architecture', 'production-rehearsal-buildout.md');

  includes(tracker, '| Completed | 2 |', 'Production rehearsal manifest: tracker marks two steps complete');
  includes(tracker, '| Not started | 8 |', 'Production rehearsal manifest: tracker leaves eight steps not started');
  includes(
    tracker,
    '| 02 | complete | Define the rehearsal manifest and evidence schema |',
    'Production rehearsal manifest: Step 02 is complete without changing the frozen title',
  );
  includes(
    tracker,
    '| 03 | pending | Add the one-command rehearsal planner |',
    'Production rehearsal manifest: Step 03 remains the next pending step',
  );
}

testSchemaAndDocsNameTheSameContract();
testExampleManifestKeepsProductionTruthBoundaries();
testCommandPlanUsesExistingScriptsAndCoversEvidence();
testEvidenceAndStopConditionsAreFailClosed();
testTrackerMarksStep02CompleteWithoutRenumbering();

console.log(`Production rehearsal manifest tests: ${passed} passed, 0 failed`);
