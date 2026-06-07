import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function includesNormalized(value: string, expected: string, message: string): void {
  const normalized = value.replace(/\s+/gu, ' ');
  assert.ok(
    normalized.includes(expected),
    `${message}\nExpected to find normalized: ${expected}`,
  );
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function testRuntimeSignalBoundaryIsExplicit(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-signal-handling.md',
  );

  includes(doc, 'Runtime Signal Handling', 'Runtime signal doc: title exists');
  includes(
    doc,
    'They help Attestor see. They do not authorize.',
    'Runtime signal doc: no-authority principle is explicit',
  );
  includesNormalized(
    doc,
    'does not change admission behavior',
    'Runtime signal doc: admission behavior no-change is explicit',
  );
  includes(
    doc,
    'admission + customer-owned gate + proof -> execution path',
    'Runtime signal doc: execution path requires admission, gate, and proof',
  );
  includesNormalized(
    doc,
    'A runtime signal can support review, mapping, and proof packaging.',
    'Runtime signal doc: allowed use is review and proof packaging input',
  );
  includesNormalized(
    doc,
    'It cannot grant authority, replace admission, or make a downstream action executable by itself.',
    'Runtime signal doc: signal cannot execute by itself',
  );
}

function testFourSignalKindsStaySeparated(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-signal-handling.md',
  );

  includes(doc, '`declaration`', 'Runtime signal doc: declaration signal kind exists');
  includes(doc, '`observation`', 'Runtime signal doc: observation signal kind exists');
  includes(doc, '`proposed-action`', 'Runtime signal doc: proposed-action signal kind exists');
  includes(doc, '`enforcement-proof`', 'Runtime signal doc: enforcement-proof signal kind exists');
  includesNormalized(
    doc,
    'A route declaration, an observed span, a proposed export, and a PEP receipt are different evidence classes.',
    'Runtime signal doc: signal classes are not collapsed',
  );
  includesNormalized(
    doc,
    'If they are merged into one generic "signal", Attestor can create false confidence.',
    'Runtime signal doc: false-confidence risk is documented',
  );
}

function testExistingPathAndRawDataBoundaryAreLocked(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-signal-handling.md',
  );

  includes(doc, 'Action Surface Auto-Context', 'Runtime signal doc: Auto-Context path is named');
  includes(doc, 'Action Surface Onboarding Packet', 'Runtime signal doc: onboarding packet path is named');
  includes(doc, 'Integration Kit review files', 'Runtime signal doc: Integration Kit path is named');
  includes(doc, 'Integration Mode Readiness', 'Runtime signal doc: readiness path is named');
  includes(doc, '`canGrantAuthority: false`', 'Runtime signal doc: Auto-Context cannot grant authority');
  includes(doc, '`readsRawPayload: false`', 'Runtime signal doc: raw-payload boundary is named');
  includes(doc, '`canAdmit: false`', 'Runtime signal doc: extractor cannot admit');
  includes(doc, '`LP-CUSTOMER-PEP-NO-BYPASS`', 'Runtime signal doc: customer PEP live proof remains open');
  includesNormalized(
    doc,
    'raw prompts, raw tool arguments, raw provider bodies',
    'Runtime signal doc: raw data exclusions are explicit',
  );
}

function testRs02EnvelopeAndNonClaimsStayNarrow(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-signal-handling.md',
  );
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(doc, 'RS02 Minimal Envelope', 'Runtime signal doc: next-step envelope is scoped');
  includes(doc, 'src/consequence-admission/runtime-signal-envelope.ts', 'Runtime signal doc: RS02 implementation path is named');
  includes(doc, 'attestor.runtime-signal-envelope.v1', 'Runtime signal doc: RS02 contract version is named');
  includes(doc, 'RS03 Source Binding', 'Runtime signal doc: RS03 source binding section is named');
  includes(doc, 'src/consequence-admission/runtime-signal-source-binding.ts', 'Runtime signal doc: RS03 implementation path is named');
  includes(doc, 'attestor.runtime-signal-source-binding.v1', 'Runtime signal doc: RS03 contract version is named');
  includes(doc, 'RS04 Normalizer Layer', 'Runtime signal doc: RS04 normalizer section is named');
  includes(doc, 'src/consequence-admission/runtime-signal-normalizer.ts', 'Runtime signal doc: RS04 implementation path is named');
  includes(doc, 'attestor.runtime-signal-normalizer.v1', 'Runtime signal doc: RS04 contract version is named');
  includes(doc, 'RS05 Consequence Mapping', 'Runtime signal doc: RS05 consequence mapping section is named');
  includes(doc, 'src/consequence-admission/runtime-signal-consequence-mapping.ts', 'Runtime signal doc: RS05 implementation path is named');
  includes(doc, 'attestor.runtime-signal-consequence-mapping.v1', 'Runtime signal doc: RS05 contract version is named');
  includes(doc, 'RS06 Auto-Context Bridge', 'Runtime signal doc: RS06 auto-context bridge section is named');
  includes(doc, 'src/consequence-admission/action-surface-auto-context.ts', 'Runtime signal doc: RS06 implementation path is named');
  includes(doc, 'attestor.action-surface-runtime-signal-bridge.v1', 'Runtime signal doc: RS06 bridge version is named');
  includes(doc, 'RS07 Signal Authority Guard', 'Runtime signal doc: RS07 authority guard section is named');
  includes(doc, 'src/consequence-admission/runtime-signal-authority-guard.ts', 'Runtime signal doc: RS07 implementation path is named');
  includes(doc, 'attestor.runtime-signal-authority-guard.v1', 'Runtime signal doc: RS07 guard version is named');
  includesNormalized(
    doc,
    'observation cannot admit, telemetry cannot grant authority, metadata cannot mark an action safe',
    'Runtime signal doc: RS07 authority boundary is explicit',
  );
  includes(doc, 'RS08 Integration Readiness Bridge', 'Runtime signal doc: RS08 readiness bridge section is named');
  includes(doc, 'src/consequence-admission/runtime-signal-integration-readiness-bridge.ts', 'Runtime signal doc: RS08 implementation path is named');
  includes(doc, 'attestor.runtime-signal-integration-readiness-bridge.v1', 'Runtime signal doc: RS08 bridge version is named');
  includesNormalized(
    doc,
    'It cannot infer credential isolation from a signal, claim no-bypass from metadata, deploy a gate',
    'Runtime signal doc: RS08 no-overclaim boundary is explicit',
  );
  includes(doc, 'signalKind', 'Runtime signal doc: envelope includes signal kind');
  includes(doc, 'sourceSystem', 'Runtime signal doc: envelope includes source system');
  includes(doc, 'tenantRefDigest', 'Runtime signal doc: envelope includes tenant digest');
  includes(doc, 'actorRefDigest', 'Runtime signal doc: envelope includes actor digest');
  includes(doc, 'argumentOrBodyDigest', 'Runtime signal doc: envelope includes argument/body digest');
  includes(doc, 'signalDigest', 'Runtime signal doc: envelope includes signal digest');
  includes(doc, '`runtime signal != authority`', 'Runtime signal doc: runtime signal no-claim is explicit');
  includes(doc, '`metadata != proof`', 'Runtime signal doc: metadata no-claim is explicit');
  includes(doc, '`telemetry != admission`', 'Runtime signal doc: telemetry no-claim is explicit');
  includes(doc, '`generated gate plan != deployed gate`', 'Runtime signal doc: gate-plan no-claim is explicit');
  includes(doc, '`PEP receipt != production readiness`', 'Runtime signal doc: PEP receipt no-claim is explicit');
  equal(
    pkg.scripts['test:runtime-signal-handling-doc'],
    'tsx tests/runtime-signal-handling-doc.test.ts',
    'package.json exposes runtime signal handling doc test',
  );
  equal(
    pkg.scripts['test:runtime-signal-envelope'],
    'tsx tests/runtime-signal-envelope.test.ts',
    'package.json exposes runtime signal envelope test',
  );
  equal(
    pkg.scripts['test:runtime-signal-authority-guard'],
    'tsx tests/runtime-signal-authority-guard.test.ts',
    'package.json exposes runtime signal authority guard test',
  );
  equal(
    pkg.scripts['test:runtime-signal-source-binding'],
    'tsx tests/runtime-signal-source-binding.test.ts',
    'package.json exposes runtime signal source binding test',
  );
  equal(
    pkg.scripts['test:runtime-signal-normalizer'],
    'tsx tests/runtime-signal-normalizer.test.ts',
    'package.json exposes runtime signal normalizer test',
  );
  equal(
    pkg.scripts['test:runtime-signal-consequence-mapping'],
    'tsx tests/runtime-signal-consequence-mapping.test.ts',
    'package.json exposes runtime signal consequence mapping test',
  );
  equal(
    pkg.scripts['test:runtime-signal-integration-readiness-bridge'],
    'tsx tests/runtime-signal-integration-readiness-bridge.test.ts',
    'package.json exposes runtime signal integration readiness bridge test',
  );
}

function testResearchAnchorsAreOfficialAndNoModelNamesLeak(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-signal-handling.md',
  );
  const forbiddenModelNamePattern = new RegExp(
    `\\b(${
      [
        ['Co', 'dex'].join(''),
        ['G', 'PT'].join(''),
        ['Clau', 'de'].join(''),
        ['Op', 'us'].join(''),
      ].join('|')
    })\\b`,
    'u',
  );

  includes(doc, 'OpenAPI 3.1.1', 'Runtime signal doc: OpenAPI anchor is present');
  includes(doc, 'AsyncAPI 3.0.0', 'Runtime signal doc: AsyncAPI anchor is present');
  includes(doc, 'MCP tools', 'Runtime signal doc: MCP anchor is present');
  includes(doc, 'CloudEvents', 'Runtime signal doc: CloudEvents anchor is present');
  includes(doc, 'OpenTelemetry Logs Data Model', 'Runtime signal doc: OTel anchor is present');
  includes(doc, 'W3C Trace Context', 'Runtime signal doc: trace context anchor is present');
  includes(doc, 'Envoy ext_authz', 'Runtime signal doc: Envoy anchor is present');
  includes(doc, 'Istio external authorization', 'Runtime signal doc: Istio anchor is present');
  includes(doc, 'Gateway API ExternalAuth', 'Runtime signal doc: Gateway API anchor is present');
  includes(doc, 'RFC 8785 JSON Canonicalization', 'Runtime signal doc: canonicalization anchor is present');
  includes(doc, 'RFC 9421 HTTP Message Signatures', 'Runtime signal doc: HTTP signatures anchor is present');
  includes(doc, 'RFC 9449 DPoP', 'Runtime signal doc: DPoP anchor is present');
  includes(doc, 'OWASP GenAI LLM06 Excessive Agency', 'Runtime signal doc: OWASP anchor is present');
  includes(doc, 'NIST SP 800-207 Zero Trust', 'Runtime signal doc: Zero Trust anchor is present');
  includes(doc, 'OPA decision logs', 'Runtime signal doc: OPA decision log anchor is present');
  includes(doc, 'Kubernetes admission control', 'Runtime signal doc: Kubernetes admission anchor is present');
  includes(doc, 'NIST AI RMF 1.0', 'Runtime signal doc: NIST AI RMF anchor is present');
  excludes(doc, forbiddenModelNamePattern, 'Runtime signal doc: no model or tool names are used');
  excludes(
    doc,
    /runtime signal grants authority|runtime signal proves production readiness/iu,
    'Runtime signal doc: overclaim phrases are absent',
  );
}

try {
  testRuntimeSignalBoundaryIsExplicit();
  testFourSignalKindsStaySeparated();
  testExistingPathAndRawDataBoundaryAreLocked();
  testRs02EnvelopeAndNonClaimsStayNarrow();
  testResearchAnchorsAreOfficialAndNoModelNamesLeak();
  console.log(`Runtime signal handling doc tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Runtime signal handling doc tests failed:', error);
  process.exitCode = 1;
}
