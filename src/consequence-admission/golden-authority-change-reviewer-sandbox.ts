import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  createCanonicalShadowEvent,
  type CanonicalShadowEvent,
  type CanonicalShadowEventDecision,
  type CanonicalShadowEventReference,
} from './canonical-shadow-event-schema.js';
import {
  type GoldenAuthorityChangeShadowFixtureAuthorityFacts,
  type GoldenAuthorityChangeShadowFixturePosture,
} from './golden-authority-change-shadow-fixtures.js';
import {
  runShadowRuntimeFixtureReplaySmoke,
  type ShadowRuntimeFixtureReplaySmokeResult,
} from './shadow-runtime-fixture-replay-smoke.js';

export const GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_VERSION =
  'attestor.golden-authority-change-reviewer-sandbox.v1';
export const GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_INPUT_VERSION =
  'attestor.golden-authority-change-reviewer-sandbox-input.v1';

export const GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_ALLOWED_KEYS = [
  'version',
  'actionSurface',
  'targetSystem',
  'authorityClass',
  'subjectClass',
  'resourceClass',
  'permissionClass',
  'approvalFreshness',
  'tenantScope',
  'separationOfDuties',
  'leastPrivilege',
  'instructionLikeEvidence',
  'externalSideEffect',
  'breakGlass',
] as const;

export const GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_GATE_ORDER = [
  'schema-validation',
  'tenant-scope-binding',
  'approval-freshness-check',
  'least-privilege-check',
  'separation-of-duties-check',
  'instruction-like-evidence-review',
  'shadow-runtime-smoke',
  'decision-summary',
] as const;
export type GoldenAuthorityChangeReviewerSandboxGate =
  typeof GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_GATE_ORDER[number];

export const GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_SOURCE_ANCHORS = [
  'strict-json-allowlisted-shape',
  'owasp-input-validation-allowlist',
  'nist-abac-subject-resource-action-environment',
  'nist-sp-800-53-access-control-audit-events',
  'identity-governance-workflow-shape',
] as const;

export type GoldenAuthorityChangeReviewerSandboxStatus =
  | 'accepted'
  | 'invalid-schema'
  | 'outside-scope';

export interface GoldenAuthorityChangeReviewerSandboxInput {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_INPUT_VERSION;
  readonly actionSurface: string;
  readonly targetSystem: GoldenAuthorityChangeShadowFixtureAuthorityFacts['targetSystem'];
  readonly authorityClass: GoldenAuthorityChangeShadowFixtureAuthorityFacts['authorityClass'];
  readonly subjectClass: GoldenAuthorityChangeShadowFixtureAuthorityFacts['subjectClass'];
  readonly resourceClass: GoldenAuthorityChangeShadowFixtureAuthorityFacts['resourceClass'];
  readonly permissionClass: GoldenAuthorityChangeShadowFixtureAuthorityFacts['permissionClass'];
  readonly approvalFreshness: GoldenAuthorityChangeShadowFixtureAuthorityFacts['approvalFreshness'];
  readonly tenantScope: GoldenAuthorityChangeShadowFixtureAuthorityFacts['tenantScope'];
  readonly separationOfDuties: GoldenAuthorityChangeShadowFixtureAuthorityFacts['separationOfDuties'];
  readonly leastPrivilege: GoldenAuthorityChangeShadowFixtureAuthorityFacts['leastPrivilege'];
  readonly instructionLikeEvidence: boolean;
  readonly externalSideEffect: boolean;
  readonly breakGlass: boolean;
}

export interface GoldenAuthorityChangeReviewerSandboxSafetyBoundary {
  readonly noTargetSystemCall: true;
  readonly noIdentityProviderCall: true;
  readonly noAccessChange: true;
  readonly noAuditWrite: true;
  readonly noPolicyActivation: true;
  readonly noLearningActivation: true;
  readonly noTrainingActivation: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly rawIdentityAttributesRead: false;
  readonly rawIdentityAttributesStored: false;
  readonly productionReady: false;
}

export interface GoldenAuthorityChangeReviewerSandboxDecisionSummary {
  readonly shadowDecision: CanonicalShadowEventDecision['shadowDecision'];
  readonly effectiveDecision: CanonicalShadowEventDecision['effectiveDecision'];
  readonly packetDecision: 'admit' | 'narrow' | 'review' | 'block';
  readonly fusionPosture: string;
  readonly conflictOutcome: string;
  readonly humanStatus: string;
  readonly evidenceCompletenessPercent: number;
  readonly reasonCodes: readonly string[];
  readonly decisionRelevantDigest: string;
}

export interface GoldenAuthorityChangeReviewerSandboxResult {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_VERSION;
  readonly step: 'A04';
  readonly generatedAt: string;
  readonly inputVersion: typeof GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_INPUT_VERSION | null;
  readonly inputStatus: GoldenAuthorityChangeReviewerSandboxStatus;
  readonly inputDigest: string | null;
  readonly engineScope: 'authority_change.identity_workflow';
  readonly requestedActionSurface: string | null;
  readonly schemaErrors: readonly string[];
  readonly issueCodes: readonly string[];
  readonly expectedPosture: GoldenAuthorityChangeShadowFixturePosture | null;
  readonly eventDigest: string | null;
  readonly smokeDigest: string | null;
  readonly envelopeRefDigest: string | null;
  readonly assurancePacketDigest: string | null;
  readonly gateOrder: typeof GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_GATE_ORDER;
  readonly decisionSummary: GoldenAuthorityChangeReviewerSandboxDecisionSummary | null;
  readonly smokeResult: ShadowRuntimeFixtureReplaySmokeResult | null;
  readonly sourceAnchors: typeof GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_SOURCE_ANCHORS;
  readonly noClaims: readonly string[];
  readonly safetyBoundary: GoldenAuthorityChangeReviewerSandboxSafetyBoundary;
  readonly engineRan: boolean;
  readonly shadowOnly: true;
  readonly previewOnly: true;
  readonly reviewerSupplied: true;
  readonly canonical: string;
  readonly digest: string;
}

const GENERATED_AT = '2026-05-25T12:00:00.000Z';
const BASE_OCCURRED_AT = '2026-05-25T12:00:00.000Z';
const BASE_OBSERVED_AT = '2026-05-25T12:00:01.000Z';
const ENGINE_SCOPE = 'authority_change.identity_workflow' as const;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

const TARGET_SYSTEMS: readonly GoldenAuthorityChangeShadowFixtureAuthorityFacts['targetSystem'][] = [
  'okta-workflows-authority',
  'microsoft-entra-lifecycle-workflows',
  'sailpoint-workflows',
] as const;
const AUTHORITY_CLASSES: readonly GoldenAuthorityChangeShadowFixtureAuthorityFacts['authorityClass'][] = [
  'group-membership',
  'application-assignment',
  'privileged-role',
  'policy-rule',
  'access-package',
  'entitlement',
  'break-glass',
  'delegation',
  'revocation',
] as const;
const SUBJECT_CLASSES: readonly GoldenAuthorityChangeShadowFixtureAuthorityFacts['subjectClass'][] = [
  'workforce-user',
  'service-account',
  'external-collaborator',
  'break-glass-account',
  'cross-tenant-principal',
] as const;
const RESOURCE_CLASSES: readonly GoldenAuthorityChangeShadowFixtureAuthorityFacts['resourceClass'][] = [
  'standard-group',
  'privileged-group',
  'application',
  'access-package',
  'policy-rule',
  'entitlement',
  'admin-role',
] as const;
const PERMISSION_CLASSES: readonly GoldenAuthorityChangeShadowFixtureAuthorityFacts['permissionClass'][] = [
  'member',
  'owner',
  'admin',
  'approver',
  'delegate',
  'read-only',
  'revoke',
] as const;
const APPROVAL_FRESHNESS_VALUES:
readonly GoldenAuthorityChangeShadowFixtureAuthorityFacts['approvalFreshness'][] = [
  'fresh',
  'stale',
  'missing',
] as const;
const TENANT_SCOPE_VALUES: readonly GoldenAuthorityChangeShadowFixtureAuthorityFacts['tenantScope'][] = [
  'tenant-bound',
  'tenant-mismatch',
] as const;
const SEPARATION_VALUES:
readonly GoldenAuthorityChangeShadowFixtureAuthorityFacts['separationOfDuties'][] = [
  'clear',
  'conflict',
  'unknown',
] as const;
const LEAST_PRIVILEGE_VALUES:
readonly GoldenAuthorityChangeShadowFixtureAuthorityFacts['leastPrivilege'][] = [
  'satisfied',
  'requires-narrowing',
  'overbroad',
] as const;

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function digestFor(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({ kind, value }).digest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function includesString<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function safetyBoundary(): GoldenAuthorityChangeReviewerSandboxSafetyBoundary {
  return Object.freeze({
    noTargetSystemCall: true,
    noIdentityProviderCall: true,
    noAccessChange: true,
    noAuditWrite: true,
    noPolicyActivation: true,
    noLearningActivation: true,
    noTrainingActivation: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    rawIdentityAttributesRead: false,
    rawIdentityAttributesStored: false,
    productionReady: false,
  });
}

function noClaims(): readonly string[] {
  return Object.freeze([
    'not-live-identity-provider-execution',
    'not-native-okta-entra-or-sailpoint-connector',
    'not-access-governance-product',
    'not-audit-plane-write',
    'not-policy-activation',
    'not-learning-or-training',
    'not-admission-authority',
    'not-production-ready',
  ]);
}

function validateInput(raw: unknown): {
  readonly input: GoldenAuthorityChangeReviewerSandboxInput | null;
  readonly errors: readonly string[];
  readonly requestedActionSurface: string | null;
} {
  if (!isRecord(raw)) {
    return Object.freeze({
      input: null,
      errors: Object.freeze(['input must be a JSON object']),
      requestedActionSurface: null,
    });
  }

  const errors: string[] = [];
  for (const key of Object.keys(raw).sort()) {
    if (!(GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_ALLOWED_KEYS as readonly string[]).includes(key)) {
      errors.push(`unknown field: ${key}`);
    }
  }

  const version = raw.version;
  if (version !== GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_INPUT_VERSION) {
    errors.push(`version must be ${GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_INPUT_VERSION}`);
  }

  const actionSurface = raw.actionSurface;
  const requestedActionSurface = typeof actionSurface === 'string'
    ? actionSurface.trim()
    : null;
  if (
    typeof actionSurface !== 'string' ||
    actionSurface.trim().length === 0 ||
    actionSurface.trim().length > 96 ||
    CONTROL_CHARACTER_PATTERN.test(actionSurface)
  ) {
    errors.push('actionSurface must be a non-empty bounded string');
  }

  if (!includesString(TARGET_SYSTEMS, raw.targetSystem)) {
    errors.push(`targetSystem must be one of ${TARGET_SYSTEMS.join(', ')}`);
  }
  if (!includesString(AUTHORITY_CLASSES, raw.authorityClass)) {
    errors.push(`authorityClass must be one of ${AUTHORITY_CLASSES.join(', ')}`);
  }
  if (!includesString(SUBJECT_CLASSES, raw.subjectClass)) {
    errors.push(`subjectClass must be one of ${SUBJECT_CLASSES.join(', ')}`);
  }
  if (!includesString(RESOURCE_CLASSES, raw.resourceClass)) {
    errors.push(`resourceClass must be one of ${RESOURCE_CLASSES.join(', ')}`);
  }
  if (!includesString(PERMISSION_CLASSES, raw.permissionClass)) {
    errors.push(`permissionClass must be one of ${PERMISSION_CLASSES.join(', ')}`);
  }
  if (!includesString(APPROVAL_FRESHNESS_VALUES, raw.approvalFreshness)) {
    errors.push(`approvalFreshness must be one of ${APPROVAL_FRESHNESS_VALUES.join(', ')}`);
  }
  if (!includesString(TENANT_SCOPE_VALUES, raw.tenantScope)) {
    errors.push(`tenantScope must be one of ${TENANT_SCOPE_VALUES.join(', ')}`);
  }
  if (!includesString(SEPARATION_VALUES, raw.separationOfDuties)) {
    errors.push(`separationOfDuties must be one of ${SEPARATION_VALUES.join(', ')}`);
  }
  if (!includesString(LEAST_PRIVILEGE_VALUES, raw.leastPrivilege)) {
    errors.push(`leastPrivilege must be one of ${LEAST_PRIVILEGE_VALUES.join(', ')}`);
  }
  if (typeof raw.instructionLikeEvidence !== 'boolean') {
    errors.push('instructionLikeEvidence must be boolean');
  }
  if (typeof raw.externalSideEffect !== 'boolean') {
    errors.push('externalSideEffect must be boolean');
  }
  if (typeof raw.breakGlass !== 'boolean') errors.push('breakGlass must be boolean');

  if (errors.length > 0) {
    return Object.freeze({
      input: null,
      errors: Object.freeze(errors),
      requestedActionSurface,
    });
  }

  return Object.freeze({
    input: Object.freeze({
      version: GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_INPUT_VERSION,
      actionSurface: requestedActionSurface ?? ENGINE_SCOPE,
      targetSystem: raw.targetSystem as GoldenAuthorityChangeShadowFixtureAuthorityFacts['targetSystem'],
      authorityClass: raw.authorityClass as GoldenAuthorityChangeShadowFixtureAuthorityFacts['authorityClass'],
      subjectClass: raw.subjectClass as GoldenAuthorityChangeShadowFixtureAuthorityFacts['subjectClass'],
      resourceClass: raw.resourceClass as GoldenAuthorityChangeShadowFixtureAuthorityFacts['resourceClass'],
      permissionClass: raw.permissionClass as GoldenAuthorityChangeShadowFixtureAuthorityFacts['permissionClass'],
      approvalFreshness: raw.approvalFreshness as GoldenAuthorityChangeShadowFixtureAuthorityFacts['approvalFreshness'],
      tenantScope: raw.tenantScope as GoldenAuthorityChangeShadowFixtureAuthorityFacts['tenantScope'],
      separationOfDuties: raw.separationOfDuties as GoldenAuthorityChangeShadowFixtureAuthorityFacts['separationOfDuties'],
      leastPrivilege: raw.leastPrivilege as GoldenAuthorityChangeShadowFixtureAuthorityFacts['leastPrivilege'],
      instructionLikeEvidence: raw.instructionLikeEvidence as boolean,
      externalSideEffect: raw.externalSideEffect as boolean,
      breakGlass: raw.breakGlass as boolean,
    }),
    errors: Object.freeze([]),
    requestedActionSurface,
  });
}

function detectIssueCodes(
  input: GoldenAuthorityChangeReviewerSandboxInput,
): readonly string[] {
  const reasons = ['reviewer-sandbox:schema-valid'];
  if (input.tenantScope === 'tenant-mismatch' ||
    input.subjectClass === 'cross-tenant-principal') {
    reasons.push('authority-change:tenant-scope-mismatch', 'authority-change:block-cross-tenant-access-change');
  }
  if (input.breakGlass && input.approvalFreshness === 'missing') {
    reasons.push('authority-change:break-glass-approval-missing', 'authority-change:block-break-glass-without-approval');
  }
  if (input.approvalFreshness === 'missing') {
    reasons.push('authority-change:approval-missing', 'authority-change:hold-for-approval');
  }
  if (input.approvalFreshness === 'stale') {
    reasons.push('authority-change:approval-stale', 'authority-change:block-stale-entitlement-change');
  }
  if (input.leastPrivilege === 'requires-narrowing' || input.leastPrivilege === 'overbroad') {
    reasons.push('authority-change:overbroad-privilege', 'authority-change:narrow-privilege-scope');
  }
  if (input.separationOfDuties === 'conflict') {
    reasons.push('authority-change:separation-of-duties-conflict');
  }
  if (input.authorityClass === 'delegation' || input.externalSideEffect) {
    reasons.push('authority-change:external-delegation-unapproved');
  }
  if (input.instructionLikeEvidence) {
    reasons.push(
      'authority-change:instruction-like-ticket-text',
      'authority-change:ignore-evidence-as-instruction',
    );
  }
  if (reasons.length === 1) {
    reasons.push('authority-change:least-privilege-satisfied', 'authority-change:shadow-ready');
  }
  return Object.freeze([...new Set(reasons)].sort());
}

function expectedPostureFor(
  input: GoldenAuthorityChangeReviewerSandboxInput,
): GoldenAuthorityChangeShadowFixturePosture {
  if (input.tenantScope === 'tenant-mismatch' ||
    input.subjectClass === 'cross-tenant-principal') {
    return 'blocked-tenant-mismatch';
  }
  if (input.breakGlass && input.approvalFreshness === 'missing') {
    return 'blocked-break-glass-approval-missing';
  }
  if (input.approvalFreshness === 'stale') return 'blocked-stale-approval';
  if (input.instructionLikeEvidence) return 'needs-instruction-text-review';
  if (input.authorityClass === 'delegation' || input.externalSideEffect) {
    return 'needs-delegation-review';
  }
  if (input.leastPrivilege === 'requires-narrowing' || input.leastPrivilege === 'overbroad') {
    return 'needs-privilege-narrowing';
  }
  if (input.authorityClass === 'revocation' || input.permissionClass === 'revoke') {
    return 'revocation-ready-with-approval';
  }
  return 'shadow-ready';
}

function decisionFor(issueCodes: readonly string[]): CanonicalShadowEventDecision {
  const block = issueCodes.some((code) =>
    code === 'authority-change:block-cross-tenant-access-change' ||
    code === 'authority-change:block-break-glass-without-approval' ||
    code === 'authority-change:block-stale-entitlement-change'
  );
  const narrow = issueCodes.includes('authority-change:narrow-privilege-scope');
  const reviewNeeded = issueCodes.some((code) =>
    code !== 'reviewer-sandbox:schema-valid' &&
    code !== 'authority-change:least-privilege-satisfied' &&
    code !== 'authority-change:shadow-ready'
  );
  const shadowDecision = block
    ? 'would_block'
    : narrow
      ? 'would_narrow'
      : reviewNeeded
        ? 'would_review'
        : 'would_admit';
  return Object.freeze({
    admissionDigest: null,
    mode: reviewNeeded ? 'review' : 'observe',
    shadowDecision,
    effectiveDecision: block ? 'block' : 'review',
    allowed: false,
    failClosed: true,
    reasonCodes: issueCodes,
  });
}

function actionNameFor(
  input: GoldenAuthorityChangeReviewerSandboxInput,
): 'add_user_to_group' | 'assign_access_package' | 'grant_privileged_role' | 'activate_policy_rule' | 'delegate_approval_authority' | 'change_entitlement' | 'revoke_access' {
  if (input.authorityClass === 'revocation' || input.permissionClass === 'revoke') {
    return 'revoke_access';
  }
  if (input.authorityClass === 'privileged-role' || input.resourceClass === 'admin-role') {
    return 'grant_privileged_role';
  }
  if (input.authorityClass === 'delegation') return 'delegate_approval_authority';
  if (input.authorityClass === 'access-package') return 'assign_access_package';
  if (input.authorityClass === 'policy-rule') return 'activate_policy_rule';
  if (input.authorityClass === 'entitlement') return 'change_entitlement';
  return 'add_user_to_group';
}

function ref(
  kind: CanonicalShadowEventReference['kind'],
  value: CanonicalReleaseJsonValue,
  origin: CanonicalShadowEventReference['origin'] = 'observed',
): CanonicalShadowEventReference {
  return Object.freeze({
    kind,
    digest: digestFor(kind, value),
    origin,
  });
}

function evidenceSeedsFor(
  input: GoldenAuthorityChangeReviewerSandboxInput,
): readonly string[] {
  const seeds = [
    'authority-policy',
    `approval-${input.approvalFreshness}`,
    `least-privilege-${input.leastPrivilege}`,
    `sod-${input.separationOfDuties}`,
  ];
  if (input.instructionLikeEvidence) seeds.push('instruction-like-ticket-evidence');
  if (input.breakGlass) seeds.push('break-glass-evidence');
  if (input.externalSideEffect) seeds.push('external-delegation-evidence');
  return Object.freeze(seeds);
}

function createSandboxEvent(
  input: GoldenAuthorityChangeReviewerSandboxInput,
  inputDigest: string,
  issueCodes: readonly string[],
): CanonicalShadowEvent {
  const resourceRefDigest = digestFor('resource', {
    scope: 'golden-authority-change-reviewer-sandbox',
    resourceClass: input.resourceClass,
    inputDigest,
  });
  const targetAccountRefDigest = digestFor('target-account', {
    scope: 'golden-authority-change-reviewer-sandbox',
    targetSystem: input.targetSystem,
    inputDigest,
  });
  const principalRefDigest = digestFor('actor', {
    scope: 'golden-authority-change-reviewer-sandbox',
    subjectClass: input.subjectClass,
    inputDigest,
  });
  const scenarioPrefix = `golden-authority-change-reviewer-sandbox:${inputDigest}`;
  return createCanonicalShadowEvent({
    occurredAt: BASE_OCCURRED_AT,
    observedAt: BASE_OBSERVED_AT,
    sourceKind: 'admission-shadow',
    producer: 'attestor.golden-authority-change-reviewer-sandbox',
    tenantRefDigest: digestFor('tenant', 'golden-authority-change-reviewer-sandbox-tenant'),
    actorRefDigest: digestFor('actor', 'golden-authority-change-reviewer-sandbox-reviewer'),
    observed: {
      targetSystem: input.targetSystem,
      targetAccountRefDigest,
      actionName: actionNameFor(input),
      actionKind: 'tool-call',
      consequenceClass: 'authority-change',
      resourceRefDigest,
      dataClass: null,
      amountAssetChain: null,
      authorityDelta: {
        authorityKind: input.authorityClass,
        principalRefDigest,
        resourceRefDigest,
        permissionRefDigest: digestFor('authority', input.permissionClass),
      },
    },
    inferred: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: null,
      consequenceClass: 'authority-change',
      resourceRefDigest: null,
      dataClass: null,
      amountAssetChain: null,
      authorityDelta: {
        authorityKind: input.authorityClass,
        principalRefDigest,
        resourceRefDigest,
        permissionRefDigest: digestFor('authority', `${input.permissionClass}:review-only`),
      },
    },
    decision: decisionFor(issueCodes),
    outcome: {
      downstreamOutcome: 'blocked',
      humanOutcome: issueCodes.includes('authority-change:shadow-ready') ? null : 'not-reviewed',
    },
    evidenceRefs: evidenceSeedsFor(input).map((seed) =>
      ref('evidence', `${scenarioPrefix}:${seed}`)
    ),
    simulationRefs: [
      ref('simulation', `${scenarioPrefix}:shadow-runtime-replay`, 'inferred'),
    ],
    approvalRefs: input.approvalFreshness === 'missing'
      ? []
      : [
          ref('approval', `${scenarioPrefix}:approval-${input.approvalFreshness}`),
        ],
    receiptRefs: [],
    policyRefs: [
      ref('policy', `${scenarioPrefix}:review-only-policy-candidate`, 'inferred'),
    ],
    idempotencyRefDigest: digestFor('idempotency', {
      scope: 'golden-authority-change-reviewer-sandbox',
      inputDigest,
    }),
    replayRefDigest: digestFor('replay', {
      scope: 'golden-authority-change-reviewer-sandbox',
      inputDigest,
    }),
    traceRefDigest: digestFor('trace', {
      scope: 'golden-authority-change-reviewer-sandbox',
      inputDigest,
    }),
    schemaRefDigest: digestFor('schema', CANONICAL_SHADOW_EVENT_SCHEMA_VERSION),
    rawMaterialPolicy: 'digest-only',
  });
}

function runSandboxSmoke(
  event: CanonicalShadowEvent,
  inputDigest: string,
): ShadowRuntimeFixtureReplaySmokeResult {
  const fixtureRefDigest = digestFor('golden-authority-change-reviewer-sandbox.fixture', {
    inputDigest,
    eventDigest: event.digest,
  });
  return runShadowRuntimeFixtureReplaySmoke({
    fixtureId: 'golden-authority-change-reviewer-sandbox:reviewer-input',
    fixtureRefDigest,
    event,
    sourcePartitionDigest: digestFor(
      'golden-authority-change-reviewer-sandbox.source-partition',
      'single-reviewer-input',
    ),
    traceContextDigest: digestFor('golden-authority-change-reviewer-sandbox.trace-context', {
      inputDigest,
      eventDigest: event.digest,
    }),
    sourceHistoryRefDigest: digestFor(
      'golden-authority-change-reviewer-sandbox.source-history',
      'single-reviewer-input',
    ),
    sourceHistorySequence: 1,
    requestedAt: '2026-05-25T12:00:02.000Z',
    claimedAt: '2026-05-25T12:00:03.000Z',
    generatedAt: '2026-05-25T12:00:04.000Z',
    observedAt: '2026-05-25T12:00:05.000Z',
    outcomeObservedAt: '2026-05-25T12:00:06.000Z',
    feedbackGeneratedAt: '2026-05-25T12:00:07.000Z',
    evaluatedAt: '2026-05-25T12:00:08.000Z',
    workerRefDigest: digestFor('golden-authority-change-reviewer-sandbox.worker', 'fixture-only-worker'),
    dispatcherRunDigest: digestFor(
      'golden-authority-change-reviewer-sandbox.dispatcher',
      inputDigest,
    ),
    observerRefDigest: digestFor(
      'golden-authority-change-reviewer-sandbox.observer',
      'fixture-only-observer',
    ),
    evaluatorRefDigest: digestFor(
      'golden-authority-change-reviewer-sandbox.evaluator',
      'fixture-only-evaluator',
    ),
    scopeDigest: digestFor(
      'golden-authority-change-reviewer-sandbox.scope',
      'shadow-only-reviewer-sandbox',
    ),
  });
}

function completenessPercent(coverageGapScore: number): number {
  return Math.max(0, Math.min(100, Math.round((1 - coverageGapScore) * 100)));
}

function decisionSummaryFor(input: {
  readonly event: CanonicalShadowEvent;
  readonly smoke: ShadowRuntimeFixtureReplaySmokeResult;
  readonly issueCodes: readonly string[];
}): GoldenAuthorityChangeReviewerSandboxDecisionSummary {
  const pipeline = input.smoke.activation.pipeline;
  const material = {
    shadowDecision: input.event.decision.shadowDecision,
    effectiveDecision: input.event.decision.effectiveDecision,
    packetDecision: pipeline.assurancePacket.decisionBinding.decision,
    fusionPosture: pipeline.fusion.posture,
    conflictOutcome: pipeline.conflictGate.outcome,
    humanStatus: pipeline.humanComprehensionGate.status,
    evidenceCompletenessPercent: completenessPercent(
      pipeline.conflictGate.coverageGapScore,
    ),
    reasonCodes: Object.freeze([...new Set([
      ...input.issueCodes,
      ...pipeline.fusion.reasonCodes,
      ...pipeline.conflictGate.reasonCodes,
      ...pipeline.humanComprehensionGate.reasonCodes,
      ...pipeline.assurancePacket.decisionBinding.reasonCodes,
    ])].sort()),
  } as const;
  return Object.freeze({
    ...material,
    decisionRelevantDigest: digestFor(
      'golden-authority-change-reviewer-sandbox.decision-summary',
      material as unknown as CanonicalReleaseJsonValue,
    ),
  });
}

function resultFor(input: Omit<GoldenAuthorityChangeReviewerSandboxResult, 'canonical' | 'digest'>):
GoldenAuthorityChangeReviewerSandboxResult {
  const canonical = canonicalObject(input as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...input,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function runGoldenAuthorityChangeReviewerSandbox(
  rawInput: unknown,
): GoldenAuthorityChangeReviewerSandboxResult {
  const validated = validateInput(rawInput);
  if (!validated.input) {
    return resultFor({
      version: GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_VERSION,
      step: 'A04',
      generatedAt: GENERATED_AT,
      inputVersion: null,
      inputStatus: 'invalid-schema',
      inputDigest: null,
      engineScope: ENGINE_SCOPE,
      requestedActionSurface: validated.requestedActionSurface,
      schemaErrors: validated.errors,
      issueCodes: Object.freeze(['reviewer-sandbox:invalid-schema']),
      expectedPosture: null,
      eventDigest: null,
      smokeDigest: null,
      envelopeRefDigest: null,
      assurancePacketDigest: null,
      gateOrder: GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_GATE_ORDER,
      decisionSummary: null,
      smokeResult: null,
      sourceAnchors: GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_SOURCE_ANCHORS,
      noClaims: noClaims(),
      safetyBoundary: safetyBoundary(),
      engineRan: false,
      shadowOnly: true,
      previewOnly: true,
      reviewerSupplied: true,
    });
  }

  const inputDigest = digestFor(
    'golden-authority-change-reviewer-sandbox.input',
    validated.input as unknown as CanonicalReleaseJsonValue,
  );
  if (validated.input.actionSurface !== ENGINE_SCOPE) {
    return resultFor({
      version: GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_VERSION,
      step: 'A04',
      generatedAt: GENERATED_AT,
      inputVersion: validated.input.version,
      inputStatus: 'outside-scope',
      inputDigest,
      engineScope: ENGINE_SCOPE,
      requestedActionSurface: validated.input.actionSurface,
      schemaErrors: Object.freeze([]),
      issueCodes: Object.freeze(['reviewer-sandbox:outside-golden-authority-change-scope']),
      expectedPosture: null,
      eventDigest: null,
      smokeDigest: null,
      envelopeRefDigest: null,
      assurancePacketDigest: null,
      gateOrder: GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_GATE_ORDER,
      decisionSummary: null,
      smokeResult: null,
      sourceAnchors: GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_SOURCE_ANCHORS,
      noClaims: noClaims(),
      safetyBoundary: safetyBoundary(),
      engineRan: false,
      shadowOnly: true,
      previewOnly: true,
      reviewerSupplied: true,
    });
  }

  const issueCodes = detectIssueCodes(validated.input);
  const event = createSandboxEvent(validated.input, inputDigest, issueCodes);
  const smoke = runSandboxSmoke(event, inputDigest);
  const decisionSummary = decisionSummaryFor({ event, smoke, issueCodes });
  return resultFor({
    version: GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_VERSION,
    step: 'A04',
    generatedAt: GENERATED_AT,
    inputVersion: validated.input.version,
    inputStatus: 'accepted',
    inputDigest,
    engineScope: ENGINE_SCOPE,
    requestedActionSurface: validated.input.actionSurface,
    schemaErrors: Object.freeze([]),
    issueCodes,
    expectedPosture: expectedPostureFor(validated.input),
    eventDigest: event.digest,
    smokeDigest: smoke.digest,
    envelopeRefDigest: smoke.envelopeRefDigest,
    assurancePacketDigest: smoke.activation.assurancePacketDigest,
    gateOrder: GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_GATE_ORDER,
    decisionSummary,
    smokeResult: null,
    sourceAnchors: GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_SOURCE_ANCHORS,
    noClaims: noClaims(),
    safetyBoundary: safetyBoundary(),
    engineRan: true,
    shadowOnly: true,
    previewOnly: true,
    reviewerSupplied: true,
  });
}

function list(items: readonly string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- none';
}

export function renderGoldenAuthorityChangeReviewerSandboxMarkdown(
  result: GoldenAuthorityChangeReviewerSandboxResult,
): string {
  const decision = result.decisionSummary;
  return `# Golden Path: Authority Change Reviewer Sandbox

Status: ${result.inputStatus}

## Practical Contrast

Without Attestor for this local input:

- no Attestor issue-code report
- no explicit no-claim boundary
- no decision-relevant digest from this engine

With Attestor for this local input:

- result status: ${result.inputStatus}
- engine ran: ${result.engineRan}
- visible gate stages: ${result.gateOrder.length}
- issue codes: ${result.issueCodes.length}
- identity-provider calls: ${result.safetyBoundary.noIdentityProviderCall ? '0' : 'present'}
- access changes: ${result.safetyBoundary.noAccessChange ? '0' : 'present'}
- decision digest: ${decision?.decisionRelevantDigest ?? 'none'}

## Input Boundary

- engine scope: ${result.engineScope}
- requested action surface: ${result.requestedActionSurface ?? 'not provided'}
- engine ran: ${result.engineRan}
- input digest: ${result.inputDigest ?? 'none'}

## Schema Errors

${list(result.schemaErrors)}

## Issue Codes

${list(result.issueCodes)}

## Decision Summary

- expected posture: ${result.expectedPosture ?? 'none'}
- shadow decision: ${decision?.shadowDecision ?? 'none'}
- effective decision: ${decision?.effectiveDecision ?? 'none'}
- packet decision: ${decision?.packetDecision ?? 'none'}
- fusion posture: ${decision?.fusionPosture ?? 'none'}
- conflict outcome: ${decision?.conflictOutcome ?? 'none'}
- human gate: ${decision?.humanStatus ?? 'none'}
- evidence completeness: ${decision?.evidenceCompletenessPercent ?? 0}%
- decision digest: ${decision?.decisionRelevantDigest ?? 'none'}

## Gate Trace

${result.gateOrder.map((gate, index) => `${index + 1}. ${gate}`).join('\n')}

## No-Claims

${list(result.noClaims)}

## Safety Boundary

- target-system calls: ${result.safetyBoundary.noTargetSystemCall ? '0' : 'present'}
- identity-provider calls: ${result.safetyBoundary.noIdentityProviderCall ? '0' : 'present'}
- access changes: ${result.safetyBoundary.noAccessChange ? '0' : 'present'}
- audit writes: ${result.safetyBoundary.noAuditWrite ? '0' : 'present'}
- policy activation: ${result.safetyBoundary.noPolicyActivation ? '0' : 'present'}
- learning/training activation: ${result.safetyBoundary.noLearningActivation && result.safetyBoundary.noTrainingActivation ? '0' : 'present'}
- grants authority: ${result.safetyBoundary.grantsAuthority}
- can admit: ${result.safetyBoundary.canAdmit}
- production ready: ${result.safetyBoundary.productionReady}
`;
}

export function renderGoldenAuthorityChangeReviewerSandboxJson(
  result: GoldenAuthorityChangeReviewerSandboxResult,
): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
