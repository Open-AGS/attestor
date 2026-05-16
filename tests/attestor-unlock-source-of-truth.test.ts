import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

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

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function testTrackerExistsAndFreezesTheSequence(): void {
  const tracker = readProjectFile(
    'docs',
    '02-architecture',
    'attestor-unlock-source-of-truth.md',
  );

  includes(
    tracker,
    '# Attestor Unlock Source Of Truth',
    'Unlock tracker: document exists',
  );
  includes(
    tracker,
    '| Total unlock rounds | 12 |',
    'Unlock tracker: total step count is explicit',
  );
  includes(
    tracker,
    '| Complete in this tracker | 11 |',
    'Unlock tracker: current completion count is explicit',
  );
  includes(
    tracker,
    '| Remaining after this tracker | 1 |',
    'Unlock tracker: remaining count is explicit',
  );

  for (const expected of [
    '| 01 | complete | Source-of-truth tracker |',
    '| 02 | complete | External KMS/HSM provider decision |',
    '| 03 | complete | External signer contract closure |',
    '| 04 | complete | First KMS/HSM adapter PR |',
    '| 05 | complete | Protected admission end-to-end proof plan |',
    '| 06 | complete | Customer PEP adoption package |',
    '| 07 | complete | Consequence shared-store inventory |',
    '| 08 | complete | Consequence shared-store PR slice 1 |',
    '| 09 | complete | Consequence shared-store PR slice 2 |',
    '| 10 | complete | LLM provider runtime decision |',
    '| 11 | complete | Anthropic runtime PR |',
    '| 12 | planned | Production rehearsal go/no-go packet |',
  ]) {
    includes(tracker, expected, `Unlock tracker: records ${expected}`);
  }
}

function testTrackerRecordsCurrentTruthAndNoGos(): void {
  const tracker = readProjectFile(
    'docs',
    '02-architecture',
    'attestor-unlock-source-of-truth.md',
  );

  for (const expected of [
    'One AI Action Control Plane with a shared consequence-admission core and modular packs.',
    '`attestor/release-enforcement-plane` exposes Node, Hono, webhook, record-write, communication-send, action-dispatch, Envoy, and Istio enforcement surfaces; the customer PEP adoption package now combines scoped runtime proof',
    'The contract defines tenant-scoped external KMS/HSM proof requirements, fake-adapter conformance, and the first Google Cloud KMS Ed25519 sign/verify proof adapter.',
    'No live provider failover, no hosted production LLM runtime readiness, no Vertex AI or Azure OpenAI runtime',
    'Step 10 selects Anthropic Claude Messages API as the first non-OpenAI runtime adapter target, and Step 11 implements the narrow Anthropic Messages API runtime slice',
    'Do not clear `production-shared` while consequence state is evaluation-backed.',
    'Do not treat a signed bearer helper as sufficient for R3/R4 enforcement.',
    'Do not claim multi-cloud, customer custody, live GCP deployment, runtime external-KMS issuance, or customer production readiness from one adapter/probe.',
    'First adapter target: Google Cloud KMS with `EC_SIGN_ED25519` and raw signing input.',
    'Route contract: admission -> DPoP-bound release token -> introspection -> token-use replay -> customer PEP -> downstream receipt.',
    'The package combines runtime adoption proof, protected E2E proof, route coverage, no-bypass review, fail-closed config, verifier integration, health, rollback, kill switch, monitoring, audit, customer approval, activation evidence, and downstream receipt.',
    'Step 09 adds PostgreSQL-backed shared source-history and outbox primitives with append-only sequence, tenant-scope, schema, outbox, worker-claim, and advisory-lock proof digests.',
    'First non-OpenAI adapter target: Anthropic Claude Messages API for the reasoning route',
    'The adapter uses Anthropic Messages API, `claude-sonnet-4-6`, digest-only proof context',
    'Atomic retry/replay stores use tenant-scope digest, PostgreSQL `ON CONFLICT`, unique idempotency/replay indexes',
  ]) {
    includes(tracker, expected, `Unlock tracker: records boundary ${expected}`);
  }

  for (const nonClaim of [
    'production readiness',
    'external KMS/HSM custody',
    'live customer PEP deployment',
    'multi-provider LLM resilience',
    'runtime external-KMS release-token issuance',
    'completion of step 12',
  ]) {
    includes(tracker, nonClaim, `Unlock tracker: non-claim includes ${nonClaim}`);
  }

  excludes(
    tracker,
    /\bproduction-ready\b(?![\s\S]{0,80}(without|until|not|no|claim|readiness|proof))/iu,
    'Unlock tracker: does not make an unqualified production-ready claim',
  );
}

function testTrackerHasPrimaryAnchorsAndRepoLinks(): void {
  const tracker = readProjectFile(
    'docs',
    '02-architecture',
    'attestor-unlock-source-of-truth.md',
  );
  const readme = readProjectFile('README.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const researchLedger = readProjectFile(
    'docs',
    'research',
    'attestor-research-provenance-ledger.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'DPoP RFC 9449',
    'mTLS-bound tokens RFC 8705',
    'Token Introspection RFC 7662',
    'Envoy ext_authz',
    'OPA Envoy',
    'Istio custom authorization',
    'AWS KMS Sign',
    'Google Cloud KMS algorithms',
    'Azure Key Vault Sign',
    'PostgreSQL INSERT / ON CONFLICT',
    'Debezium Outbox Event Router',
    'OpenAI Structured Outputs',
    'Anthropic tool use',
    'Vertex AI structured output',
    'Azure OpenAI structured outputs',
    'NIST AI RMF',
    'OWASP Top 10 for LLM Applications',
  ]) {
    includes(tracker, expected, `Unlock tracker: primary anchor ${expected} is recorded`);
  }

  includes(
    readme,
    'docs/02-architecture/attestor-unlock-source-of-truth.md',
    'Unlock tracker: README links the tracker',
  );
  includes(
    systemOverview,
    '[Attestor unlock source of truth](attestor-unlock-source-of-truth.md)',
    'Unlock tracker: system overview links the tracker',
  );
  includes(
    researchLedger,
    'docs/02-architecture/attestor-unlock-source-of-truth.md',
    'Unlock tracker: research provenance ledger indexes the tracker',
  );
  includes(
    researchLedger,
    'docs/02-architecture/external-kms-hsm-provider-decision.md',
    'Unlock tracker: research provenance ledger indexes the KMS/HSM provider decision',
  );
  includes(
    researchLedger,
    'docs/02-architecture/external-signer-contract-closure.md',
    'Unlock tracker: research provenance ledger indexes the external signer contract closure',
  );
  includes(
    researchLedger,
    'docs/02-architecture/gcp-kms-release-signer-adapter.md',
    'Unlock tracker: research provenance ledger indexes the GCP KMS adapter',
  );
  includes(
    researchLedger,
    'docs/02-architecture/protected-admission-e2e-proof-plan.md',
    'Unlock tracker: research provenance ledger indexes the protected admission E2E proof plan',
  );
  includes(
    researchLedger,
    'docs/02-architecture/customer-pep-adoption-package.md',
    'Unlock tracker: research provenance ledger indexes the customer PEP adoption package',
  );
  includes(
    researchLedger,
    'docs/02-architecture/consequence-shared-store-inventory.md',
    'Unlock tracker: research provenance ledger indexes the consequence shared-store inventory',
  );
  includes(
    researchLedger,
    'docs/02-architecture/consequence-shared-atomic-stores.md',
    'Unlock tracker: research provenance ledger indexes the consequence shared atomic stores',
  );
  includes(
    researchLedger,
    'docs/02-architecture/consequence-shared-history-outbox-store.md',
    'Unlock tracker: research provenance ledger indexes the consequence shared history outbox store',
  );
  includes(
    researchLedger,
    'docs/02-architecture/llm-provider-runtime-decision.md',
    'Unlock tracker: research provenance ledger indexes the LLM provider runtime decision',
  );
  assert.equal(
    packageJson.scripts['test:attestor-unlock-source-of-truth'],
    'tsx tests/attestor-unlock-source-of-truth.test.ts',
    'Unlock tracker: package script is registered',
  );
  passed += 1;
}

testTrackerExistsAndFreezesTheSequence();
testTrackerRecordsCurrentTruthAndNoGos();
testTrackerHasPrimaryAnchorsAndRepoLinks();

console.log(`Attestor unlock source-of-truth tests: ${passed} passed, 0 failed`);
