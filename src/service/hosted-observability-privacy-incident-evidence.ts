export const HOSTED_OBSERVABILITY_PRIVACY_INCIDENT_EVIDENCE_VERSION =
  'attestor.hosted-observability-privacy-incident-evidence.v1';

export type HostedObservabilityPrivacyIncidentSurface =
  | 'request_trace_metrics_logs'
  | 'otlp_receiver_boundary'
  | 'alert_context_routing'
  | 'incident_timeline_packet'
  | 'dashboard_runtime_truth'
  | 'production_rehearsal_evidence';

export type HostedObservabilityPrivacyIncidentRisk =
  | 'raw_customer_identifier_in_telemetry'
  | 'raw_path_or_query_in_telemetry'
  | 'raw_ip_or_user_agent_in_telemetry'
  | 'high_cardinality_metric_label'
  | 'alert_payload_leaks_private_context'
  | 'incident_packet_missing_timeline'
  | 'incident_evidence_not_digest_bound'
  | 'runbook_stop_condition_drift'
  | 'observability_secret_leak'
  | 'dashboard_overclaims_runtime_readiness';

export type HostedObservabilityPrivacyIncidentControl =
  | 'route_template_labels_only'
  | 'no_raw_url_path_or_query_export'
  | 'no_raw_tenant_or_account_id_export'
  | 'no_raw_ip_or_user_agent_export'
  | 'low_cardinality_metric_labels'
  | 'trace_correlation_without_payload'
  | 'otlp_receiver_auth_probe'
  | 'alert_receiver_fanout_probe'
  | 'slo_burn_and_watchdog_alerts'
  | 'incident_timeline_required'
  | 'incident_evidence_refs_digest_bound'
  | 'operator_runbook_stop_conditions'
  | 'postmortem_action_items_required'
  | 'dashboard_runtime_truth_metric'
  | 'privacy_minimized_evidence'
  | 'no_live_secret_output'
  | 'production_rehearsal_separate_from_claim';

export type HostedIncidentPacketField =
  | 'incidentId'
  | 'severity'
  | 'startedAt'
  | 'detectedAt'
  | 'resolvedAt'
  | 'summary'
  | 'affectedSurfaces'
  | 'alertContext'
  | 'timeline'
  | 'evidenceRefs'
  | 'operatorActions'
  | 'customerDataBoundary'
  | 'followUps';

export interface HostedObservabilityPrivacyIncidentGuard {
  readonly id: string;
  readonly title: string;
  readonly surface: HostedObservabilityPrivacyIncidentSurface;
  readonly operationalRisks: readonly HostedObservabilityPrivacyIncidentRisk[];
  readonly requiredControls: readonly HostedObservabilityPrivacyIncidentControl[];
  readonly signalBoundary: string;
  readonly evidenceBoundary: string;
  readonly incidentBoundary: string;
  readonly nonClaimBoundary: string;
  readonly implementationEvidence: readonly string[];
  readonly validation: readonly string[];
  readonly standards: readonly string[];
}

export interface HostedIncidentPacketShape {
  readonly version: string;
  readonly requiredFields: readonly HostedIncidentPacketField[];
  readonly forbiddenRawFields: readonly string[];
  readonly evidenceRefRule: string;
  readonly timelineRule: string;
  readonly customerDataBoundary: string;
}

export const HOSTED_OBSERVABILITY_INCIDENT_PACKET_SHAPE: HostedIncidentPacketShape = {
  version: `${HOSTED_OBSERVABILITY_PRIVACY_INCIDENT_EVIDENCE_VERSION}.incident-packet`,
  requiredFields: [
    'incidentId',
    'severity',
    'startedAt',
    'detectedAt',
    'summary',
    'affectedSurfaces',
    'alertContext',
    'timeline',
    'evidenceRefs',
    'operatorActions',
    'customerDataBoundary',
    'followUps',
  ],
  forbiddenRawFields: [
    'rawPrompt',
    'rawPayload',
    'rawRequestBody',
    'rawResponseBody',
    'tenantId',
    'accountId',
    'remoteAddress',
    'userAgent',
    'authorization',
    'apiKey',
    'webhookSecret',
    'providerBody',
  ],
  evidenceRefRule:
    'Incident packets reference artifacts by path, digest, producer command, and timestamp; they do not inline raw customer payloads, raw provider bodies, credentials, or private identifiers.',
  timelineRule:
    'Every incident packet must preserve detection, triage, mitigation, verification, and follow-up events with operator action owners and timestamps.',
  customerDataBoundary:
    'Customer-impact summaries are allowed; raw customer data, prompts, payloads, payment details, wallet material, contact data, and provider bodies are excluded from the incident packet.',
};

export const HOSTED_OBSERVABILITY_PRIVACY_INCIDENT_GUARDS:
readonly HostedObservabilityPrivacyIncidentGuard[] = [
  {
    id: 'telemetry.request-signal-boundary',
    title: 'Request traces, metrics, and logs stay privacy-safe',
    surface: 'request_trace_metrics_logs',
    operationalRisks: [
      'raw_customer_identifier_in_telemetry',
      'raw_path_or_query_in_telemetry',
      'raw_ip_or_user_agent_in_telemetry',
      'high_cardinality_metric_label',
    ],
    requiredControls: [
      'route_template_labels_only',
      'no_raw_url_path_or_query_export',
      'no_raw_tenant_or_account_id_export',
      'no_raw_ip_or_user_agent_export',
      'low_cardinality_metric_labels',
      'trace_correlation_without_payload',
      'privacy_minimized_evidence',
    ],
    signalBoundary:
      'Request observability exports method, route label, status, duration, trace ids, low-cardinality plan/status facts, and presence booleans; it omits raw paths, URLs, tenant ids, account ids, peer IPs, user agents, request bodies, and response bodies.',
    evidenceBoundary:
      'Local JSONL request logs and OTLP logs share the same privacy-safe projection, so a configured observability log path cannot become a side channel for raw customer identifiers.',
    incidentBoundary:
      'Incident responders correlate by trace id, route label, status, time, and evidence references; raw customer context must be pulled from authorized internal systems only when operationally required.',
    nonClaimBoundary:
      'Privacy-safe telemetry improves operational evidence but does not prove that the external collector, log backend, or customer deployment retention policy is configured correctly.',
    implementationEvidence: [
      'src/service/observability.ts',
      'src/service/request-observability-middleware.ts',
      'ops/observability/prometheus/alerts.yml',
      'ops/observability/prometheus/recording-rules.yml',
    ],
    validation: [
      'tests/hosted-observability-privacy-incident-evidence.test.ts',
      'tests/observability-bundle.test.ts',
      'tests/live-otlp.test.ts',
    ],
    standards: [
      'OpenTelemetry semantic conventions: telemetry attributes should follow common naming while respecting security, performance, and cardinality requirements.',
      'OpenTelemetry attribute requirement levels: metric attributes that may be high-cardinality should be opt-in rather than default.',
      'OWASP Logging Cheat Sheet: logs should exclude secrets and sensitive personal data and sanitize event data crossing trust zones.',
    ],
  },
  {
    id: 'receiver.secret-and-auth-boundary',
    title: 'OTLP and observability receiver readiness is probed without leaking secrets',
    surface: 'otlp_receiver_boundary',
    operationalRisks: [
      'observability_secret_leak',
      'dashboard_overclaims_runtime_readiness',
    ],
    requiredControls: [
      'otlp_receiver_auth_probe',
      'no_live_secret_output',
      'privacy_minimized_evidence',
      'production_rehearsal_separate_from_claim',
    ],
    signalBoundary:
      'Receiver probes prove OTLP flush, Prometheus query auth, and Alertmanager auth using configured endpoints without printing tokens, webhook URLs, or managed-backend credentials.',
    evidenceBoundary:
      'Readiness packets record pass/fail state, missing input inventory, output artifact paths, and recommended apply flow rather than secret values.',
    incidentBoundary:
      'An incident packet may reference receiver-probe summaries and endpoint classes; it must not include collector credentials or alert receiver secret material.',
    nonClaimBoundary:
      'A green receiver probe is target-specific evidence, not a standing claim that every future observability backend is healthy.',
    implementationEvidence: [
      'scripts/probe-observability-receivers.ts',
      'scripts/probe-observability-release-inputs.ts',
      'scripts/render-observability-promotion-packet.ts',
      'scripts/render-observability-credentials.ts',
    ],
    validation: [
      'tests/observability-receiver-probe.test.ts',
      'tests/observability-release-input-probe.test.ts',
      'tests/observability-promotion-packet.test.ts',
      'tests/production-readiness-secret-safe-output.test.ts',
    ],
    standards: [
      'OWASP Logging Cheat Sheet: logs and operational evidence should remove credentials, access tokens, connection strings, and encryption keys.',
      'NIST SP 800-61 Rev. 3: incident response preparation should improve detection, response, and recovery effectiveness without widening risk exposure.',
    ],
  },
  {
    id: 'alert.context-routing-boundary',
    title: 'Alert context is actionable and privacy-minimized',
    surface: 'alert_context_routing',
    operationalRisks: [
      'alert_payload_leaks_private_context',
      'runbook_stop_condition_drift',
    ],
    requiredControls: [
      'alert_receiver_fanout_probe',
      'slo_burn_and_watchdog_alerts',
      'operator_runbook_stop_conditions',
      'privacy_minimized_evidence',
    ],
    signalBoundary:
      'Alerts carry severity, team route, service, SLO/runtime state, and symptom context; they avoid customer payloads, raw identifiers, provider bodies, and secrets.',
    evidenceBoundary:
      'Alert routing tests simulate default, critical, warning, security, billing, and watchdog paths so routing behavior is machine-checkable before rollout.',
    incidentBoundary:
      'Incident packets include the alert name, severity, receiver class, runtime truth state, and runbook stop conditions so responders can decide without exposing raw customer data.',
    nonClaimBoundary:
      'Alert routing evidence does not replace real receiver delivery verification in the target environment.',
    implementationEvidence: [
      'ops/observability/prometheus/alerts.yml',
      'scripts/render-alertmanager-config.mjs',
      'scripts/probe-alert-routing.ts',
      'docs/08-deployment/production-rehearsal-manifest.example.json',
    ],
    validation: [
      'tests/alert-routing-probe.test.ts',
      'tests/alertmanager-config-render.test.ts',
      'tests/production-rehearsal-observability-alerting.test.ts',
    ],
    standards: [
      'Google SRE monitoring guidance: monitoring should separate symptoms from causes and keep alerts actionable.',
      'OWASP Logging Cheat Sheet: event data should support monitoring while excluding sensitive data and secrets.',
    ],
  },
  {
    id: 'incident.timeline-evidence-packet',
    title: 'Incident packet has timeline, evidence refs, and follow-up actions',
    surface: 'incident_timeline_packet',
    operationalRisks: [
      'incident_packet_missing_timeline',
      'incident_evidence_not_digest_bound',
      'raw_customer_identifier_in_telemetry',
    ],
    requiredControls: [
      'incident_timeline_required',
      'incident_evidence_refs_digest_bound',
      'postmortem_action_items_required',
      'privacy_minimized_evidence',
      'no_live_secret_output',
    ],
    signalBoundary:
      'Incident packets are assembled from alert, trace, runtime, rehearsal, and release evidence summaries rather than raw customer payloads or raw provider events.',
    evidenceBoundary:
      'Evidence references use artifact paths, digests, producer commands, timestamps, and validation states so reviewers can verify provenance without copying private data into the packet.',
    incidentBoundary:
      'The incident packet shape requires detection, triage, mitigation, verification, and follow-up timeline entries plus action owners.',
    nonClaimBoundary:
      'The packet is an incident-response evidence shape; it is not proof that every customer-impact communication, legal notice, or external compliance duty is complete.',
    implementationEvidence: [
      'src/service/hosted-observability-privacy-incident-evidence.ts',
      'scripts/rehearse-production-observability-alerting.ts',
      'src/release-layer/index.ts',
      'src/consequence-admission/audit-evidence-export.ts',
    ],
    validation: [
      'tests/hosted-observability-privacy-incident-evidence.test.ts',
      'tests/production-rehearsal-observability-alerting.test.ts',
      'tests/release-kernel-release-evidence-pack.test.ts',
      'tests/consequence-audit-evidence-export.test.ts',
    ],
    standards: [
      'NIST SP 800-61 Rev. 3: incident response should be incorporated into risk management to improve preparation, detection, response, and recovery.',
      'Google SRE postmortem culture: postmortems should record incident impact, mitigation or resolution actions, root causes, and follow-up actions.',
    ],
  },
  {
    id: 'dashboard.runtime-truth-boundary',
    title: 'Dashboards show runtime truth without promotion overclaim',
    surface: 'dashboard_runtime_truth',
    operationalRisks: [
      'dashboard_overclaims_runtime_readiness',
      'high_cardinality_metric_label',
    ],
    requiredControls: [
      'dashboard_runtime_truth_metric',
      'low_cardinality_metric_labels',
      'operator_runbook_stop_conditions',
      'production_rehearsal_separate_from_claim',
    ],
    signalBoundary:
      'Dashboards depend on low-cardinality metrics and runtime truth labels such as runtime profile, release-runtime readiness, and shared-store request-path posture.',
    evidenceBoundary:
      'Dashboard JSON and production rehearsal tests prove the runtime truth metric is visible before a rollout can be treated as operationally inspectable.',
    incidentBoundary:
      'Incident packets may reference dashboard panels and runtime truth readings, but must keep screenshots and excerpts free of customer payloads and secrets.',
    nonClaimBoundary:
      'A dashboard can expose truth; it cannot make a non-production runtime production-ready or replace target-specific probes.',
    implementationEvidence: [
      'src/service/observability.ts',
      'ops/observability/grafana/dashboards/attestor-overview.json',
      'docs/08-deployment/production-readiness.md',
    ],
    validation: [
      'tests/production-rehearsal-observability-alerting.test.ts',
      'tests/production-runtime-profile.test.ts',
      'tests/observability-bundle.test.ts',
    ],
    standards: [
      'Google SRE monitoring guidance: operational dashboards should expose actionable state, not misleading readiness claims.',
      'OpenTelemetry semantic conventions: stable service and runtime attributes improve correlation across telemetry signals.',
    ],
  },
  {
    id: 'rehearsal.operational-evidence-boundary',
    title: 'Production observability rehearsal remains evidence, not rollout completion',
    surface: 'production_rehearsal_evidence',
    operationalRisks: [
      'dashboard_overclaims_runtime_readiness',
      'runbook_stop_condition_drift',
      'incident_evidence_not_digest_bound',
    ],
    requiredControls: [
      'otlp_receiver_auth_probe',
      'alert_receiver_fanout_probe',
      'dashboard_runtime_truth_metric',
      'operator_runbook_stop_conditions',
      'production_rehearsal_separate_from_claim',
      'privacy_minimized_evidence',
    ],
    signalBoundary:
      'The observability rehearsal exercises telemetry flush, receiver auth, alert routing, runtime truth, dashboard reachability, and runbook stop conditions against the named target.',
    evidenceBoundary:
      'The rehearsal emits summary artifacts and README output with pass/fail state and issue lists, not raw customer data or live secrets.',
    incidentBoundary:
      'Incident packets can cite rehearsal output as preparedness evidence and must still record the live incident timeline separately.',
    nonClaimBoundary:
      'Repo-side rehearsal code is complete only as implementation evidence; production rollout remains blocked until a working deployment target runs the probes.',
    implementationEvidence: [
      'scripts/rehearse-production-observability-alerting.ts',
      'docs/08-deployment/production-rehearsal-manifest.example.json',
      'docs/08-deployment/production-readiness.md',
    ],
    validation: [
      'tests/production-rehearsal-observability-alerting.test.ts',
      'tests/production-rehearsal-manifest.test.ts',
      'tests/production-readiness-secret-safe-output.test.ts',
    ],
    standards: [
      'NIST SP 800-61 Rev. 3: response and recovery preparation should be exercised and improved over time.',
      'Google SRE postmortem culture: incident learning requires captured evidence and follow-up action ownership.',
    ],
  },
];

export function hostedObservabilityPrivacyIncidentEvidenceProfile(): {
  readonly version: string;
  readonly posture: string;
  readonly currentClaim: string;
  readonly unresolvedProductionDependency: string;
  readonly incidentPacketShape: HostedIncidentPacketShape;
  readonly guards: readonly HostedObservabilityPrivacyIncidentGuard[];
} {
  return {
    version: HOSTED_OBSERVABILITY_PRIVACY_INCIDENT_EVIDENCE_VERSION,
    posture:
      'Privacy-safe request telemetry, low-cardinality labels, alert routing context, incident packet shape, dashboard runtime truth, and rehearsal evidence are machine-readable repo contracts.',
    currentClaim:
      'The repository hardens observability and incident evidence; it does not claim external collector, dashboard, alert receiver, retention, or live production rollout readiness.',
    unresolvedProductionDependency:
      'Step 10 still requires a working deployment target, real observability backend inputs, service restart, receiver probes, webhook smoke tests, and hosted product smoke tests.',
    incidentPacketShape: HOSTED_OBSERVABILITY_INCIDENT_PACKET_SHAPE,
    guards: HOSTED_OBSERVABILITY_PRIVACY_INCIDENT_GUARDS,
  };
}

export function requireHostedObservabilityPrivacyIncidentGuard(
  id: string,
): HostedObservabilityPrivacyIncidentGuard {
  const guard = HOSTED_OBSERVABILITY_PRIVACY_INCIDENT_GUARDS.find((item) => item.id === id);
  if (!guard) {
    throw new Error(`Unknown hosted observability privacy incident guard: ${id}`);
  }
  return guard;
}
