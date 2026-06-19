import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOSTED_RELEASE_PROVENANCE_SLSA_ALIGNMENT_VERSION,
  HOSTED_RELEASE_PROVENANCE_SLSA_GUARDS,
  hostedReleaseProvenanceSlsaAlignmentProfile,
  requireHostedReleaseProvenanceSlsaGuard,
  type HostedReleaseProvenanceSlsaControl,
} from '../src/service/hosted/hosted-release-provenance-slsa-alignment.js';

let passed = 0;

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

function matches(content: string, expected: RegExp, message: string): void {
  assert.match(content, expected, message);
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8').replace(/\r\n/gu, '\n');
}

function fileExists(projectPath: string): boolean {
  return existsSync(join(process.cwd(), projectPath.split('#')[0]));
}

function hasControl(id: string, control: HostedReleaseProvenanceSlsaControl): void {
  const guard = requireHostedReleaseProvenanceSlsaGuard(id);
  ok(
    guard.requiredControls.includes(control),
    `Hosted release provenance SLSA: ${id} requires ${control}`,
  );
}

function testProfileDescriptor(): void {
  const profile = hostedReleaseProvenanceSlsaAlignmentProfile();

  equal(
    profile.version,
    HOSTED_RELEASE_PROVENANCE_SLSA_ALIGNMENT_VERSION,
    'Hosted release provenance SLSA: version is exported',
  );
  equal(
    profile.guards.length,
    HOSTED_RELEASE_PROVENANCE_SLSA_GUARDS.length,
    'Hosted release provenance SLSA: profile exports every guard',
  );
  includes(
    profile.posture,
    'evaluation archive, SBOM, package-surface gates',
    'Hosted release provenance SLSA: posture names the evidence chain',
  );
  includes(
    profile.currentClaim,
    'does not claim SLSA certification',
    'Hosted release provenance SLSA: claim boundary stays honest',
  );
  includes(
    profile.unresolvedProductionDependency,
    'Stripe/webhook smoke tests',
    'Hosted release provenance SLSA: production dependency remains explicit',
  );
}

function testEveryGuardIsCompleteAndSecretSafe(): void {
  const ids = new Set<string>();

  for (const guard of HOSTED_RELEASE_PROVENANCE_SLSA_GUARDS) {
    ok(!ids.has(guard.id), `Hosted release provenance SLSA: ${guard.id} is unique`);
    ids.add(guard.id);
    ok(guard.releaseRisks.length > 0, `Hosted release provenance SLSA: ${guard.id} declares release risks`);
    ok(guard.requiredControls.length > 0, `Hosted release provenance SLSA: ${guard.id} declares controls`);
    ok(guard.artifactBoundary.length > 100, `Hosted release provenance SLSA: ${guard.id} declares artifact boundary`);
    ok(guard.provenanceBoundary.length > 100, `Hosted release provenance SLSA: ${guard.id} declares provenance boundary`);
    ok(guard.verificationBoundary.length > 100, `Hosted release provenance SLSA: ${guard.id} declares verification boundary`);
    ok(guard.nonClaimBoundary.length > 100, `Hosted release provenance SLSA: ${guard.id} declares non-claim boundary`);
    ok(
      guard.implementationEvidence.every(fileExists),
      `Hosted release provenance SLSA: ${guard.id} evidence files exist`,
    );
    ok(
      guard.validation.every(fileExists),
      `Hosted release provenance SLSA: ${guard.id} validation files exist`,
    );
    ok(
      guard.standards.some((standard) =>
        standard.includes('SLSA') ||
        standard.includes('GitHub') ||
        standard.includes('NIST') ||
        standard.includes('in-toto') ||
        standard.includes('CycloneDX') ||
        standard.includes('OpenSSF'),
      ),
      `Hosted release provenance SLSA: ${guard.id} is anchored to external engineering guidance`,
    );
  }

  excludes(
    JSON.stringify(HOSTED_RELEASE_PROVENANCE_SLSA_GUARDS),
    /\b(?:sk|rk)_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|postgres:\/\/[^"'\s]+|redis:\/\/[^"'\s]+/u,
    'Hosted release provenance SLSA: contract does not contain live secrets or connection strings',
  );
}

function testControlContractsForCriticalBoundaries(): void {
  hasControl('workflow.identity-permission-boundary', 'dedicated_release_workflow_only');
  hasControl('workflow.identity-permission-boundary', 'reviewer_workflows_read_only');
  hasControl('workflow.identity-permission-boundary', 'attestation_permissions_scoped');
  hasControl('workflow.identity-permission-boundary', 'oidc_permission_scoped');
  hasControl('workflow.identity-permission-boundary', 'sha_pinned_actions');
  hasControl('artifact.subject-digest-verification', 'artifact_subject_path_attested');
  hasControl('artifact.subject-digest-verification', 'slsa_build_provenance_predicate');
  hasControl('artifact.subject-digest-verification', 'github_attestation_verify_command');
  hasControl('artifact.subject-digest-verification', 'github_signer_workflow_pin');
  hasControl('sbom.dependency-evidence', 'cyclonedx_sbom_generated');
  hasControl('sbom.dependency-evidence', 'cyclonedx_sbom_attested');
  hasControl('sbom.dependency-evidence', 'supply_chain_baseline_gate');
  hasControl('sbom.dependency-evidence', 'npm_audit_high_gate');
  hasControl('package.surface-gate', 'package_surface_probe_gate');
  hasControl('package.surface-gate', 'build_before_package_probes');
  hasControl('proof.release-packet-binding', 'canonical_release_json');
  hasControl('proof.release-packet-binding', 'release_evidence_dsse_statement');
  hasControl('proof.release-packet-binding', 'release_evidence_subject_digest');
  hasControl('proof.release-packet-binding', 'tamper_evident_history_chain');
  hasControl('promotion.non-claim-boundary', 'deployment_provenance_separate');
  hasControl('promotion.non-claim-boundary', 'no_full_production_claim');
}

function testReleaseWorkflowAndAttestationPlanMatchContract(): void {
  const workflow = readProjectFile('.github', 'workflows', 'release-provenance.yml');
  const smoke = readProjectFile('.github', 'workflows', 'evaluation-smoke.yml');
  const verify = readProjectFile('.github', 'workflows', 'full-verify.yml');
  const securityScan = readProjectFile('.github', 'workflows', 'security-scan.yml');
  const productionRehearsal = readProjectFile('.github', 'workflows', 'production-rehearsal.yml');
  const plan = readProjectFile('docs', '08-deployment', 'artifact-attestation-plan.md');

  includes(workflow, 'name: Release Provenance', 'Hosted release provenance SLSA evidence: workflow title is stable');
  includes(workflow, '- "v*-evaluation"', 'Hosted release provenance SLSA evidence: release tags stay evaluation-scoped');
  includes(workflow, 'contents: read', 'Hosted release provenance SLSA evidence: contents are read-only');
  includes(workflow, 'attestations: write', 'Hosted release provenance SLSA evidence: attestation permission is scoped');
  includes(workflow, 'id-token: write', 'Hosted release provenance SLSA evidence: OIDC permission is scoped');
  matches(workflow, /uses: actions\/attest@[0-9a-f]{40}/u, 'Hosted release provenance SLSA evidence: attest action is SHA-pinned');
  ok(
    (workflow.match(/uses: actions\/attest@[0-9a-f]{40}/gu) ?? []).length >= 2,
    'Hosted release provenance SLSA evidence: build provenance and SBOM attestations are separate steps',
  );
  includes(workflow, 'name: Attest release evaluation artifact provenance', 'Hosted release provenance SLSA evidence: provenance attestation step is explicit');
  includes(workflow, 'name: Attest release evaluation artifact SBOM', 'Hosted release provenance SLSA evidence: SBOM attestation step is explicit');
  includes(workflow, 'subject-path: .attestor/release-provenance/evaluation-artifacts.tar.gz', 'Hosted release provenance SLSA evidence: archive subject is attested');
  includes(workflow, 'sbom-path: .attestor/release-provenance/sbom.cyclonedx.json', 'Hosted release provenance SLSA evidence: CycloneDX SBOM is bound to the attestation');
  includes(workflow, 'npm run proof:surface', 'Hosted release provenance SLSA evidence: proof surface is rendered');
  includes(workflow, 'npm run showcase:proof', 'Hosted release provenance SLSA evidence: proof showcase is rendered');
  includes(workflow, 'image: postgres:16-alpine@sha256:', 'Hosted release provenance SLSA evidence: proof showcase uses a digest-pinned PostgreSQL service in CI');
  includes(workflow, 'ATTESTOR_PG_URL: postgres://attestor:attestor@localhost:5432/attestor_proof', 'Hosted release provenance SLSA evidence: proof showcase uses configured PostgreSQL in CI');
  includes(workflow, 'ATTESTOR_PG_ALLOWED_SCHEMAS: attestor_demo', 'Hosted release provenance SLSA evidence: proof showcase keeps demo schema allowlist explicit');
  includes(workflow, 'npm run sbom:cyclonedx', 'Hosted release provenance SLSA evidence: SBOM is generated');
  includes(workflow, 'npm run check:public-artifacts-redaction', 'Hosted release provenance SLSA evidence: generated release artifacts are redaction-scanned before upload');
  includes(workflow, '.attestor/release-provenance/sbom.cyclonedx.json', 'Hosted release provenance SLSA evidence: SBOM is packaged');
  excludes(workflow, /showcase:proof:hybrid/iu, 'Hosted release provenance SLSA evidence: release archive stays offline-capable');
  excludes(smoke, /attestations:\s*write|id-token:\s*write/iu, 'Hosted release provenance SLSA evidence: smoke workflow remains read-only');
  excludes(verify, /attestations:\s*write|id-token:\s*write/iu, 'Hosted release provenance SLSA evidence: full verify workflow remains read-only');
  excludes(securityScan, /attestations:\s*write|id-token:\s*write/iu, 'Hosted release provenance SLSA evidence: security scan workflow remains read-only');
  includes(plan, 'SLSA v1.2-aligned release provenance', 'Hosted release provenance SLSA docs: plan names SLSA alignment');
  includes(plan, 'does not claim full production supply-chain provenance', 'Hosted release provenance SLSA docs: plan avoids production overclaim');
  includes(plan, '--signer-workflow AI-gateway-systems/attestor/.github/workflows/release-provenance.yml', 'Hosted release provenance SLSA docs: verifier pins signer workflow');
  includes(productionRehearsal, 'gh attestation verify .attestor/rehearsal/release-provenance/evaluation-artifacts.tar.gz', 'Hosted release provenance SLSA evidence: rehearsal verifies release artifact provenance');
  includes(productionRehearsal, '--signer-workflow AI-gateway-systems/attestor/.github/workflows/release-provenance.yml', 'Hosted release provenance SLSA evidence: rehearsal pins signer workflow');
}

function testSupplyChainAndPackageSurfaceEvidence(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const baseline = readProjectFile('scripts', 'check', 'check-supply-chain-baseline.mjs');
  const securityScan = readProjectFile('.github', 'workflows', 'security-scan.yml');
  const runner = readProjectFile('scripts', 'run', 'run-suite.mjs');
  const packageRunnerTest = readProjectFile('tests', 'package-script-runner.test.ts');
  const securityPolicy = readProjectFile('SECURITY.md');

  equal(
    packageJson.scripts['test:hosted-release-provenance-slsa-alignment'],
    'tsx tests/hosted-release-provenance-slsa-alignment.test.ts',
    'Hosted release provenance SLSA: package script is exposed',
  );
  includes(packageJson.scripts['sbom:cyclonedx'], 'npm sbom', 'Hosted release provenance SLSA evidence: SBOM script uses npm sbom');
  equal(
    packageJson.scripts['security:supply-chain-baseline'],
    'node scripts/check/check-supply-chain-baseline.mjs',
    'Hosted release provenance SLSA evidence: supply-chain baseline is exposed',
  );
  equal(
    packageJson.scripts['security:audit-high'],
    'npm audit --audit-level=high',
    'Hosted release provenance SLSA evidence: high/critical audit gate is exposed',
  );
  includes(baseline, 'Non-registry dependency resolution is not allowed', 'Hosted release provenance SLSA evidence: registry dependency resolution is gated');
  includes(baseline, 'sha512 integrity metadata', 'Hosted release provenance SLSA evidence: registry integrity metadata is gated');
  includes(baseline, 'GitHub Actions by full commit SHA', 'Hosted release provenance SLSA evidence: GitHub Actions are SHA-pinned');
  includes(baseline, 'release-provenance.yml must generate and package a CycloneDX SBOM', 'Hosted release provenance SLSA evidence: release SBOM packaging is gated');
  includes(securityScan, 'npm run security:supply-chain-baseline', 'Hosted release provenance SLSA evidence: security scan runs baseline');
  includes(securityScan, 'npm run security:audit-high', 'Hosted release provenance SLSA evidence: security scan runs audit gate');
  includes(runner, 'shellCommand(\'build\', \'npm run build\')', 'Hosted release provenance SLSA evidence: verify runner builds before probes');
  includes(runner, 'isPackageSurfaceProbe', 'Hosted release provenance SLSA evidence: package surface probes are categorized');
  includes(packageRunnerTest, 'test:hosted-release-provenance-slsa-alignment', 'Hosted release provenance SLSA evidence: fast suite includes this guard');
  includes(packageRunnerTest, 'runs after build', 'Hosted release provenance SLSA evidence: package probes run after build');
  includes(securityPolicy, 'Release provenance artifacts include a CycloneDX SBOM', 'Hosted release provenance SLSA docs: security policy names SBOM evidence');
}

function testProofPacketBindingEvidence(): void {
  const canonicalization = readProjectFile('src', 'release-kernel', 'release-canonicalization.ts');
  const evidencePack = [
    readProjectFile('src', 'release-kernel', 'release-evidence-pack.ts'),
    readProjectFile('src', 'release-kernel', 'release-evidence-pack-types.ts'),
    readProjectFile('src', 'release-kernel', 'release-evidence-pack-dsse.ts'),
    readProjectFile('src', 'release-kernel', 'release-evidence-pack-verification.ts'),
  ].join('\n');
  const tamperHistory = readProjectFile('src', 'consequence-admission', 'tamper-evident-history.ts');
  const auditExport = readProjectFile('src', 'consequence-admission', 'audit-evidence-export.ts');
  const externalReview = readProjectFile('src', 'consequence-admission', 'external-review-packet.ts');
  const evidencePackTest = readProjectFile('tests', 'release-kernel-release-evidence-pack.test.ts');
  const historyTest = readProjectFile('tests', 'consequence-tamper-evident-history.test.ts');

  includes(canonicalization, 'canonicalizeReleaseJson', 'Hosted release provenance SLSA evidence: release JSON canonicalization exists');
  includes(canonicalization, 'sha256:', 'Hosted release provenance SLSA evidence: release hashes are tagged');
  includes(evidencePack, 'application/vnd.in-toto+json', 'Hosted release provenance SLSA evidence: release evidence uses in-toto payload type');
  includes(evidencePack, 'https://in-toto.io/Statement/v1', 'Hosted release provenance SLSA evidence: release evidence exports Statement v1');
  includes(evidencePack, 'DSSEv1', 'Hosted release provenance SLSA evidence: release evidence uses DSSE PAE');
  includes(evidencePack, 'assertSubjectDigestMatches', 'Hosted release provenance SLSA evidence: subject digest binding is verified');
  includes(tamperHistory, 'linear-hash-chain', 'Hosted release provenance SLSA evidence: tamper history is hash-chain based');
  includes(tamperHistory, 'rawPayloadStored: false', 'Hosted release provenance SLSA evidence: tamper history avoids raw payload storage');
  includes(auditExport, 'artifactDigests', 'Hosted release provenance SLSA evidence: audit export preserves artifact digests');
  includes(externalReview, 'supply-chain-baseline', 'Hosted release provenance SLSA evidence: external review packet names supply-chain evidence');
  includes(evidencePackTest, 'output subject digest binds to the release output hash', 'Hosted release provenance SLSA validation: output subject digest is tested');
  includes(evidencePackTest, 'tampered DSSE envelope is rejected', 'Hosted release provenance SLSA validation: DSSE tampering is rejected');
  includes(historyTest, 'source-conflict', 'Hosted release provenance SLSA validation: tamper history conflicts are tested');
}

function testDocsAndRunnerExposeAlignment(): void {
  const tracker = readProjectFile('docs', '02-architecture', 'hosted-production-trust-hardening.md');
  const hostedContract = readProjectFile('docs', '01-overview', 'hosted-journey-contract.md');
  const productionReadiness = readProjectFile('docs', '08-deployment', 'production-readiness.md');

  includes(
    tracker,
    'Release Provenance And SLSA Alignment',
    'Hosted release provenance SLSA docs: tracker records Step 06',
  );
  includes(
    tracker,
    'src/service/hosted/hosted-release-provenance-slsa-alignment.ts',
    'Hosted release provenance SLSA docs: tracker points to source',
  );
  includes(
    hostedContract,
    'machine-readable release provenance and SLSA alignment profile',
    'Hosted release provenance SLSA docs: hosted contract links machine-readable profile',
  );
  includes(
    productionReadiness,
    'Release provenance and SLSA alignment profile',
    'Hosted release provenance SLSA docs: production readiness names the alignment profile',
  );
}

testProfileDescriptor();
testEveryGuardIsCompleteAndSecretSafe();
testControlContractsForCriticalBoundaries();
testReleaseWorkflowAndAttestationPlanMatchContract();
testSupplyChainAndPackageSurfaceEvidence();
testProofPacketBindingEvidence();
testDocsAndRunnerExposeAlignment();

console.log(`Hosted release provenance SLSA alignment tests: ${passed} passed, 0 failed`);
