import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOSTED_OBSERVABILITY_INCIDENT_PACKET_SHAPE,
  HOSTED_OBSERVABILITY_PRIVACY_INCIDENT_EVIDENCE_VERSION,
  HOSTED_OBSERVABILITY_PRIVACY_INCIDENT_GUARDS,
  hostedObservabilityPrivacyIncidentEvidenceProfile,
  requireHostedObservabilityPrivacyIncidentGuard,
  type HostedObservabilityPrivacyIncidentControl,
} from '../src/service/hosted-observability-privacy-incident-evidence.js';
import { toPrivacySafeStructuredRequestLogRecord } from '../src/service/observability.js';

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

function excludes(content: string, unexpected: string | RegExp, message: string): void {
  if (typeof unexpected === 'string') {
    assert.ok(!content.includes(unexpected), `${message}\nDid not expect to find: ${unexpected}`);
  } else {
    assert.doesNotMatch(content, unexpected, message);
  }
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8').replace(/\r\n/gu, '\n');
}

function fileExists(projectPath: string): boolean {
  return existsSync(join(process.cwd(), projectPath.split('#')[0]));
}

function hasControl(id: string, control: HostedObservabilityPrivacyIncidentControl): void {
  const guard = requireHostedObservabilityPrivacyIncidentGuard(id);
  ok(
    guard.requiredControls.includes(control),
    `Hosted observability privacy incident evidence: ${id} requires ${control}`,
  );
}

function testProfileDescriptor(): void {
  const profile = hostedObservabilityPrivacyIncidentEvidenceProfile();

  equal(
    profile.version,
    HOSTED_OBSERVABILITY_PRIVACY_INCIDENT_EVIDENCE_VERSION,
    'Hosted observability privacy incident evidence: version is exported',
  );
  equal(
    profile.guards.length,
    HOSTED_OBSERVABILITY_PRIVACY_INCIDENT_GUARDS.length,
    'Hosted observability privacy incident evidence: profile exports every guard',
  );
  includes(
    profile.posture,
    'Privacy-safe request telemetry',
    'Hosted observability privacy incident evidence: posture names privacy-safe telemetry',
  );
  includes(
    profile.currentClaim,
    'does not claim external collector',
    'Hosted observability privacy incident evidence: claim boundary stays honest',
  );
  includes(
    profile.unresolvedProductionDependency,
    'working deployment target',
    'Hosted observability privacy incident evidence: Step 10 dependency remains explicit',
  );
}

function testEveryGuardIsCompleteAndSecretSafe(): void {
  const ids = new Set<string>();

  for (const guard of HOSTED_OBSERVABILITY_PRIVACY_INCIDENT_GUARDS) {
    ok(!ids.has(guard.id), `Hosted observability privacy incident evidence: ${guard.id} is unique`);
    ids.add(guard.id);
    ok(guard.operationalRisks.length > 0, `Hosted observability privacy incident evidence: ${guard.id} declares risks`);
    ok(guard.requiredControls.length > 0, `Hosted observability privacy incident evidence: ${guard.id} declares controls`);
    ok(guard.signalBoundary.length > 100, `Hosted observability privacy incident evidence: ${guard.id} declares signal boundary`);
    ok(guard.evidenceBoundary.length > 100, `Hosted observability privacy incident evidence: ${guard.id} declares evidence boundary`);
    ok(guard.incidentBoundary.length > 100, `Hosted observability privacy incident evidence: ${guard.id} declares incident boundary`);
    ok(guard.nonClaimBoundary.length > 100, `Hosted observability privacy incident evidence: ${guard.id} declares non-claim boundary`);
    ok(
      guard.implementationEvidence.every(fileExists),
      `Hosted observability privacy incident evidence: ${guard.id} evidence files exist`,
    );
    ok(
      guard.validation.every(fileExists),
      `Hosted observability privacy incident evidence: ${guard.id} validation files exist`,
    );
    ok(
      guard.standards.some((standard) =>
        standard.includes('OpenTelemetry') ||
        standard.includes('OWASP') ||
        standard.includes('NIST') ||
        standard.includes('Google SRE'),
      ),
      `Hosted observability privacy incident evidence: ${guard.id} is anchored to external guidance`,
    );
  }

  excludes(
    JSON.stringify(HOSTED_OBSERVABILITY_PRIVACY_INCIDENT_GUARDS),
    /\b(?:sk|rk)_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|postgres:\/\/[^"'\s]+|redis:\/\/[^"'\s]+/u,
    'Hosted observability privacy incident evidence: contract does not contain live secrets or connection strings',
  );
}

function testTelemetryPrivacyControls(): void {
  hasControl('telemetry.request-signal-boundary', 'route_template_labels_only');
  hasControl('telemetry.request-signal-boundary', 'no_raw_url_path_or_query_export');
  hasControl('telemetry.request-signal-boundary', 'no_raw_tenant_or_account_id_export');
  hasControl('telemetry.request-signal-boundary', 'no_raw_ip_or_user_agent_export');
  hasControl('telemetry.request-signal-boundary', 'low_cardinality_metric_labels');
  hasControl('telemetry.request-signal-boundary', 'trace_correlation_without_payload');

  const observability = readProjectFile('src', 'service', 'observability.ts');
  const middleware = readProjectFile('src', 'service', 'request-observability-middleware.ts');

  excludes(observability, 'ATTR_URL_FULL', 'Hosted observability privacy evidence: full URLs are not exported as span attributes');
  excludes(observability, 'ATTR_URL_PATH', 'Hosted observability privacy evidence: raw paths are not exported as span attributes');
  excludes(observability, 'ATTR_CLIENT_ADDRESS', 'Hosted observability privacy evidence: raw client addresses are not exported');
  excludes(observability, 'ATTR_USER_AGENT_ORIGINAL', 'Hosted observability privacy evidence: raw user agents are not exported');
  excludes(observability, "'attestor.tenant.id'", 'Hosted observability privacy evidence: raw tenant ids are not exported');
  excludes(observability, "'attestor.account.id'", 'Hosted observability privacy evidence: raw account ids are not exported');
  excludes(observability, "'attestor.http.path'", 'Hosted observability privacy evidence: raw request paths are not logged');
  excludes(observability, "'client.address'", 'Hosted observability privacy evidence: OTLP logs omit raw client addresses');
  excludes(observability, "'user_agent.original'", 'Hosted observability privacy evidence: OTLP logs omit raw user agents');
  includes(observability, 'toPrivacySafeStructuredRequestLogRecord', 'Hosted observability privacy evidence: JSONL logs use a privacy-safe projection');
  includes(observability, "'attestor.tenant.present'", 'Hosted observability privacy evidence: tenant context is reduced to presence');
  includes(observability, "'attestor.account.present'", 'Hosted observability privacy evidence: account context is reduced to presence');
  includes(observability, "'attestor.client.address_present'", 'Hosted observability privacy evidence: client address is reduced to presence');
  includes(observability, "'attestor.user_agent.present'", 'Hosted observability privacy evidence: user agent is reduced to presence');
  includes(observability, 'route: privacySafeRouteLabel(record.route)', 'Hosted observability privacy evidence: JSONL route is normalized');
  includes(observability, 'route = privacySafeRouteLabel(input.route)', 'Hosted observability privacy evidence: span route is normalized');
  includes(observability, 'status_code: String(input.statusCode)', 'Hosted observability privacy evidence: metric labels stay low-cardinality');
  includes(middleware, "return statusCode === 404 ? '__unmatched__' : '__unrouted__';", 'Hosted observability privacy evidence: unmatched routes avoid raw path labels');

  const safe = toPrivacySafeStructuredRequestLogRecord({
    occurredAt: '2026-05-12T00:00:00.000Z',
    route: '/api/v1/accounts/acct_1234567890abcdef?debug=true',
    path: '/api/v1/accounts/acct_1234567890abcdef?debug=true',
    method: 'GET',
    statusCode: 200,
    durationMs: 12,
    traceId: '0123456789abcdef0123456789abcdef',
    spanId: '0123456789abcdef',
    parentSpanId: null,
    traceFlags: '01',
    tenantId: 'tenant_private',
    planId: 'starter',
    accountId: 'acct_1234567890abcdef',
    accountStatus: 'active',
    rateLimited: false,
    quotaRejected: false,
    remoteAddress: '203.0.113.10',
    userAgent: 'private-browser-agent',
  });
  const serialized = JSON.stringify(safe);

  equal(safe.route, '/api/v1/accounts/:id', 'Hosted observability privacy evidence: dynamic account path segment is normalized');
  equal(safe.rawPathOmitted, true, 'Hosted observability privacy evidence: raw path omission is explicit');
  equal(safe.tenantPresent, true, 'Hosted observability privacy evidence: tenant presence is retained');
  equal(safe.accountPresent, true, 'Hosted observability privacy evidence: account presence is retained');
  equal(safe.clientAddressPresent, true, 'Hosted observability privacy evidence: client address presence is retained');
  equal(safe.userAgentPresent, true, 'Hosted observability privacy evidence: user agent presence is retained');
  excludes(serialized, 'tenant_private', 'Hosted observability privacy evidence: safe log omits raw tenant id');
  excludes(serialized, 'acct_1234567890abcdef', 'Hosted observability privacy evidence: safe log omits raw account id');
  excludes(serialized, '203.0.113.10', 'Hosted observability privacy evidence: safe log omits raw IP');
  excludes(serialized, 'private-browser-agent', 'Hosted observability privacy evidence: safe log omits raw user agent');
  excludes(serialized, 'debug=true', 'Hosted observability privacy evidence: safe log omits query string');
}

function testReceiverAlertDashboardAndIncidentEvidence(): void {
  hasControl('receiver.secret-and-auth-boundary', 'otlp_receiver_auth_probe');
  hasControl('receiver.secret-and-auth-boundary', 'no_live_secret_output');
  hasControl('alert.context-routing-boundary', 'alert_receiver_fanout_probe');
  hasControl('alert.context-routing-boundary', 'slo_burn_and_watchdog_alerts');
  hasControl('incident.timeline-evidence-packet', 'incident_timeline_required');
  hasControl('incident.timeline-evidence-packet', 'incident_evidence_refs_digest_bound');
  hasControl('incident.timeline-evidence-packet', 'postmortem_action_items_required');
  hasControl('dashboard.runtime-truth-boundary', 'dashboard_runtime_truth_metric');
  hasControl('rehearsal.operational-evidence-boundary', 'production_rehearsal_separate_from_claim');

  const receiverProbe = readProjectFile('scripts', 'probe', 'probe-observability-receivers.ts');
  const releaseInputProbe = readProjectFile('scripts', 'probe', 'probe-observability-release-inputs.ts');
  const alertRouting = readProjectFile('scripts', 'probe', 'probe-alert-routing.ts');
  const rehearsal = readProjectFile('scripts', 'rehearse', 'rehearse-production-observability-alerting.ts');
  const dashboard = readProjectFile('ops', 'observability', 'grafana', 'dashboards', 'attestor-overview.json');
  const alerts = readProjectFile('ops', 'observability', 'prometheus', 'alerts.yml');
  const metrics = readProjectFile('src', 'service', 'observability.ts');

  includes(receiverProbe, 'forceFlushTelemetry', 'Hosted observability privacy evidence: receiver probe exercises OTLP flush');
  includes(receiverProbe, '/api/v1/query?query=vector(1)', 'Hosted observability privacy evidence: receiver probe checks Prometheus auth');
  includes(receiverProbe, '/api/v2/alerts', 'Hosted observability privacy evidence: receiver probe checks Alertmanager auth');
  includes(releaseInputProbe, 'probeAlertRouting', 'Hosted observability privacy evidence: release input probe includes alert routing');
  includes(alertRouting, 'security-critical', 'Hosted observability privacy evidence: security receiver fanout is simulated');
  includes(alertRouting, 'billing-warning', 'Hosted observability privacy evidence: billing receiver fanout is simulated');
  includes(alerts, 'Watchdog', 'Hosted observability privacy evidence: deadman alert is present');
  includes(alerts, 'AttestorAvailabilityErrorBudgetFastBurn', 'Hosted observability privacy evidence: SLO burn alert is present');
  includes(rehearsal, 'runbookTruth', 'Hosted observability privacy evidence: rehearsal records runbook truth');
  includes(rehearsal, 'stopConditionCount', 'Hosted observability privacy evidence: rehearsal records stop condition count');
  includes(dashboard, 'attestor_runtime_profile_info', 'Hosted observability privacy evidence: dashboard exposes runtime truth metric');
  includes(metrics, 'attestor_runtime_profile_info', 'Hosted observability privacy evidence: Prometheus metrics expose runtime truth');
}

function testIncidentPacketShapeAndDocs(): void {
  equal(
    HOSTED_OBSERVABILITY_INCIDENT_PACKET_SHAPE.version,
    `${HOSTED_OBSERVABILITY_PRIVACY_INCIDENT_EVIDENCE_VERSION}.incident-packet`,
    'Hosted observability privacy incident evidence: incident packet shape is versioned',
  );
  for (const field of [
    'incidentId',
    'severity',
    'detectedAt',
    'alertContext',
    'timeline',
    'evidenceRefs',
    'operatorActions',
    'customerDataBoundary',
    'followUps',
  ] as const) {
    ok(
      HOSTED_OBSERVABILITY_INCIDENT_PACKET_SHAPE.requiredFields.includes(field),
      `Hosted observability privacy incident evidence: incident packet requires ${field}`,
    );
  }
  for (const field of [
    'rawPrompt',
    'rawPayload',
    'rawRequestBody',
    'tenantId',
    'accountId',
    'remoteAddress',
    'userAgent',
    'authorization',
    'apiKey',
    'webhookSecret',
    'providerBody',
  ] as const) {
    ok(
      HOSTED_OBSERVABILITY_INCIDENT_PACKET_SHAPE.forbiddenRawFields.includes(field),
      `Hosted observability privacy incident evidence: incident packet forbids ${field}`,
    );
  }
  includes(
    HOSTED_OBSERVABILITY_INCIDENT_PACKET_SHAPE.evidenceRefRule,
    'path, digest, producer command, and timestamp',
    'Hosted observability privacy incident evidence: evidence refs are digest-bound',
  );
  includes(
    HOSTED_OBSERVABILITY_INCIDENT_PACKET_SHAPE.timelineRule,
    'detection, triage, mitigation, verification, and follow-up',
    'Hosted observability privacy incident evidence: timeline rule is complete',
  );

  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageRunner = readProjectFile('tests', 'package-script-runner.test.ts');
  const tracker = readProjectFile('docs', '02-architecture', 'hosted-production-trust-hardening.md');
  const hostedContract = readProjectFile('docs', '01-overview', 'hosted-journey-contract.md');
  const productionReadiness = readProjectFile('docs', '08-deployment', 'production-readiness.md');

  equal(
    packageJson.scripts['test:hosted-observability-privacy-incident-evidence'],
    'tsx tests/hosted-observability-privacy-incident-evidence.test.ts',
    'Hosted observability privacy incident evidence: package script is exposed',
  );
  includes(packageRunner, 'test:hosted-observability-privacy-incident-evidence', 'Hosted observability privacy incident evidence: fast suite includes this guard');
  includes(tracker, 'Observability Privacy And Incident Evidence', 'Hosted observability privacy incident evidence: tracker records Step 07');
  includes(tracker, 'OpenTelemetry attribute requirement levels', 'Hosted observability privacy incident evidence: tracker records cardinality research');
  includes(tracker, 'NIST SP 800-61 Rev. 3', 'Hosted observability privacy incident evidence: tracker records incident-response research');
  includes(hostedContract, 'hosted-observability-privacy-incident-evidence', 'Hosted observability privacy incident evidence: hosted contract exposes the machine-readable profile');
  includes(productionReadiness, 'observability privacy and incident evidence profile', 'Hosted observability privacy incident evidence: production readiness documents the boundary');
}

testProfileDescriptor();
testEveryGuardIsCompleteAndSecretSafe();
testTelemetryPrivacyControls();
testReceiverAlertDashboardAndIncidentEvidence();
testIncidentPacketShapeAndDocs();

console.log(`hosted-observability-privacy-incident-evidence.test.ts: ${passed} assertions passed`);
