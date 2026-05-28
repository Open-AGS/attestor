import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceAdmissionAdapterFrameworkDescriptor,
  consequenceAdmissionAgentLoopAbuseGuardDescriptor,
  consequenceAdmissionCorrectionCatalog,
  consequenceDataMinimizationMaterialSafetyFindings,
  consequenceDataMinimizationRedactionPolicyDescriptor,
} from '../src/consequence-admission/index.js';
import {
  HOSTED_LLM_AGENT_TOOL_BOUNDARY_GUARDS,
  HOSTED_LLM_AGENT_TOOL_BOUNDARY_GUARD_VERSION,
  hostedLlmAgentToolBoundaryGuardProfile,
  requireHostedLlmAgentToolBoundaryGuard,
  type HostedLlmAgentToolBoundaryControl,
} from '../src/service/hosted/hosted-llm-agent-tool-boundary-guard.js';

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

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function fileExists(projectPath: string): boolean {
  return existsSync(join(process.cwd(), projectPath.split('#')[0]));
}

function hasControl(id: string, control: HostedLlmAgentToolBoundaryControl): void {
  const guard = requireHostedLlmAgentToolBoundaryGuard(id);
  ok(
    guard.requiredControls.includes(control),
    `Hosted LLM/agent boundary: ${id} requires ${control}`,
  );
}

function testProfileDescriptor(): void {
  const profile = hostedLlmAgentToolBoundaryGuardProfile();

  equal(
    profile.version,
    HOSTED_LLM_AGENT_TOOL_BOUNDARY_GUARD_VERSION,
    'Hosted LLM/agent boundary: version is exported',
  );
  equal(
    profile.guards.length,
    HOSTED_LLM_AGENT_TOOL_BOUNDARY_GUARDS.length,
    'Hosted LLM/agent boundary: profile exports every guard',
  );
  includes(
    profile.posture,
    'model context, tool authority',
    'Hosted LLM/agent boundary: posture separates model context and tool authority',
  );
  includes(
    profile.unresolvedProductionDependency,
    'hosted product smoke tests',
    'Hosted LLM/agent boundary: production dependency remains explicit',
  );
}

function testEveryGuardIsCompleteAndSecretSafe(): void {
  const ids = new Set<string>();

  for (const guard of HOSTED_LLM_AGENT_TOOL_BOUNDARY_GUARDS) {
    ok(!ids.has(guard.id), `Hosted LLM/agent boundary: ${guard.id} is unique`);
    ids.add(guard.id);
    ok(guard.routes.length > 0, `Hosted LLM/agent boundary: ${guard.id} declares routes`);
    ok(guard.agentRisks.length > 0, `Hosted LLM/agent boundary: ${guard.id} declares risks`);
    ok(guard.requiredControls.length > 0, `Hosted LLM/agent boundary: ${guard.id} declares controls`);
    ok(
      guard.requiredControls.includes('data_minimization_policy'),
      `Hosted LLM/agent boundary: ${guard.id} requires data minimization`,
    );
    ok(guard.modelBoundary.length > 80, `Hosted LLM/agent boundary: ${guard.id} declares model boundary`);
    ok(guard.toolAuthorityBoundary.length > 80, `Hosted LLM/agent boundary: ${guard.id} declares tool boundary`);
    ok(guard.retryBoundary.length > 80, `Hosted LLM/agent boundary: ${guard.id} declares retry boundary`);
    ok(guard.privacyBoundary.length > 80, `Hosted LLM/agent boundary: ${guard.id} declares privacy boundary`);
    ok(
      guard.implementationEvidence.every(fileExists),
      `Hosted LLM/agent boundary: ${guard.id} evidence files exist`,
    );
    ok(
      guard.validation.every(fileExists),
      `Hosted LLM/agent boundary: ${guard.id} validation files exist`,
    );
    ok(
      guard.standards.some((standard) =>
        standard.includes('OWASP') || standard.includes('NIST') || standard.includes('OpenAI'),
      ),
      `Hosted LLM/agent boundary: ${guard.id} is anchored to external engineering guidance`,
    );
  }

  excludes(
    JSON.stringify(HOSTED_LLM_AGENT_TOOL_BOUNDARY_GUARDS),
    /\b(?:sk|rk)_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|private_key=[A-Za-z0-9]+/u,
    'Hosted LLM/agent boundary: contract does not contain live secrets',
  );
}

function testControlContractsForCriticalBoundaries(): void {
  hasControl('admission.model-safe-feedback', 'model_safe_feedback_only');
  hasControl('admission.model-safe-feedback', 'no_raw_prompt_or_provider_body');
  hasControl('agent.retry-loop-authority', 'retry_binding_required');
  hasControl('agent.retry-loop-authority', 'operator_only_reasons_not_model_retryable');
  hasControl('agent.retry-loop-authority', 'policy_probing_hold');
  hasControl('shadow.recommendation-read-boundary', 'shadow_read_only');
  hasControl('shadow.recommendation-read-boundary', 'shadow_no_auto_enforce');
  hasControl('shadow.recommendation-read-boundary', 'digest_only_shadow_evidence');
  hasControl('adapter.protected-tool-execution', 'protected_adapter_verifies_before_execute');
  hasControl('adapter.protected-tool-execution', 'raw_execute_not_exposed');
  hasControl('adapter.protected-tool-execution', 'digest_only_tool_invocation');
  hasControl('proof.dashboard.problem-surface', 'digest_first_proof_surface');
  hasControl('proof.dashboard.problem-surface', 'decision_support_only_dashboard');
  hasControl('proof.dashboard.problem-surface', 'fail_closed_problem_details');
}

function testExistingDescriptorsExposeTheBoundary(): void {
  const correctionCatalog = consequenceAdmissionCorrectionCatalog();
  const dataMinimization = consequenceDataMinimizationRedactionPolicyDescriptor();
  const agentLoop = consequenceAdmissionAgentLoopAbuseGuardDescriptor();
  const adapter = consequenceAdmissionAdapterFrameworkDescriptor();

  ok(
    correctionCatalog.modelRetryableReasonCodes.length > 0,
    'Hosted LLM/agent boundary: correction catalog has model-retryable reasons',
  );
  ok(
    correctionCatalog.operatorOnlyReasonCodes.includes('adapter-readiness-missing'),
    'Hosted LLM/agent boundary: adapter-readiness stays operator-only',
  );
  equal(dataMinimization.modelFeedbackIsRedacted, true, 'Hosted LLM/agent boundary: model feedback is redacted');
  equal(dataMinimization.proofSurfacesAreDigestFirst, true, 'Hosted LLM/agent boundary: proof surfaces are digest first');
  equal(dataMinimization.dashboardIsDecisionSupportOnly, true, 'Hosted LLM/agent boundary: dashboards are decision support only');
  equal(dataMinimization.rawPayloadStored, false, 'Hosted LLM/agent boundary: data minimization forbids raw payload storage');
  equal(agentLoop.storesRawPayloadsExternally, false, 'Hosted LLM/agent boundary: agent-loop guard stores no raw payloads');
  equal(agentLoop.failClosed, true, 'Hosted LLM/agent boundary: agent-loop guard is fail closed');
  equal(adapter.verifiesBeforeExecute, true, 'Hosted LLM/agent boundary: adapters verify before execute');
  equal(adapter.rawExecuteExposed, false, 'Hosted LLM/agent boundary: raw adapter execute is not exposed');
  equal(adapter.storesRawInputsExternally, false, 'Hosted LLM/agent boundary: adapters store no raw inputs externally');
  equal(adapter.storesRawResultsExternally, false, 'Hosted LLM/agent boundary: adapters store no raw results externally');
}

function testImplementationEvidenceMatchesSource(): void {
  const admission = readProjectFile('src', 'consequence-admission', 'index.ts');
  const dataMinimization = readProjectFile('src', 'consequence-admission', 'data-minimization-redaction-policy.ts');
  const agentLoop = readProjectFile('src', 'consequence-admission', 'agent-loop-abuse-guard.ts');
  const genericRoutes = readProjectFile('src', 'service', 'http', 'routes', 'generic-admission-routes.ts');
  const shadowRoutes = readProjectFile('src', 'service', 'http', 'routes', 'shadow-routes.ts');
  const shadowEvents = readProjectFile('src', 'consequence-admission', 'shadow-events.ts');
  const shadowSimulation = readProjectFile('src', 'consequence-admission', 'shadow-simulation.ts');
  const adapter = readProjectFile('src', 'consequence-admission', 'adapter-framework.ts');
  const openApi = readProjectFile('docs', 'api', 'attestor-action-authorization.openapi.json');

  includes(admission, 'readonly safeForModel: true', 'Hosted LLM/agent evidence: feedback is typed model-safe');
  includes(admission, 'operatorOnlyReasonCodes', 'Hosted LLM/agent evidence: operator-only reason codes exist');
  includes(admission, 'retryableByModel: false', 'Hosted LLM/agent evidence: non-model retryable catalog entries exist');
  includes(admission, 'sameRequestReplayAllowed: false', 'Hosted LLM/agent evidence: same request replay is rejected');
  includes(admission, 'retryBindingRequired: retryAllowed', 'Hosted LLM/agent evidence: retry binding is required when retry is allowed');
  includes(admission, 'retry-operator-only-reason', 'Hosted LLM/agent evidence: operator-only retry reasons fail closed');
  includes(admission, 'createConsequenceAdmissionProblem', 'Hosted LLM/agent evidence: fail-closed problem details exist');
  includes(genericRoutes, "c.header('cache-control', 'no-store')", 'Hosted LLM/agent evidence: admission route is no-store');
  includes(genericRoutes, 'evaluateAgentLoopAbuse', 'Hosted LLM/agent evidence: route can evaluate agent-loop abuse');
  includes(genericRoutes, 'recordShadowAdmission', 'Hosted LLM/agent evidence: route can record shadow events');
  includes(dataMinimization, "'raw-tool-payload'", 'Hosted LLM/agent evidence: raw tool payloads are forbidden');
  includes(dataMinimization, "'raw-downstream-response'", 'Hosted LLM/agent evidence: raw downstream responses are forbidden');
  includes(dataMinimization, "'private_key'", 'Hosted LLM/agent evidence: runtime private-key markers are forbidden');
  includes(agentLoop, 'maxRetryAttemptsPerPreviousAdmission', 'Hosted LLM/agent evidence: retry attempt budget exists');
  includes(agentLoop, 'maxDistinctCorrectionSignaturesPerPreviousAdmission', 'Hosted LLM/agent evidence: policy probing budget exists');
  includes(agentLoop, 'agent-loop-policy-probing-risk', 'Hosted LLM/agent evidence: policy probing hold reason exists');
  includes(agentLoop, 'rawPayloadStored: false', 'Hosted LLM/agent evidence: agent-loop records avoid raw payloads');
  includes(shadowEvents, 'observedFeatureDigest', 'Hosted LLM/agent evidence: shadow events use feature digests');
  includes(shadowEvents, 'nativeInputRefCount', 'Hosted LLM/agent evidence: shadow events count native refs');
  includes(shadowEvents, 'rawPayloadStored: false', 'Hosted LLM/agent evidence: shadow events avoid raw payloads');
  includes(shadowSimulation, 'rawPayloadEventCount', 'Hosted LLM/agent evidence: shadow simulation tracks raw-payload violations');
  includes(shadowSimulation, 'recommendations', 'Hosted LLM/agent evidence: recommendations are structured');
  includes(shadowRoutes, "app.get('/api/v1/shadow/recommendations'", 'Hosted LLM/agent evidence: recommendation read route exists');
  includes(shadowRoutes, 'approvalRequired: true', 'Hosted LLM/agent evidence: shadow promotion requires approval');
  includes(shadowRoutes, 'autoEnforce: false', 'Hosted LLM/agent evidence: shadow reads do not auto-enforce');
  includes(adapter, 'createConsequenceAdmissionVerifier', 'Hosted LLM/agent evidence: adapters create verifier');
  includes(adapter, 'rawExecuteExposed: false', 'Hosted LLM/agent evidence: raw execute is not exposed');
  includes(adapter, 'verifiesBeforeExecute: true', 'Hosted LLM/agent evidence: adapter descriptor verifies before execute');
  includes(adapter, 'idempotencyKeyDigest', 'Hosted LLM/agent evidence: idempotency keys are digested');
  includes(adapter, 'inputDigest', 'Hosted LLM/agent evidence: adapter inputs are digest referenced');
  includes(adapter, 'rawResultStored: false', 'Hosted LLM/agent evidence: adapter results avoid raw storage');
  includes(openApi, '"ModelSafeFeedback"', 'Hosted LLM/agent evidence: OpenAPI documents model-safe feedback');
  includes(openApi, '"modelSafeFeedbackOnly": true', 'Hosted LLM/agent evidence: OpenAPI declares model-safe boundary');
  includes(openApi, '"toolExecutionAuthorityGranted": false', 'Hosted LLM/agent evidence: OpenAPI denies tool authority grant');
}

function testMaterialScannerFindsUnsafeToolAndProviderLeaks(): void {
  const findings = consequenceDataMinimizationMaterialSafetyFindings({
    findingSubject: 'llm-agent-boundary-sample',
    material: JSON.stringify({
      prompt: 'raw-model-prompt must not appear',
      tool: 'raw-tool-payload must not appear',
      provider: 'raw-downstream-response must not appear',
      secret: 'private_key must not appear',
      rawPayloadStored: true,
    }),
    extraSensitiveMarkers: ['provider body', 'raw tool payload'],
  });

  ok(findings.length >= 4, 'Hosted LLM/agent boundary: unsafe material scanner finds multiple leaks');
  ok(
    findings.some((finding) => finding.includes('raw-tool-payload')),
    'Hosted LLM/agent boundary: scanner catches raw tool payload marker',
  );
  ok(
    findings.some((finding) => finding.includes('raw-downstream-response')),
    'Hosted LLM/agent boundary: scanner catches raw downstream/provider marker',
  );
  ok(
    findings.some((finding) => finding.includes('private_key')),
    'Hosted LLM/agent boundary: scanner catches private key marker',
  );
  ok(
    findings.some((finding) => finding.includes('raw payload storage')),
    'Hosted LLM/agent boundary: scanner catches raw payload storage declaration',
  );
}

function testDocsAndRunnerExposeGuard(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  const packageRunner = readProjectFile('tests', 'package-script-runner.test.ts');
  const hostedTracker = readProjectFile('docs', '02-architecture', 'hosted-production-trust-hardening.md');
  const hostedContract = readProjectFile('docs', '01-overview', 'hosted-journey-contract.md');
  const hostedOpenApiGuide = readProjectFile('docs', '01-overview', 'hosted-action-authorization-api.md');

  equal(
    packageJson.scripts['test:hosted-llm-agent-tool-boundary-guard'],
    'tsx tests/hosted-llm-agent-tool-boundary-guard.test.ts',
    'Hosted LLM/agent boundary: package script is exposed',
  );
  includes(
    packageRunner,
    'test:hosted-llm-agent-tool-boundary-guard',
    'Hosted LLM/agent boundary: package runner includes guard test',
  );
  includes(
    hostedTracker,
    'LLM/Agent Tool-Use Boundary Guard',
    'Hosted LLM/agent boundary: tracker records Step 04',
  );
  includes(
    hostedTracker,
    'src/service/hosted/hosted-llm-agent-tool-boundary-guard.ts',
    'Hosted LLM/agent boundary: tracker points to source',
  );
  includes(
    hostedContract,
    'machine-readable LLM/agent tool-use boundary guard',
    'Hosted LLM/agent boundary: hosted contract links machine-readable profile',
  );
  includes(
    hostedOpenApiGuide,
    'model-safe feedback',
    'Hosted LLM/agent boundary: OpenAPI guide names model-safe feedback',
  );
}

testProfileDescriptor();
testEveryGuardIsCompleteAndSecretSafe();
testControlContractsForCriticalBoundaries();
testExistingDescriptorsExposeTheBoundary();
testImplementationEvidenceMatchesSource();
testMaterialScannerFindsUnsafeToolAndProviderLeaks();
testDocsAndRunnerExposeGuard();

console.log(`Hosted LLM/agent tool-use boundary guard tests: ${passed} passed, 0 failed`);
