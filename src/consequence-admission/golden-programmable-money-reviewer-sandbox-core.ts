import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  CryptoAccountKind,
  CryptoAssetKind,
  CryptoAuthorizationConsequenceKind,
  CryptoExecutionAdapterKind,
} from '../crypto-authorization-core/types.js';
import {
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  createCanonicalShadowEvent,
  type CanonicalShadowEvent,
  type CanonicalShadowEventActionKind,
  type CanonicalShadowEventDecision,
  type CanonicalShadowEventReference,
} from './canonical-shadow-event-schema.js';
import type {
  GoldenProgrammableMoneyShadowFixtureOperationFacts,
  GoldenProgrammableMoneyShadowFixturePosture,
} from './golden-programmable-money-shadow-fixtures.js';
import {
  runShadowRuntimeFixtureReplaySmoke,
  type ShadowRuntimeFixtureReplaySmokeResult,
} from './shadow-runtime-fixture-replay-smoke.js';
import {
  ACCOUNT_KINDS,
  ADAPTER_KINDS,
  ADAPTER_PREFLIGHT_STATUSES,
  APPROVAL_POSTURES,
  ASSET_KINDS,
  BASE_OBSERVED_AT,
  BASE_OCCURRED_AT,
  CHAIN_NAMESPACES,
  CONSEQUENCE_KINDS,
  CONTROL_CHARACTER_PATTERN,
  COUNTERPARTY_POSTURES,
  ENGINE_SCOPE,
  GENERATED_AT,
  GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_ALLOWED_KEYS,
  GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_GATE_ORDER,
  GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_INPUT_VERSION,
  GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_SOURCE_ANCHORS,
  GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_VERSION,
  POLICY_SCOPE_STATUSES,
  REPLAY_FRESHNESS_VALUES,
  SETTLEMENT_OR_RECEIPT_STATUSES,
  VALUE_RISKS,
  type GoldenProgrammableMoneyReviewerSandboxDecisionSummary,
  type GoldenProgrammableMoneyReviewerSandboxInput,
  type GoldenProgrammableMoneyReviewerSandboxResult,
  type GoldenProgrammableMoneyReviewerSandboxSafetyBoundary,
} from './golden-programmable-money-reviewer-sandbox-types.js';

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

function safetyBoundary(): GoldenProgrammableMoneyReviewerSandboxSafetyBoundary {
  return Object.freeze({
    noTargetSystemCall: true,
    noWalletCall: true,
    noSigning: true,
    noBroadcast: true,
    noCustodyCallback: true,
    noBundlerCall: true,
    noFacilitatorCall: true,
    noSolverCall: true,
    noProviderCall: true,
    noAuditWrite: true,
    noExternalEventBus: true,
    noExternalTraceExport: true,
    noExternalLineageExport: true,
    noPolicyActivation: true,
    noLearningActivation: true,
    noTrainingActivation: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    rawTransactionPayloadRead: false,
    rawTransactionPayloadStored: false,
    rawWalletMaterialRead: false,
    rawWalletMaterialStored: false,
    rawCustomerIdentifiersRead: false,
    rawCustomerIdentifiersStored: false,
    productionReady: false,
  });
}

function noClaims(): readonly string[] {
  return Object.freeze([
    'not-a-wallet-custodian-signer-bundler-broadcaster-facilitator-or-solver',
    'not-live-safe-wallet-custody-x402-or-chain-integration',
    'not-chain-settlement-or-payment-finality-proof',
    'not-customer-pep-enforcement-proof',
    'not-audit-plane-write',
    'not-policy-activation',
    'not-learning-or-training',
    'not-admission-authority',
    'not-production-ready',
  ]);
}

function validateInput(raw: unknown): {
  readonly input: GoldenProgrammableMoneyReviewerSandboxInput | null;
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
    if (!(GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_ALLOWED_KEYS as readonly string[]).includes(key)) {
      errors.push(`unknown field: ${key}`);
    }
  }

  if (raw.version !== GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_INPUT_VERSION) {
    errors.push(`version must be ${GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_INPUT_VERSION}`);
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

  if (!includesString(ADAPTER_KINDS, raw.adapterKind)) {
    errors.push(`adapterKind must be one of ${ADAPTER_KINDS.join(', ')}`);
  }
  if (!includesString(CONSEQUENCE_KINDS, raw.consequenceKind)) {
    errors.push(`consequenceKind must be one of ${CONSEQUENCE_KINDS.join(', ')}`);
  }
  if (!includesString(ACCOUNT_KINDS, raw.accountKind)) {
    errors.push(`accountKind must be one of ${ACCOUNT_KINDS.join(', ')}`);
  }
  if (!includesString(ASSET_KINDS, raw.assetKind)) {
    errors.push(`assetKind must be one of ${ASSET_KINDS.join(', ')}`);
  }
  if (!includesString(CHAIN_NAMESPACES, raw.chainNamespace)) {
    errors.push(`chainNamespace must be one of ${CHAIN_NAMESPACES.join(', ')}`);
  }
  if (!includesString(VALUE_RISKS, raw.valueRisk)) {
    errors.push(`valueRisk must be one of ${VALUE_RISKS.join(', ')}`);
  }
  if (!includesString(COUNTERPARTY_POSTURES, raw.counterpartyPosture)) {
    errors.push(`counterpartyPosture must be one of ${COUNTERPARTY_POSTURES.join(', ')}`);
  }
  if (!includesString(APPROVAL_POSTURES, raw.approvalPosture)) {
    errors.push(`approvalPosture must be one of ${APPROVAL_POSTURES.join(', ')}`);
  }
  if (!includesString(POLICY_SCOPE_STATUSES, raw.policyScopeStatus)) {
    errors.push(`policyScopeStatus must be one of ${POLICY_SCOPE_STATUSES.join(', ')}`);
  }
  if (!includesString(REPLAY_FRESHNESS_VALUES, raw.replayFreshness)) {
    errors.push(`replayFreshness must be one of ${REPLAY_FRESHNESS_VALUES.join(', ')}`);
  }
  if (!includesString(ADAPTER_PREFLIGHT_STATUSES, raw.adapterPreflightStatus)) {
    errors.push(`adapterPreflightStatus must be one of ${ADAPTER_PREFLIGHT_STATUSES.join(', ')}`);
  }
  if (!includesString(SETTLEMENT_OR_RECEIPT_STATUSES, raw.settlementOrReceiptStatus)) {
    errors.push(`settlementOrReceiptStatus must be one of ${SETTLEMENT_OR_RECEIPT_STATUSES.join(', ')}`);
  }
  if (typeof raw.instructionLikeEvidence !== 'boolean') {
    errors.push('instructionLikeEvidence must be boolean');
  }
  if (typeof raw.externalSideEffect !== 'boolean') {
    errors.push('externalSideEffect must be boolean');
  }
  if (typeof raw.duplicateIntentAttempt !== 'boolean') {
    errors.push('duplicateIntentAttempt must be boolean');
  }

  if (errors.length > 0) {
    return Object.freeze({
      input: null,
      errors: Object.freeze(errors),
      requestedActionSurface,
    });
  }

  return Object.freeze({
    input: Object.freeze({
      version: GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_INPUT_VERSION,
      actionSurface: requestedActionSurface ?? ENGINE_SCOPE,
      adapterKind: raw.adapterKind as CryptoExecutionAdapterKind,
      consequenceKind: raw.consequenceKind as CryptoAuthorizationConsequenceKind,
      accountKind: raw.accountKind as CryptoAccountKind,
      assetKind: raw.assetKind as CryptoAssetKind,
      chainNamespace: raw.chainNamespace as GoldenProgrammableMoneyShadowFixtureOperationFacts['chainNamespace'],
      valueRisk: raw.valueRisk as GoldenProgrammableMoneyShadowFixtureOperationFacts['valueRisk'],
      counterpartyPosture: raw.counterpartyPosture as GoldenProgrammableMoneyShadowFixtureOperationFacts['counterpartyPosture'],
      approvalPosture: raw.approvalPosture as GoldenProgrammableMoneyShadowFixtureOperationFacts['approvalPosture'],
      policyScopeStatus: raw.policyScopeStatus as GoldenProgrammableMoneyShadowFixtureOperationFacts['policyScopeStatus'],
      replayFreshness: raw.replayFreshness as GoldenProgrammableMoneyShadowFixtureOperationFacts['replayFreshness'],
      adapterPreflightStatus: raw.adapterPreflightStatus as GoldenProgrammableMoneyShadowFixtureOperationFacts['adapterPreflightStatus'],
      settlementOrReceiptStatus: raw.settlementOrReceiptStatus as GoldenProgrammableMoneyShadowFixtureOperationFacts['settlementOrReceiptStatus'],
      instructionLikeEvidence: raw.instructionLikeEvidence as boolean,
      externalSideEffect: raw.externalSideEffect as boolean,
      duplicateIntentAttempt: raw.duplicateIntentAttempt as boolean,
    }),
    errors: Object.freeze([]),
    requestedActionSurface,
  });
}

function detectIssueCodes(
  input: GoldenProgrammableMoneyReviewerSandboxInput,
): readonly string[] {
  const reasons = ['reviewer-sandbox:schema-valid'];
  if (input.externalSideEffect) {
    reasons.push('programmable-money:side-effect-held-before-customer-pep');
  }
  if (input.duplicateIntentAttempt || input.replayFreshness === 'duplicate') {
    reasons.push(
      'programmable-money:duplicate-intent-replay',
      'programmable-money:block-before-wallet-action',
    );
  }
  if (input.replayFreshness === 'stale') {
    reasons.push(
      'programmable-money:stale-replay-window',
      'programmable-money:block-before-wallet-action',
    );
  }
  if (input.policyScopeStatus === 'overbroad') {
    reasons.push(
      'programmable-money:policy-scope-overbroad',
      'programmable-money:narrow-before-wallet-action',
    );
  }
  if (input.policyScopeStatus === 'missing') {
    reasons.push(
      'programmable-money:policy-scope-missing',
      'programmable-money:block-before-wallet-action',
    );
  }
  if (input.approvalPosture === 'stale') {
    reasons.push(
      'programmable-money:approval-stale',
      'programmable-money:block-before-wallet-action',
    );
  }
  if (input.approvalPosture === 'missing') {
    reasons.push(
      'programmable-money:approval-missing',
      'programmable-money:block-before-wallet-action',
    );
  }
  if (input.approvalPosture === 'quorum-pending') {
    reasons.push(
      'programmable-money:custody-or-policy-quorum-pending',
      'programmable-money:review-before-adapter-response',
    );
  }
  if (input.adapterPreflightStatus === 'missing') {
    reasons.push(
      'programmable-money:adapter-preflight-missing',
      'programmable-money:block-before-adapter-handoff',
    );
  }
  if (input.adapterPreflightStatus === 'failed') {
    reasons.push(
      'programmable-money:adapter-preflight-failed',
      'programmable-money:block-before-adapter-handoff',
    );
  }
  if (input.settlementOrReceiptStatus === 'missing') {
    reasons.push(
      'programmable-money:settlement-or-receipt-missing',
      'programmable-money:block-before-resource-fulfillment',
    );
  }
  if (input.settlementOrReceiptStatus === 'pending') {
    reasons.push(
      'programmable-money:settlement-or-receipt-pending',
      'programmable-money:review-before-settlement-finality-claim',
    );
  }
  if (input.counterpartyPosture === 'new-counterparty') {
    reasons.push('programmable-money:new-counterparty-review');
  }
  if (input.counterpartyPosture === 'sanctions-review-required') {
    reasons.push(
      'programmable-money:counterparty-screening-review-required',
      'programmable-money:block-before-wallet-action',
    );
  }
  if (input.instructionLikeEvidence) {
    reasons.push(
      'programmable-money:wallet-memo-or-model-text-is-not-authority',
      'programmable-money:block-instruction-like-evidence',
    );
  }
  if (reasons.length === 2 && reasons.includes('programmable-money:side-effect-held-before-customer-pep')) {
    reasons.push(
      'programmable-money:authority-bound',
      'programmable-money:policy-scope-matched',
      'programmable-money:shadow-ready',
    );
  }
  return Object.freeze([...new Set(reasons)].sort());
}

function expectedPostureFor(
  input: GoldenProgrammableMoneyReviewerSandboxInput,
): GoldenProgrammableMoneyShadowFixturePosture {
  if (input.instructionLikeEvidence) return 'blocked-instruction-like-memo';
  if (input.duplicateIntentAttempt || input.replayFreshness !== 'fresh') {
    return input.replayFreshness === 'stale'
      ? 'blocked-stale-delegation'
      : 'blocked-missing-paymaster-evidence';
  }
  if (input.policyScopeStatus === 'overbroad') return 'needs-allowance-narrowing';
  if (input.policyScopeStatus === 'missing') return 'blocked-instruction-like-memo';
  if (input.approvalPosture === 'stale') return 'blocked-stale-delegation';
  if (input.approvalPosture === 'missing') return 'blocked-instruction-like-memo';
  if (input.approvalPosture === 'quorum-pending') return 'needs-custody-quorum-review';
  if (input.settlementOrReceiptStatus === 'missing') return 'blocked-missing-settlement-proof';
  if (input.settlementOrReceiptStatus === 'pending') {
    return input.consequenceKind === 'bridge'
      ? 'needs-intent-route-review'
      : 'needs-custody-quorum-review';
  }
  if (input.adapterPreflightStatus !== 'passed') return 'blocked-missing-paymaster-evidence';
  if (input.consequenceKind === 'bridge') return 'needs-intent-route-review';
  return 'shadow-ready';
}

function decisionFor(issueCodes: readonly string[]): CanonicalShadowEventDecision {
  const block = issueCodes.some((code) =>
    code.includes(':block-') ||
    code.endsWith(':block-before-wallet-action') ||
    code.endsWith(':block-instruction-like-evidence')
  );
  const narrow = !block && issueCodes.includes('programmable-money:narrow-before-wallet-action');
  const reviewNeeded = block || narrow || issueCodes.some((code) =>
    code !== 'reviewer-sandbox:schema-valid' &&
    code !== 'programmable-money:side-effect-held-before-customer-pep' &&
    code !== 'programmable-money:authority-bound' &&
    code !== 'programmable-money:policy-scope-matched' &&
    code !== 'programmable-money:shadow-ready'
  );
  return Object.freeze({
    admissionDigest: null,
    mode: reviewNeeded ? 'review' : 'observe',
    shadowDecision: block
      ? 'would_block'
      : narrow
        ? 'would_narrow'
        : reviewNeeded
          ? 'would_review'
          : 'would_admit',
    effectiveDecision: block ? 'block' : narrow ? 'narrow' : 'review',
    allowed: false,
    failClosed: true,
    reasonCodes: issueCodes,
  });
}

function actionNameFor(
  input: GoldenProgrammableMoneyReviewerSandboxInput,
): string {
  if (input.instructionLikeEvidence) return 'propose_wallet_call_with_memo';
  if (input.consequenceKind === 'approval') return 'propose_token_approval';
  if (input.consequenceKind === 'user-operation') return 'propose_user_operation';
  if (input.consequenceKind === 'account-delegation') return 'propose_delegated_eoa_call';
  if (input.consequenceKind === 'agent-payment') return 'propose_x402_agent_payment';
  if (input.consequenceKind === 'custody-withdrawal') return 'propose_custody_withdrawal';
  if (input.consequenceKind === 'bridge') return 'propose_intent_settlement';
  return 'propose_safe_transfer';
}

function actionKindFor(
  input: GoldenProgrammableMoneyReviewerSandboxInput,
): CanonicalShadowEventActionKind {
  if (input.consequenceKind === 'agent-payment') return 'api-operation';
  if (input.consequenceKind === 'custody-withdrawal') return 'webhook-callback';
  if (input.consequenceKind === 'approval') return 'approval-step';
  return 'transaction-proposal';
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
  input: GoldenProgrammableMoneyReviewerSandboxInput,
): readonly string[] {
  const seeds = [
    `adapter-${input.adapterKind}`,
    `consequence-${input.consequenceKind}`,
    `account-${input.accountKind}`,
    `asset-${input.assetKind}`,
    `chain-${input.chainNamespace}`,
    `approval-${input.approvalPosture}`,
    `policy-scope-${input.policyScopeStatus}`,
    `adapter-preflight-${input.adapterPreflightStatus}`,
    `settlement-or-receipt-${input.settlementOrReceiptStatus}`,
  ];
  if (input.counterpartyPosture !== 'allowlisted') {
    seeds.push(`counterparty-${input.counterpartyPosture}`);
  }
  if (input.replayFreshness !== 'fresh') seeds.push(`replay-${input.replayFreshness}`);
  if (input.instructionLikeEvidence) seeds.push('instruction-like-wallet-memo');
  if (input.duplicateIntentAttempt) seeds.push('duplicate-intent-attempt');
  return Object.freeze(seeds);
}

function createSandboxEvent(
  input: GoldenProgrammableMoneyReviewerSandboxInput,
  inputDigest: string,
  issueCodes: readonly string[],
): CanonicalShadowEvent {
  const resourceRefDigest = digestFor('resource', {
    scope: 'golden-programmable-money-reviewer-sandbox',
    adapterKind: input.adapterKind,
    consequenceKind: input.consequenceKind,
    inputDigest,
  });
  const targetAccountRefDigest = digestFor('target-account', {
    scope: 'golden-programmable-money-reviewer-sandbox',
    adapterKind: input.adapterKind,
    accountKind: input.accountKind,
    chainNamespace: input.chainNamespace,
    inputDigest,
  });
  const assetRefDigest = digestFor('asset', {
    scope: 'golden-programmable-money-reviewer-sandbox',
    assetKind: input.assetKind,
    inputDigest,
  });
  const chainRefDigest = digestFor('chain', {
    scope: 'golden-programmable-money-reviewer-sandbox',
    chainNamespace: input.chainNamespace,
    synthetic: true,
  });
  const policyRefDigest = digestFor('policy', {
    scope: 'golden-programmable-money-reviewer-sandbox',
    policyScopeStatus: input.policyScopeStatus,
    inputDigest,
  });
  const actorRefDigest = digestFor('actor', {
    scope: 'golden-programmable-money-reviewer-sandbox',
    role: 'fixture-only-ai-agent',
    inputDigest,
  });
  const scenarioPrefix = `golden-programmable-money-reviewer-sandbox:${inputDigest}`;
  return createCanonicalShadowEvent({
    occurredAt: BASE_OCCURRED_AT,
    observedAt: BASE_OBSERVED_AT,
    sourceKind: 'crypto-execution-admission',
    producer: 'attestor.golden-programmable-money-reviewer-sandbox',
    tenantRefDigest: digestFor('tenant', 'golden-programmable-money-reviewer-sandbox-tenant'),
    actorRefDigest,
    observed: {
      targetSystem: input.adapterKind,
      targetAccountRefDigest,
      actionName: actionNameFor(input),
      actionKind: actionKindFor(input),
      consequenceClass: 'programmable-money',
      resourceRefDigest,
      dataClass: `programmable-money:${input.consequenceKind}`,
      amountAssetChain: {
        amountBucket: `${input.assetKind}:${input.valueRisk}`,
        assetRefDigest,
        chainRefDigest,
      },
      authorityDelta: {
        authorityKind: input.consequenceKind,
        principalRefDigest: actorRefDigest,
        resourceRefDigest,
        permissionRefDigest: policyRefDigest,
      },
    },
    inferred: {
      targetSystem: input.adapterKind,
      targetAccountRefDigest,
      actionName: actionNameFor(input),
      actionKind: actionKindFor(input),
      consequenceClass: 'programmable-money',
      resourceRefDigest,
      dataClass: expectedPostureFor(input),
      amountAssetChain: {
        amountBucket: `${input.assetKind}:${input.valueRisk}`,
        assetRefDigest,
        chainRefDigest,
      },
      authorityDelta: {
        authorityKind: `review-required:${input.adapterKind}`,
        principalRefDigest: actorRefDigest,
        resourceRefDigest,
        permissionRefDigest: policyRefDigest,
      },
    },
    decision: decisionFor(issueCodes),
    outcome: {
      downstreamOutcome: 'blocked',
      humanOutcome: issueCodes.includes('programmable-money:shadow-ready') ? null : 'not-reviewed',
    },
    evidenceRefs: evidenceSeedsFor(input).map((seed) =>
      ref('evidence', `${scenarioPrefix}:${seed}`)
    ),
    simulationRefs: [
      ref('simulation', `${scenarioPrefix}:shadow-runtime-replay`, 'inferred'),
    ],
    approvalRefs: input.approvalPosture === 'missing'
      ? []
      : [
          ref('approval', `${scenarioPrefix}:approval-${input.approvalPosture}`),
        ],
    receiptRefs: input.settlementOrReceiptStatus === 'not-applicable'
      ? []
      : [
          ref('receipt', `${scenarioPrefix}:receipt-${input.settlementOrReceiptStatus}`),
        ],
    policyRefs: [
      ref('policy', policyRefDigest, 'operator-supplied'),
    ],
    idempotencyRefDigest: digestFor('idempotency', {
      scope: 'golden-programmable-money-reviewer-sandbox',
      inputDigest,
    }),
    replayRefDigest: digestFor('replay', {
      scope: 'golden-programmable-money-reviewer-sandbox',
      inputDigest,
      replayFreshness: input.replayFreshness,
    }),
    traceRefDigest: digestFor('trace', {
      scope: 'golden-programmable-money-reviewer-sandbox',
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
  return runShadowRuntimeFixtureReplaySmoke({
    fixtureId: 'golden-programmable-money-reviewer-sandbox:reviewer-input',
    fixtureRefDigest: digestFor('golden-programmable-money-reviewer-sandbox.fixture', {
      inputDigest,
      eventDigest: event.digest,
    }),
    event,
    sourcePartitionDigest: digestFor(
      'golden-programmable-money-reviewer-sandbox.source-partition',
      'single-reviewer-input',
    ),
    traceContextDigest: digestFor('golden-programmable-money-reviewer-sandbox.trace-context', {
      inputDigest,
      eventDigest: event.digest,
    }),
    sourceHistoryRefDigest: digestFor(
      'golden-programmable-money-reviewer-sandbox.source-history',
      'single-reviewer-input',
    ),
    sourceHistorySequence: 1,
    requestedAt: '2026-05-26T16:15:02.000Z',
    claimedAt: '2026-05-26T16:15:03.000Z',
    generatedAt: '2026-05-26T16:15:04.000Z',
    observedAt: '2026-05-26T16:15:05.000Z',
    outcomeObservedAt: '2026-05-26T16:15:06.000Z',
    feedbackGeneratedAt: '2026-05-26T16:15:07.000Z',
    evaluatedAt: '2026-05-26T16:15:08.000Z',
    workerRefDigest: digestFor(
      'golden-programmable-money-reviewer-sandbox.worker',
      'fixture-only-worker',
    ),
    dispatcherRunDigest: digestFor(
      'golden-programmable-money-reviewer-sandbox.dispatcher',
      inputDigest,
    ),
    observerRefDigest: digestFor(
      'golden-programmable-money-reviewer-sandbox.observer',
      'fixture-only-observer',
    ),
    evaluatorRefDigest: digestFor(
      'golden-programmable-money-reviewer-sandbox.evaluator',
      'fixture-only-evaluator',
    ),
    scopeDigest: digestFor(
      'golden-programmable-money-reviewer-sandbox.scope',
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
}): GoldenProgrammableMoneyReviewerSandboxDecisionSummary {
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
      'golden-programmable-money-reviewer-sandbox.decision-summary',
      material as unknown as CanonicalReleaseJsonValue,
    ),
  });
}

function resultFor(
  input: Omit<GoldenProgrammableMoneyReviewerSandboxResult, 'canonical' | 'digest'>,
): GoldenProgrammableMoneyReviewerSandboxResult {
  const canonical = canonicalObject(input as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...input,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function runGoldenProgrammableMoneyReviewerSandbox(
  rawInput: unknown,
): GoldenProgrammableMoneyReviewerSandboxResult {
  const validated = validateInput(rawInput);
  if (!validated.input) {
    return resultFor({
      version: GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_VERSION,
      step: 'P04',
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
      gateOrder: GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_GATE_ORDER,
      decisionSummary: null,
      smokeResult: null,
      sourceAnchors: GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_SOURCE_ANCHORS,
      noClaims: noClaims(),
      safetyBoundary: safetyBoundary(),
      engineRan: false,
      shadowOnly: true,
      previewOnly: true,
      reviewerSupplied: true,
    });
  }

  const inputDigest = digestFor(
    'golden-programmable-money-reviewer-sandbox.input',
    validated.input as unknown as CanonicalReleaseJsonValue,
  );
  if (validated.input.actionSurface !== ENGINE_SCOPE) {
    return resultFor({
      version: GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_VERSION,
      step: 'P04',
      generatedAt: GENERATED_AT,
      inputVersion: validated.input.version,
      inputStatus: 'outside-scope',
      inputDigest,
      engineScope: ENGINE_SCOPE,
      requestedActionSurface: validated.input.actionSurface,
      schemaErrors: Object.freeze([]),
      issueCodes: Object.freeze(['reviewer-sandbox:outside-golden-programmable-money-scope']),
      expectedPosture: null,
      eventDigest: null,
      smokeDigest: null,
      envelopeRefDigest: null,
      assurancePacketDigest: null,
      gateOrder: GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_GATE_ORDER,
      decisionSummary: null,
      smokeResult: null,
      sourceAnchors: GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_SOURCE_ANCHORS,
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
    version: GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_VERSION,
    step: 'P04',
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
    gateOrder: GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_GATE_ORDER,
    decisionSummary,
    smokeResult: null,
    sourceAnchors: GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_SOURCE_ANCHORS,
    noClaims: noClaims(),
    safetyBoundary: safetyBoundary(),
    engineRan: true,
    shadowOnly: true,
    previewOnly: true,
    reviewerSupplied: true,
  });
}
