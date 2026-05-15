import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function projectPath(...segments: string[]): string {
  return join(process.cwd(), ...segments);
}

function projectRef(...segments: string[]): string {
  return segments.join('/');
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(projectPath(...segments), 'utf8').replace(/\r\n/gu, '\n');
}

function listMarkdownFiles(...segments: string[]): readonly string[] {
  return readdirSync(projectPath(...segments))
    .filter((fileName) => fileName.endsWith('.md'))
    .sort();
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

function ledger(): string {
  return readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
}

function testLedgerIndexesAllResearchNotes(): void {
  const content = ledger();

  for (const fileName of listMarkdownFiles('docs', 'research')) {
    if (fileName === 'attestor-research-provenance-ledger.md') {
      continue;
    }

    includes(
      content,
      projectRef('docs', 'research', fileName),
      `Research provenance ledger: indexed research note ${fileName}`,
    );
  }
}

function testLedgerIndexesArchitectureResearchTrackers(): void {
  const content = ledger();

  for (const fileName of listMarkdownFiles('docs', '02-architecture')) {
    const tracker = readProjectFile('docs', '02-architecture', fileName);
    if (!/research anchors?/iu.test(tracker)) {
      continue;
    }

    includes(
      content,
      projectRef('docs', '02-architecture', fileName),
      `Research provenance ledger: indexed architecture research tracker ${fileName}`,
    );
  }
}

function testLedgerIndexesHostedAuditEvidence(): void {
  includes(
    ledger(),
    'docs/01-overview/hosted-product-flow-audit.md',
    'Research provenance ledger: indexed hosted product flow audit evidence',
  );
}

function testLedgerIndexesAuditRemediationClosure(): void {
  const content = ledger();

  includes(
    content,
    '### 18. F1-F5 Audit Remediation Closure',
    'Research provenance ledger: final F1-F5 closure entry is present',
  );
  includes(
    content,
    'PR #326 merge commit `7029ea2afeec41a3afe29b9359dbdf2f844bfc99`',
    'Research provenance ledger: PR #326 merge evidence is recorded',
  );
  includes(
    content,
    'PR #327 merge commit `e4bca21903df7dd7ce144aefc5c7aebc559387e8`',
    'Research provenance ledger: PR #327 merge evidence is recorded',
  );
  includes(
    content,
    'docs/audit/final-claim-alignment-validation.md',
    'Research provenance ledger: final claim-alignment doc is indexed',
  );
  includes(
    content,
    'tests/final-claim-alignment-validation.test.ts',
    'Research provenance ledger: final claim-alignment test is indexed',
  );
  includes(
    content,
    'does not prove external compliance certification',
    'Research provenance ledger: final closure keeps certification non-claim explicit',
  );
  includes(
    content,
    '### 19. F8 Operational Resilience Audit Closure',
    'Research provenance ledger: F8 closure entry is present',
  );
  includes(
    content,
    'docs/audit/f8-operational-resilience-validation.md',
    'Research provenance ledger: F8 validation doc is indexed',
  );
  includes(
    content,
    'tests/f8-operational-resilience-validation.test.ts',
    'Research provenance ledger: F8 validation test is indexed',
  );
  includes(
    content,
    'does not prove a live Kubernetes deployment',
    'Research provenance ledger: F8 closure keeps live deployment non-claim explicit',
  );
  includes(
    content,
    '### 20. F9 Compliance Gap Analysis Closure',
    'Research provenance ledger: F9 closure entry is present',
  );
  includes(
    content,
    'docs/audit/f9-compliance-gap-validation.md',
    'Research provenance ledger: F9 validation doc is indexed',
  );
  includes(
    content,
    'tests/f9-compliance-gap-validation.test.ts',
    'Research provenance ledger: F9 validation test is indexed',
  );
  includes(
    content,
    'does not prove SOC 2 Type I/II assurance',
    'Research provenance ledger: F9 closure keeps assurance non-claim explicit',
  );
  includes(
    content,
    'ISO/IEC 42001:2023',
    'Research provenance ledger: F9 ISO 42001 anchor is recorded',
  );
  includes(
    content,
    '### 21. F10 Customer Escape-Hatch Abuse Closure',
    'Research provenance ledger: F10 closure entry is present',
  );
  includes(
    content,
    'docs/audit/f10-escape-hatch-validation.md',
    'Research provenance ledger: F10 validation doc is indexed',
  );
  includes(
    content,
    'tests/f10-escape-hatch-validation.test.ts',
    'Research provenance ledger: F10 validation test is indexed',
  );
  includes(
    content,
    'does not prove persisted SIEM/admin reporting',
    'Research provenance ledger: F10 closure keeps live reporting non-claim explicit',
  );
  includes(
    content,
    '### 22. F11 Supply Chain Depth Closure',
    'Research provenance ledger: F11 closure entry is present',
  );
  includes(
    content,
    'docs/audit/f11-supply-chain-depth-validation.md',
    'Research provenance ledger: F11 validation doc is indexed',
  );
  includes(
    content,
    'tests/f11-supply-chain-depth-validation.test.ts',
    'Research provenance ledger: F11 validation test is indexed',
  );
  includes(
    content,
    'does not prove multi-provider LLM failover',
    'Research provenance ledger: F11 closure keeps live provider-resilience non-claim explicit',
  );
  includes(
    content,
    'NIST SP 800-161 Rev. 1',
    'Research provenance ledger: F11 supply-chain anchor is recorded',
  );
  includes(
    content,
    '### 23. F12 Continuous Red-Team Automation Closure',
    'Research provenance ledger: F12 closure entry is present',
  );
  includes(
    content,
    'docs/audit/f12-continuous-red-team-validation.md',
    'Research provenance ledger: F12 validation doc is indexed',
  );
  includes(
    content,
    'tests/f12-continuous-red-team-validation.test.ts',
    'Research provenance ledger: F12 validation test is indexed',
  );
  includes(
    content,
    'tests/f12-canonicalizer-fuzz-smoke.test.ts',
    'Research provenance ledger: F12 fuzz smoke test is indexed',
  );
  includes(
    content,
    'does not prove AgentDojo benchmark execution',
    'Research provenance ledger: F12 external benchmark non-claim is explicit',
  );
  includes(
    content,
    'ISO/IEC 29147',
    'Research provenance ledger: F12 coordinated disclosure anchor is recorded',
  );
  includes(
    content,
    '### 24. LLM Provider Registry Contract',
    'Research provenance ledger: LLM provider registry entry is present',
  );
  includes(
    content,
    'src/api/llm-provider-registry.ts',
    'Research provenance ledger: LLM provider registry code evidence is indexed',
  );
  includes(
    content,
    'tests/llm-provider-registry.test.ts',
    'Research provenance ledger: LLM provider registry test evidence is indexed',
  );
  includes(
    content,
    'tests/openai-runtime-policy.test.ts',
    'Research provenance ledger: OpenAI runtime policy test evidence is indexed',
  );
  includes(
    content,
    'scripts/probe-openai-live-smoke.ts',
    'Research provenance ledger: OpenAI live smoke probe evidence is indexed',
  );
  includes(
    content,
    'tests/openai-live-smoke-proof.test.ts',
    'Research provenance ledger: OpenAI live smoke proof test evidence is indexed',
  );
  includes(
    content,
    'does not prove Anthropic, Vertex AI, or Azure OpenAI calls',
    'Research provenance ledger: LLM provider live-client non-claim is explicit',
  );
  includes(
    content,
    '### 25. Tenant Signer Live Provider Proof Gate',
    'Research provenance ledger: tenant signer live proof entry is present',
  );
  includes(
    content,
    'src/service/bootstrap/release-tenant-signer-boundary.ts',
    'Research provenance ledger: tenant signer proof gate code evidence is indexed',
  );
  includes(
    content,
    'tests/production-tenant-signer-boundary.test.ts',
    'Research provenance ledger: tenant signer proof gate test evidence is indexed',
  );
  includes(
    content,
    'AWS KMS asymmetric keys and Sign API',
    'Research provenance ledger: tenant signer proof gate AWS KMS anchor is recorded',
  );
  includes(
    content,
    'This is not a live AWS, Google Cloud, Azure, HSM, or confidential-compute signer adapter.',
    'Research provenance ledger: tenant signer live adapter non-claim is explicit',
  );
  includes(
    content,
    '### 26. Signed Bearer Customer Gate',
    'Research provenance ledger: signed bearer customer gate entry is present',
  );
  includes(
    content,
    'src/consequence-admission/customer-gate.ts',
    'Research provenance ledger: signed bearer customer gate code evidence is indexed',
  );
  includes(
    content,
    'tests/consequence-admission-customer-gate.test.ts',
    'Research provenance ledger: signed bearer customer gate test evidence is indexed',
  );
  includes(
    content,
    'OAuth 2.0 Bearer Token Usage RFC 6750',
    'Research provenance ledger: signed bearer customer gate bearer-token anchor is recorded',
  );
  includes(
    content,
    'This is bearer-only compatibility for lower-risk customer integrations.',
    'Research provenance ledger: signed bearer customer gate non-claim is explicit',
  );
  includes(
    content,
    '### 27. Tenant KMS Provider Capability Contract',
    'Research provenance ledger: tenant KMS provider capability entry is present',
  );
  includes(
    content,
    'provider-native algorithm and input-mode contract',
    'Research provenance ledger: tenant KMS capability contract scope is indexed',
  );
  includes(
    content,
    'Azure Key Vault Ed25519',
    'Research provenance ledger: unsupported Azure Ed25519 boundary is recorded',
  );
  includes(
    content,
    'signature-format conversion',
    'Research provenance ledger: tenant KMS capability remaining adapter limitation is explicit',
  );
  includes(
    content,
    '### 28. Consequence Shared-Store Request Guard',
    'Research provenance ledger: consequence shared-store guard entry is present',
  );
  includes(
    content,
    'src/service/bootstrap/production-shared-request-guard.ts',
    'Research provenance ledger: consequence shared-store guard code evidence is indexed',
  );
  includes(
    content,
    'tests/production-shared-request-guard.test.ts',
    'Research provenance ledger: consequence shared-store guard test evidence is indexed',
  );
  includes(
    content,
    'Debezium Outbox Event Router',
    'Research provenance ledger: consequence shared-store outbox anchor is recorded',
  );
  includes(
    content,
    'This is not a shared durable backend implementation.',
    'Research provenance ledger: consequence shared-store backend non-claim is explicit',
  );
  includes(
    content,
    '### 29. LLM Provider Failover Compatibility Gate',
    'Research provenance ledger: LLM failover compatibility entry is present',
  );
  includes(
    content,
    'llm-provider-compatible-failover-provider-not-ready',
    'Research provenance ledger: LLM compatible fallback blocker is recorded',
  );
  includes(
    content,
    'same requested purpose',
    'Research provenance ledger: LLM fallback same-purpose requirement is recorded',
  );
  includes(
    content,
    'tests/f2-llm-provider-supply-chain-validation.test.ts',
    'Research provenance ledger: LLM fallback validation test evidence is indexed',
  );
  includes(
    content,
    'This is still not a live multi-provider client implementation.',
    'Research provenance ledger: LLM live failover non-claim is explicit',
  );
  includes(
    content,
    '### 30. Customer Gate Release-Enforcement Proof Consumer',
    'Research provenance ledger: customer gate release-enforcement entry is present',
  );
  includes(
    content,
    'OAuth Token Introspection RFC 7662',
    'Research provenance ledger: customer gate release-enforcement introspection anchor is recorded',
  );
  includes(
    content,
    'src/release-enforcement-plane/online-verifier.ts',
    'Research provenance ledger: customer gate release-enforcement code evidence is indexed',
  );
  includes(
    content,
    'tests/f2-customer-gate-validation.test.ts',
    'Research provenance ledger: customer gate release-enforcement validation test evidence is indexed',
  );
  includes(
    content,
    'This is not a customer PEP runtime',
    'Research provenance ledger: customer gate release-enforcement runtime non-claim is explicit',
  );
  includes(
    content,
    '### 31. Generic Admission Protected Release-Token Issuance',
    'Research provenance ledger: generic protected release-token entry is present',
  );
  includes(
    content,
    'OAuth Token Exchange RFC 8693',
    'Research provenance ledger: generic protected release-token token-exchange anchor is recorded',
  );
  includes(
    content,
    'src/consequence-admission/generic-protected-release-token.ts',
    'Research provenance ledger: generic protected release-token code evidence is indexed',
  );
  includes(
    content,
    'tests/generic-admission-protected-release-token.test.ts',
    'Research provenance ledger: generic protected release-token test evidence is indexed',
  );
  includes(
    content,
    'Standalone route imports can still choose compatibility behavior',
    'Research provenance ledger: generic protected release-token runtime limitation is explicit',
  );
  includes(
    content,
    '### 32. Customer PEP Runtime Adoption Proof',
    'Research provenance ledger: customer PEP runtime adoption entry is present',
  );
  includes(
    content,
    'src/consequence-admission/customer-pep-runtime-adoption.ts',
    'Research provenance ledger: customer PEP runtime adoption code evidence is indexed',
  );
  includes(
    content,
    'tests/customer-pep-runtime-adoption.test.ts',
    'Research provenance ledger: customer PEP runtime adoption test evidence is indexed',
  );
  includes(
    content,
    'Envoy external authorization filter delegates HTTP authorization checks',
    'Research provenance ledger: customer PEP runtime adoption Envoy anchor is recorded',
  );
  includes(
    content,
    'This is not a deployed customer PEP',
    'Research provenance ledger: customer PEP runtime adoption live deployment non-claim is explicit',
  );
  includes(
    content,
    '### 33. Hosted Generic Admission Protected Route Guard',
    'Research provenance ledger: hosted generic protected route guard entry is present',
  );
  includes(
    content,
    'src/service/generic-admission-protected-route.ts',
    'Research provenance ledger: hosted generic protected route guard code evidence is indexed',
  );
  includes(
    content,
    'tests/generic-admission-protected-route.test.ts',
    'Research provenance ledger: hosted generic protected route guard test evidence is indexed',
  );
  includes(
    content,
    'Envoy external authorization failure-mode documentation',
    'Research provenance ledger: hosted generic protected route guard fail-closed anchor is recorded',
  );
  includes(
    content,
    'without an issuer, the route fails closed instead of returning a compatibility admission',
    'Research provenance ledger: hosted generic protected route guard behavior is recorded',
  );
  includes(
    content,
    'This is not a live authorization server',
    'Research provenance ledger: hosted generic protected route guard live auth-server non-claim is explicit',
  );
}

function testLedgerKeepsEvidenceBoundaryExplicit(): void {
  const content = ledger();

  includes(
    content,
    'It is not a certification, not an independent external audit, and not a claim of full production readiness.',
    'Research provenance ledger: opening disclaimer stays explicit',
  );
  includes(
    content,
    'It does not invent sources.',
    'Research provenance ledger: source non-invention rule stays explicit',
  );
  includes(
    content,
    'not expanded rather than invented',
    'Research provenance ledger: source-to-commit attribution gaps stay explicit',
  );
  excludes(content, /\bproduction-ready\b/iu, 'Research provenance ledger: avoids production-ready claim language');
  excludes(content, /\bsale-ready\b/iu, 'Research provenance ledger: avoids sale-ready claim language');
  excludes(content, /\bpurchasable\b/iu, 'Research provenance ledger: avoids purchasable claim language');
}

function testLedgerDoesNotExposeLiveSecrets(): void {
  const content = ledger();

  excludes(content, /rk_live_/u, 'Research provenance ledger: no live restricted key prefix');
  excludes(content, /sk_live_/u, 'Research provenance ledger: no live secret key prefix');
  excludes(content, /whsec_/u, 'Research provenance ledger: no webhook secret prefix');
  excludes(content, /STRIPE_API_KEY\s*=/u, 'Research provenance ledger: no assigned Stripe API key');
  excludes(content, /STRIPE_WEBHOOK_SECRET\s*=/u, 'Research provenance ledger: no assigned Stripe webhook secret');
}

testLedgerIndexesAllResearchNotes();
testLedgerIndexesArchitectureResearchTrackers();
testLedgerIndexesHostedAuditEvidence();
testLedgerIndexesAuditRemediationClosure();
testLedgerKeepsEvidenceBoundaryExplicit();
testLedgerDoesNotExposeLiveSecrets();

console.log(`Research provenance ledger tests: ${passed} passed, 0 failed`);
