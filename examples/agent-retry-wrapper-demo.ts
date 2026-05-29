import { pathToFileURL } from 'node:url';
import {
  createConsequenceAdmissionRetryAttemptBinding,
  createConsequenceAdmissionRetryAttemptLedger,
  createGenericAdmissionEnvelope,
  evaluateConsequenceAdmissionRetryBudget,
  type CreateGenericAdmissionInput,
  type GenericAdmissionEnvelope,
} from '../src/consequence-admission/index.js';

type AgentProposal = Omit<CreateGenericAdmissionInput, 'retryAttempt'>;

interface SanitizedAdmissionView {
  readonly decision: string;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly retryAllowed: boolean;
  readonly retryCategory: string;
  readonly missingFields: readonly string[];
  readonly requiredEvidenceKinds: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly operatorOnlyReasonCodes: readonly string[];
}

interface SanitizedRetryView {
  readonly attemptId: string;
  readonly budgetOutcome: string;
  readonly ledgerOutcome: string;
  readonly ledgerRetryAllowed: boolean;
  readonly finalDecision: string;
  readonly finalAllowed: boolean;
  readonly ledgerReceiptDigest: string;
}

export interface AgentRetryWrapperDemoResult {
  readonly initial: SanitizedAdmissionView;
  readonly retry: SanitizedRetryView;
  readonly duplicateLedger: {
    readonly outcome: string;
    readonly duplicate: boolean;
    readonly recordCountAfter: number;
  };
  readonly unsafe: SanitizedAdmissionView & {
    readonly retryAttemptCreated: false;
  };
  readonly ledgerSummary: {
    readonly recordCount: number;
    readonly retryAllowedCount: number;
    readonly retryHeldCount: number;
    readonly rawPayloadStored: false;
  };
  readonly output: string;
}

const BASE_PROPOSAL = Object.freeze({
  mode: 'review',
  actor: 'support-ai-agent',
  action: 'issue_refund',
  domain: 'money-movement',
  downstreamSystem: 'refund-service',
  tenantId: 'tenant_demo_retail',
  environment: 'local-demo',
  requestedAt: '2026-05-02T09:00:00.000Z',
  decidedAt: '2026-05-02T09:00:01.000Z',
  amount: {
    value: 38000,
    currency: 'HUF',
    asset: null,
    chain: null,
  },
  recipient: 'customer_123',
  authorityRef: 'authority:refunds:v1',
  authoritySources: [
    {
      sourceKind: 'customer-policy',
      claimKind: 'authorization',
      sourceRef: 'authority:refunds:v1',
      trustClass: 'trusted-authority',
      evidenceDigest: `sha256:${'a'.repeat(64)}`,
    },
  ],
  summary: 'Support copilot proposes a customer refund.',
  nativeInputRefs: ['amount', 'recipient', 'policyRef', 'evidenceRefs'],
} satisfies AgentProposal);

function sanitizeAdmission(envelope: GenericAdmissionEnvelope): SanitizedAdmissionView {
  return Object.freeze({
    decision: envelope.admission.decision,
    allowed: envelope.admission.allowed,
    failClosed: envelope.admission.failClosed,
    retryAllowed: envelope.admission.retry.retryAllowed,
    retryCategory: envelope.admission.retry.retryCategory,
    missingFields: envelope.admission.feedback.missingFields,
    requiredEvidenceKinds: envelope.admission.feedback.requiredEvidenceKinds,
    reasonCodes: envelope.admission.feedback.reasonCodes,
    operatorOnlyReasonCodes: envelope.admission.feedback.operatorOnlyReasonCodes,
  });
}

function correctionReasons(envelope: GenericAdmissionEnvelope): readonly string[] {
  const correctionCodes = new Set(['policy-ref-missing', 'evidence-ref-missing']);
  return Object.freeze(
    envelope.admission.feedback.reasonCodes.filter((reason) => correctionCodes.has(reason)),
  );
}

function proposeCorrection(
  proposal: AgentProposal,
  held: GenericAdmissionEnvelope,
): AgentProposal {
  const next = {
    ...proposal,
    requestedAt: '2026-05-02T09:01:00.000Z',
    decidedAt: '2026-05-02T09:01:01.000Z',
  };

  return Object.freeze({
    ...next,
    policyRef: held.admission.feedback.missingFields.includes('policyRef')
      ? 'policy:refunds:v1'
      : next.policyRef,
    evidenceRefs: held.admission.feedback.missingFields.includes('evidenceRefs')
      ? ['order:987', 'payment:456']
      : next.evidenceRefs,
  });
}

function renderResult(result: Omit<AgentRetryWrapperDemoResult, 'output'>): string {
  const lines = [
    'Agent retry wrapper demo',
    '========================',
    '',
    'The wrapper lets an agent retry only when Attestor returns model-safe correction feedback.',
    'It does not expose raw policy, raw customer data, raw idempotency keys, or downstream execution.',
    '',
    'Initial attempt:',
    `  decision: ${result.initial.decision}`,
    `  retry allowed: ${String(result.initial.retryAllowed)}`,
    `  missing fields: ${result.initial.missingFields.join(', ')}`,
    `  evidence kinds: ${result.initial.requiredEvidenceKinds.join(', ')}`,
    '',
    'Bound retry:',
    `  attempt id: ${result.retry.attemptId}`,
    `  budget outcome: ${result.retry.budgetOutcome}`,
    `  ledger outcome: ${result.retry.ledgerOutcome}`,
    `  ledger retry allowed: ${String(result.retry.ledgerRetryAllowed)}`,
    `  final decision: ${result.retry.finalDecision}`,
    `  final allowed: ${String(result.retry.finalAllowed)}`,
    '',
    'Duplicate delivery:',
    `  ledger outcome: ${result.duplicateLedger.outcome}`,
    `  duplicate: ${String(result.duplicateLedger.duplicate)}`,
    `  ledger records: ${result.duplicateLedger.recordCountAfter}`,
    '',
    'Unsafe attempt:',
    `  decision: ${result.unsafe.decision}`,
    `  retry allowed: ${String(result.unsafe.retryAllowed)}`,
    `  operator-only reasons: ${result.unsafe.operatorOnlyReasonCodes.join(', ')}`,
    `  retry attempt created: ${String(result.unsafe.retryAttemptCreated)}`,
    '',
    `ledger record count: ${result.ledgerSummary.recordCount}`,
    'Feedback is for bounded correction, not for teaching the model how to bypass the gate.',
  ];
  return lines.join('\n');
}

export function runAgentRetryWrapperDemo(): AgentRetryWrapperDemoResult {
  const ledger = createConsequenceAdmissionRetryAttemptLedger({
    ledgerId: 'ledger:agent-retry-wrapper:tenant_demo_retail',
    now: () => '2026-05-02T09:01:02.000Z',
  });

  const initialEnvelope = createGenericAdmissionEnvelope(BASE_PROPOSAL);
  if (!initialEnvelope.admission.retry.retryAllowed) {
    throw new Error('Agent retry wrapper demo expected the initial admission to allow bounded correction.');
  }

  const correctedProposal = proposeCorrection(BASE_PROPOSAL, initialEnvelope);
  const retryAttempt = createConsequenceAdmissionRetryAttemptBinding({
    previousAdmissionId: initialEnvelope.admission.admissionId,
    previousAdmissionDigest: initialEnvelope.admission.digest,
    previousRequestId: initialEnvelope.admission.request.requestId,
    attemptNumber: 1,
    attemptedAt: '2026-05-02T09:01:00.000Z',
    correctionReasonCodes: correctionReasons(initialEnvelope),
    correctionFields: initialEnvelope.admission.feedback.missingFields,
    idempotencyKey: 'retry:agent-wrapper:refund:attempt-1',
  });
  const retryBudget = evaluateConsequenceAdmissionRetryBudget({
    previousAdmission: initialEnvelope.admission,
    retryAttempt,
  });
  const ledgerDecision = ledger.record({
    previousAdmission: initialEnvelope.admission,
    retryAttempt,
    retryBudget,
  });

  const correctedEnvelope = ledgerDecision.retryAllowed
    ? createGenericAdmissionEnvelope({
        ...correctedProposal,
        retryAttempt,
      })
    : null;
  if (correctedEnvelope === null) {
    throw new Error('Agent retry wrapper demo expected the ledger to allow the corrected retry.');
  }

  const duplicateLedgerDecision = ledger.record({
    previousAdmission: initialEnvelope.admission,
    retryAttempt,
    retryBudget,
  });
  const unsafeEnvelope = createGenericAdmissionEnvelope({
    ...BASE_PROPOSAL,
    requestedAt: '2026-05-02T09:02:00.000Z',
    decidedAt: '2026-05-02T09:02:01.000Z',
    policyRef: 'policy:refunds:v1',
    evidenceRefs: ['order:987', 'payment:456'],
    observedFeatures: {
      unsafe: true,
    },
  });

  const result = {
    initial: sanitizeAdmission(initialEnvelope),
    retry: Object.freeze({
      attemptId: retryAttempt.attemptId,
      budgetOutcome: retryBudget.outcome,
      ledgerOutcome: ledgerDecision.outcome,
      ledgerRetryAllowed: ledgerDecision.retryAllowed,
      finalDecision: correctedEnvelope.admission.decision,
      finalAllowed: correctedEnvelope.admission.allowed,
      ledgerReceiptDigest: ledgerDecision.receiptDigest,
    }),
    duplicateLedger: Object.freeze({
      outcome: duplicateLedgerDecision.outcome,
      duplicate: duplicateLedgerDecision.duplicate,
      recordCountAfter: ledger.snapshot().recordCount,
    }),
    unsafe: Object.freeze({
      ...sanitizeAdmission(unsafeEnvelope),
      retryAttemptCreated: false as const,
    }),
    ledgerSummary: ledger.summary(),
  } as const;

  return {
    ...result,
    output: renderResult(result),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  console.log(runAgentRetryWrapperDemo().output);
}
