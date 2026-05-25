import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  createCanonicalShadowEvent,
  type CanonicalShadowEvent,
  type CanonicalShadowEventActionKind,
  type CanonicalShadowEventDecision,
  type CanonicalShadowEventReference,
} from './canonical-shadow-event-schema.js';
import type { ConsequenceAdmissionDecision } from './index.js';

export const GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION =
  'attestor.golden-authority-change-shadow-fixtures.v1';

export const GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURE_SCENARIOS = [
  'standard-group-grant-approved',
  'privileged-role-narrowing',
  'break-glass-unapproved',
  'external-delegation-review',
  'tenant-scope-mismatch',
  'stale-approval',
  'prompt-injection-in-ticket',
  'revocation-ready',
] as const;
export type GoldenAuthorityChangeShadowFixtureScenario =
  typeof GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURE_SCENARIOS[number];

export const GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURE_POSTURES = [
  'shadow-ready',
  'needs-privilege-narrowing',
  'blocked-break-glass-approval-missing',
  'needs-delegation-review',
  'blocked-tenant-mismatch',
  'blocked-stale-approval',
  'needs-instruction-text-review',
  'revocation-ready-with-approval',
] as const;
export type GoldenAuthorityChangeShadowFixturePosture =
  typeof GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURE_POSTURES[number];

export const GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURE_NON_CLAIMS = [
  'not-live-identity-provider-execution',
  'not-native-okta-entra-or-sailpoint-connector',
  'not-customer-pep-enforcement-proof',
  'not-system-of-record-ownership',
  'not-production-ready',
] as const;

export interface GoldenAuthorityChangeShadowFixtureAuthorityFacts {
  readonly targetSystem:
    | 'okta-workflows-authority'
    | 'microsoft-entra-lifecycle-workflows'
    | 'sailpoint-workflows';
  readonly authorityClass:
    | 'group-membership'
    | 'application-assignment'
    | 'privileged-role'
    | 'policy-rule'
    | 'access-package'
    | 'entitlement'
    | 'break-glass'
    | 'delegation'
    | 'revocation';
  readonly subjectClass:
    | 'workforce-user'
    | 'service-account'
    | 'external-collaborator'
    | 'break-glass-account'
    | 'cross-tenant-principal';
  readonly resourceClass:
    | 'standard-group'
    | 'privileged-group'
    | 'application'
    | 'access-package'
    | 'policy-rule'
    | 'entitlement'
    | 'admin-role';
  readonly permissionClass:
    | 'member'
    | 'owner'
    | 'admin'
    | 'approver'
    | 'delegate'
    | 'read-only'
    | 'revoke';
  readonly approvalFreshness: 'fresh' | 'stale' | 'missing';
  readonly tenantScope: 'tenant-bound' | 'tenant-mismatch';
  readonly separationOfDuties: 'clear' | 'conflict' | 'unknown';
  readonly leastPrivilege: 'satisfied' | 'requires-narrowing' | 'overbroad';
  readonly instructionLikeEvidence: boolean;
  readonly externalSideEffect: boolean;
  readonly breakGlass: boolean;
}

export interface GoldenAuthorityChangeShadowFixture {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION;
  readonly scenario: GoldenAuthorityChangeShadowFixtureScenario;
  readonly fixtureId: string;
  readonly expectedPosture: GoldenAuthorityChangeShadowFixturePosture;
  readonly expectedDecision: ConsequenceAdmissionDecision;
  readonly authorityFacts: GoldenAuthorityChangeShadowFixtureAuthorityFacts;
  readonly event: CanonicalShadowEvent;
  readonly sourceRecipeRefDigest: string;
  readonly actionSurfaceRefDigest: string;
  readonly expectedEvidenceStates: readonly string[];
  readonly expectedSignals: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly fixtureOnly: true;
  readonly synthetic: true;
  readonly shadowOnly: true;
  readonly noTargetSystemCall: true;
  readonly noRawPayload: true;
  readonly noRawIdentityAttributes: true;
  readonly noRawCustomerIdentifiers: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenAuthorityChangeShadowFixtureSuite {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION;
  readonly name: 'Golden Path: Authority Change';
  readonly step: 'A01';
  readonly sourceRecipeRefDigest: string;
  readonly actionSurfaceRefDigest: string;
  readonly fixtureCount: 8;
  readonly scenarios: typeof GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURE_SCENARIOS;
  readonly fixtures: readonly GoldenAuthorityChangeShadowFixture[];
  readonly shadowOnly: true;
  readonly noTargetSystemCalls: true;
  readonly noRawPayload: true;
  readonly noRawIdentityAttributes: true;
  readonly noRawCustomerIdentifiers: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenAuthorityChangeShadowFixturesDescriptor {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION;
  readonly step: 'A01';
  readonly sourceSchemaVersion: typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly scenarios: typeof GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURE_SCENARIOS;
  readonly shadowOnly: true;
  readonly synthetic: true;
  readonly noTargetSystemCalls: true;
  readonly noRawPayload: true;
  readonly noRawIdentityAttributes: true;
  readonly noRawCustomerIdentifiers: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly nonClaims: typeof GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURE_NON_CLAIMS;
}

interface ScenarioDefinition {
  readonly scenario: GoldenAuthorityChangeShadowFixtureScenario;
  readonly expectedPosture: GoldenAuthorityChangeShadowFixturePosture;
  readonly expectedDecision: ConsequenceAdmissionDecision;
  readonly authorityFacts: GoldenAuthorityChangeShadowFixtureAuthorityFacts;
  readonly actionName:
    | 'add_user_to_group'
    | 'assign_access_package'
    | 'grant_privileged_role'
    | 'activate_policy_rule'
    | 'delegate_approval_authority'
    | 'change_entitlement'
    | 'revoke_access';
  readonly actionKind: CanonicalShadowEventActionKind;
  readonly expectedEvidenceStates: readonly string[];
  readonly expectedSignals: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly decision: CanonicalShadowEventDecision;
  readonly evidenceSeeds: readonly string[];
  readonly approvalSeeds: readonly string[];
}

const BASE_OCCURRED_AT = '2026-05-25T10:00:00.000Z';
const BASE_OBSERVED_AT = '2026-05-25T10:00:01.000Z';

const SCENARIO_DEFINITIONS: readonly ScenarioDefinition[] = Object.freeze([
  {
    scenario: 'standard-group-grant-approved',
    expectedPosture: 'shadow-ready',
    expectedDecision: 'admit',
    authorityFacts: Object.freeze({
      targetSystem: 'okta-workflows-authority',
      authorityClass: 'group-membership',
      subjectClass: 'workforce-user',
      resourceClass: 'standard-group',
      permissionClass: 'member',
      approvalFreshness: 'fresh',
      tenantScope: 'tenant-bound',
      separationOfDuties: 'clear',
      leastPrivilege: 'satisfied',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      breakGlass: false,
    }),
    actionName: 'add_user_to_group',
    actionKind: 'identity-operation',
    expectedEvidenceStates: Object.freeze(['observed', 'approved', 'fresh']),
    expectedSignals: Object.freeze(['least-privilege-satisfied', 'tenant-bound', 'sod-clear']),
    reasonCodes: Object.freeze([
      'authority-change:standard-group-approved',
      'authority-change:shadow-ready',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'observe',
      shadowDecision: 'would_admit',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'authority-change:standard-group-approved',
        'authority-change:shadow-ready',
      ]),
    }),
    evidenceSeeds: Object.freeze(['access-request', 'approval-decision', 'group-classification']),
    approvalSeeds: Object.freeze(['standard-access-approval']),
  },
  {
    scenario: 'privileged-role-narrowing',
    expectedPosture: 'needs-privilege-narrowing',
    expectedDecision: 'narrow',
    authorityFacts: Object.freeze({
      targetSystem: 'microsoft-entra-lifecycle-workflows',
      authorityClass: 'privileged-role',
      subjectClass: 'workforce-user',
      resourceClass: 'admin-role',
      permissionClass: 'admin',
      approvalFreshness: 'fresh',
      tenantScope: 'tenant-bound',
      separationOfDuties: 'clear',
      leastPrivilege: 'requires-narrowing',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      breakGlass: false,
    }),
    actionName: 'assign_access_package',
    actionKind: 'identity-operation',
    expectedEvidenceStates: Object.freeze(['observed', 'approved', 'overbroad']),
    expectedSignals: Object.freeze(['privilege-narrowing-required', 'least-privilege-pressure']),
    reasonCodes: Object.freeze([
      'authority-change:privileged-role-overbroad',
      'authority-change:narrow-to-time-bound-role',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_narrow',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'authority-change:narrow-to-time-bound-role',
        'authority-change:privileged-role-overbroad',
      ]),
    }),
    evidenceSeeds: Object.freeze(['access-package', 'role-classification', 'approval-decision']),
    approvalSeeds: Object.freeze(['privileged-access-approval']),
  },
  {
    scenario: 'break-glass-unapproved',
    expectedPosture: 'blocked-break-glass-approval-missing',
    expectedDecision: 'block',
    authorityFacts: Object.freeze({
      targetSystem: 'okta-workflows-authority',
      authorityClass: 'break-glass',
      subjectClass: 'break-glass-account',
      resourceClass: 'admin-role',
      permissionClass: 'admin',
      approvalFreshness: 'missing',
      tenantScope: 'tenant-bound',
      separationOfDuties: 'unknown',
      leastPrivilege: 'overbroad',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      breakGlass: true,
    }),
    actionName: 'grant_privileged_role',
    actionKind: 'identity-operation',
    expectedEvidenceStates: Object.freeze(['observed', 'missing-approval', 'break-glass']),
    expectedSignals: Object.freeze(['break-glass-approval-gap', 'admin-role-risk']),
    reasonCodes: Object.freeze([
      'authority-change:break-glass-approval-missing',
      'authority-change:block-privileged-grant',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_block',
      effectiveDecision: 'block',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'authority-change:block-privileged-grant',
        'authority-change:break-glass-approval-missing',
      ]),
    }),
    evidenceSeeds: Object.freeze(['break-glass-request', 'role-classification']),
    approvalSeeds: Object.freeze([]),
  },
  {
    scenario: 'external-delegation-review',
    expectedPosture: 'needs-delegation-review',
    expectedDecision: 'review',
    authorityFacts: Object.freeze({
      targetSystem: 'sailpoint-workflows',
      authorityClass: 'delegation',
      subjectClass: 'external-collaborator',
      resourceClass: 'entitlement',
      permissionClass: 'delegate',
      approvalFreshness: 'missing',
      tenantScope: 'tenant-bound',
      separationOfDuties: 'unknown',
      leastPrivilege: 'requires-narrowing',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      breakGlass: false,
    }),
    actionName: 'delegate_approval_authority',
    actionKind: 'workflow-step',
    expectedEvidenceStates: Object.freeze(['observed', 'missing-approval', 'external-subject']),
    expectedSignals: Object.freeze(['delegation-review-required', 'external-collaborator']),
    reasonCodes: Object.freeze([
      'authority-change:external-delegation-unapproved',
      'authority-change:hold-for-delegation-review',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_review',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'authority-change:external-delegation-unapproved',
        'authority-change:hold-for-delegation-review',
      ]),
    }),
    evidenceSeeds: Object.freeze(['delegation-request', 'entitlement-classification']),
    approvalSeeds: Object.freeze([]),
  },
  {
    scenario: 'tenant-scope-mismatch',
    expectedPosture: 'blocked-tenant-mismatch',
    expectedDecision: 'block',
    authorityFacts: Object.freeze({
      targetSystem: 'microsoft-entra-lifecycle-workflows',
      authorityClass: 'access-package',
      subjectClass: 'cross-tenant-principal',
      resourceClass: 'access-package',
      permissionClass: 'member',
      approvalFreshness: 'fresh',
      tenantScope: 'tenant-mismatch',
      separationOfDuties: 'clear',
      leastPrivilege: 'satisfied',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      breakGlass: false,
    }),
    actionName: 'assign_access_package',
    actionKind: 'identity-operation',
    expectedEvidenceStates: Object.freeze(['observed', 'approved', 'tenant-mismatch']),
    expectedSignals: Object.freeze(['cross-tenant-principal', 'tenant-boundary-fail']),
    reasonCodes: Object.freeze([
      'authority-change:tenant-scope-mismatch',
      'authority-change:block-cross-tenant-access',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_block',
      effectiveDecision: 'block',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'authority-change:block-cross-tenant-access',
        'authority-change:tenant-scope-mismatch',
      ]),
    }),
    evidenceSeeds: Object.freeze(['tenant-binding', 'access-package', 'approval-decision']),
    approvalSeeds: Object.freeze(['wrong-tenant-approval']),
  },
  {
    scenario: 'stale-approval',
    expectedPosture: 'blocked-stale-approval',
    expectedDecision: 'block',
    authorityFacts: Object.freeze({
      targetSystem: 'sailpoint-workflows',
      authorityClass: 'entitlement',
      subjectClass: 'service-account',
      resourceClass: 'entitlement',
      permissionClass: 'owner',
      approvalFreshness: 'stale',
      tenantScope: 'tenant-bound',
      separationOfDuties: 'conflict',
      leastPrivilege: 'overbroad',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      breakGlass: false,
    }),
    actionName: 'change_entitlement',
    actionKind: 'identity-operation',
    expectedEvidenceStates: Object.freeze(['observed', 'stale-approval', 'sod-conflict']),
    expectedSignals: Object.freeze(['approval-revalidation-required', 'sod-conflict']),
    reasonCodes: Object.freeze([
      'authority-change:approval-stale',
      'authority-change:block-stale-entitlement-change',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_block',
      effectiveDecision: 'block',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'authority-change:approval-stale',
        'authority-change:block-stale-entitlement-change',
      ]),
    }),
    evidenceSeeds: Object.freeze(['stale-access-request', 'sod-policy', 'entitlement-classification']),
    approvalSeeds: Object.freeze(['stale-entitlement-approval']),
  },
  {
    scenario: 'prompt-injection-in-ticket',
    expectedPosture: 'needs-instruction-text-review',
    expectedDecision: 'review',
    authorityFacts: Object.freeze({
      targetSystem: 'okta-workflows-authority',
      authorityClass: 'application-assignment',
      subjectClass: 'workforce-user',
      resourceClass: 'application',
      permissionClass: 'member',
      approvalFreshness: 'fresh',
      tenantScope: 'tenant-bound',
      separationOfDuties: 'clear',
      leastPrivilege: 'satisfied',
      instructionLikeEvidence: true,
      externalSideEffect: true,
      breakGlass: false,
    }),
    actionName: 'add_user_to_group',
    actionKind: 'identity-operation',
    expectedEvidenceStates: Object.freeze(['observed', 'approved', 'instruction-like-evidence']),
    expectedSignals: Object.freeze(['untrusted-ticket-text', 'evidence-is-not-authority']),
    reasonCodes: Object.freeze([
      'authority-change:instruction-like-ticket-text',
      'authority-change:ignore-evidence-as-instruction',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_review',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'authority-change:ignore-evidence-as-instruction',
        'authority-change:instruction-like-ticket-text',
      ]),
    }),
    evidenceSeeds: Object.freeze(['access-request-ticket', 'instruction-like-ticket-text', 'approval-decision']),
    approvalSeeds: Object.freeze(['standard-access-approval']),
  },
  {
    scenario: 'revocation-ready',
    expectedPosture: 'revocation-ready-with-approval',
    expectedDecision: 'admit',
    authorityFacts: Object.freeze({
      targetSystem: 'sailpoint-workflows',
      authorityClass: 'revocation',
      subjectClass: 'workforce-user',
      resourceClass: 'entitlement',
      permissionClass: 'revoke',
      approvalFreshness: 'fresh',
      tenantScope: 'tenant-bound',
      separationOfDuties: 'clear',
      leastPrivilege: 'satisfied',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      breakGlass: false,
    }),
    actionName: 'revoke_access',
    actionKind: 'identity-operation',
    expectedEvidenceStates: Object.freeze(['observed', 'approved', 'fresh', 'revocation']),
    expectedSignals: Object.freeze(['revocation-approved', 'least-privilege-restoration']),
    reasonCodes: Object.freeze([
      'authority-change:revocation-approved',
      'authority-change:shadow-ready',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'observe',
      shadowDecision: 'would_admit',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'authority-change:revocation-approved',
        'authority-change:shadow-ready',
      ]),
    }),
    evidenceSeeds: Object.freeze(['revocation-request', 'approval-decision', 'entitlement-classification']),
    approvalSeeds: Object.freeze(['revocation-approval']),
  },
]);

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

function digestFor(kind: string, value: string): string {
  return canonicalObject({ kind, value }).digest;
}

function ref(
  kind: CanonicalShadowEventReference['kind'],
  value: string,
  origin: CanonicalShadowEventReference['origin'] = 'observed',
): CanonicalShadowEventReference {
  return Object.freeze({
    kind,
    digest: digestFor(kind, value),
    origin,
  });
}

function createScenarioEvent(definition: ScenarioDefinition): CanonicalShadowEvent {
  const scenarioPrefix = `golden-authority-change:${definition.scenario}`;
  const resourceRefDigest = digestFor(
    'resource',
    `authority-change:${definition.authorityFacts.resourceClass}:${definition.scenario}`,
  );
  const targetAccountRefDigest = digestFor(
    'target-account',
    `golden-authority-change:${definition.authorityFacts.targetSystem}`,
  );
  const principalRefDigest = digestFor(
    'actor',
    `golden-authority-change:${definition.authorityFacts.subjectClass}`,
  );
  const permissionRefDigest = digestFor(
    'authority',
    `golden-authority-change:${definition.authorityFacts.permissionClass}`,
  );

  return createCanonicalShadowEvent({
    occurredAt: BASE_OCCURRED_AT,
    observedAt: BASE_OBSERVED_AT,
    sourceKind: 'admission-shadow',
    producer: 'attestor.golden-authority-change-shadow-fixtures',
    tenantRefDigest: digestFor('tenant', 'golden-authority-change-synthetic-tenant'),
    actorRefDigest: digestFor('actor', 'golden-authority-change-synthetic-agent'),
    observed: {
      targetSystem: definition.authorityFacts.targetSystem,
      targetAccountRefDigest,
      actionName: definition.actionName,
      actionKind: definition.actionKind,
      consequenceClass: 'authority-change',
      resourceRefDigest,
      dataClass: definition.authorityFacts.authorityClass,
      amountAssetChain: null,
      authorityDelta: {
        authorityKind: definition.authorityFacts.authorityClass,
        principalRefDigest,
        resourceRefDigest,
        permissionRefDigest,
      },
    },
    inferred: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: null,
      consequenceClass: 'authority-change',
      resourceRefDigest: null,
      dataClass: definition.authorityFacts.leastPrivilege,
      amountAssetChain: null,
      authorityDelta: definition.expectedDecision === 'admit'
        ? null
        : {
            authorityKind: 'authority-change-review-required',
            principalRefDigest: digestFor('actor', 'golden-authority-change-reviewer-role'),
            resourceRefDigest,
            permissionRefDigest: digestFor('authority', 'authority-change-approval'),
          },
    },
    decision: definition.decision,
    outcome: {
      downstreamOutcome: 'blocked',
      humanOutcome: definition.expectedDecision === 'admit' ? null : 'not-reviewed',
    },
    evidenceRefs: definition.evidenceSeeds.map((seed) =>
      ref('evidence', `${scenarioPrefix}:${seed}`)
    ),
    simulationRefs: [
      ref('simulation', `${scenarioPrefix}:shadow-runtime-replay`, 'inferred'),
    ],
    approvalRefs: definition.approvalSeeds.map((seed) =>
      ref('approval', `${scenarioPrefix}:${seed}`)
    ),
    receiptRefs: [],
    policyRefs: [
      ref('policy', `${scenarioPrefix}:review-only-policy-candidate`, 'inferred'),
    ],
    idempotencyRefDigest: digestFor('idempotency', `${scenarioPrefix}:idempotency`),
    replayRefDigest: digestFor('replay', `${scenarioPrefix}:replay`),
    traceRefDigest: digestFor('trace', `${scenarioPrefix}:trace`),
    schemaRefDigest: digestFor('schema', CANONICAL_SHADOW_EVENT_SCHEMA_VERSION),
    rawMaterialPolicy: 'digest-only',
  });
}

function createFixture(definition: ScenarioDefinition): GoldenAuthorityChangeShadowFixture {
  const sourceRecipeRefDigest = digestFor('recipe', 'domain-consequence-recipes:identity-workflow-gate');
  const actionSurfaceRefDigest = digestFor('action-surface', `authority-change.${definition.actionName}`);
  const event = createScenarioEvent(definition);
  const payload = {
    version: GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION,
    scenario: definition.scenario,
    fixtureId: `golden-authority-change:${definition.scenario}`,
    expectedPosture: definition.expectedPosture,
    expectedDecision: definition.expectedDecision,
    authorityFacts: definition.authorityFacts,
    eventDigest: event.digest,
    sourceRecipeRefDigest,
    actionSurfaceRefDigest,
    expectedEvidenceStates: definition.expectedEvidenceStates,
    expectedSignals: definition.expectedSignals,
    reasonCodes: definition.reasonCodes,
    fixtureOnly: true,
    synthetic: true,
    shadowOnly: true,
    noTargetSystemCall: true,
    noRawPayload: true,
    noRawIdentityAttributes: true,
    noRawCustomerIdentifiers: true,
    autoEnforce: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    event,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function createGoldenAuthorityChangeShadowFixtureSuite():
  GoldenAuthorityChangeShadowFixtureSuite {
  const fixtures = Object.freeze(SCENARIO_DEFINITIONS.map(createFixture));
  const sourceRecipeRefDigest = digestFor('recipe', 'domain-consequence-recipes:identity-workflow-gate');
  const actionSurfaceRefDigest = digestFor('action-surface', 'authority-change.identity-workflow');
  const payload = {
    version: GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION,
    name: 'Golden Path: Authority Change',
    step: 'A01',
    sourceRecipeRefDigest,
    actionSurfaceRefDigest,
    fixtureCount: fixtures.length,
    scenarios: GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURE_SCENARIOS,
    fixtureDigests: fixtures.map((fixture) => fixture.digest),
    shadowOnly: true,
    noTargetSystemCalls: true,
    noRawPayload: true,
    noRawIdentityAttributes: true,
    noRawCustomerIdentifiers: true,
    autoEnforce: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    fixtureCount: 8,
    fixtures,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function goldenAuthorityChangeShadowFixturesDescriptor():
  GoldenAuthorityChangeShadowFixturesDescriptor {
  return Object.freeze({
    version: GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION,
    step: 'A01',
    sourceSchemaVersion: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    scenarios: GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURE_SCENARIOS,
    shadowOnly: true,
    synthetic: true,
    noTargetSystemCalls: true,
    noRawPayload: true,
    noRawIdentityAttributes: true,
    noRawCustomerIdentifiers: true,
    autoEnforce: false,
    productionReady: false,
    nonClaims: GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURE_NON_CLAIMS,
  });
}
