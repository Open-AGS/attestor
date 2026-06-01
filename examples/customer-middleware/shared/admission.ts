export type CustomerMiddlewareOutcome = 'admit' | 'narrow' | 'review' | 'block';
export type CustomerMiddlewareMode = 'observe' | 'warn' | 'review' | 'enforce';

export type CustomerMiddlewareProofKind =
  | 'release-token'
  | 'release-evidence-pack'
  | 'certificate'
  | 'verification-kit'
  | 'admission-plan'
  | 'admission-receipt'
  | 'conformance-fixture'
  | 'local-artifact'
  | 'source-module'
  | 'external-reference';

export interface CustomerMiddlewareProofRef {
  readonly kind: CustomerMiddlewareProofKind;
  readonly id: string;
  readonly digest: string | null;
  readonly uri: string | null;
  readonly verifyHint: string;
}

export interface CustomerMiddlewareDecision<TIntent> {
  readonly outcome: CustomerMiddlewareOutcome;
  readonly mode: CustomerMiddlewareMode;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly proofSatisfied: boolean;
  readonly requiredChecksSatisfied: boolean;
  readonly reasonCodes: readonly string[];
  readonly proofRefs: readonly CustomerMiddlewareProofRef[];
  readonly narrowedIntent?: TIntent;
}

export interface CustomerMiddlewareAdmissionClient<TIntent> {
  admit(intent: TIntent): Promise<CustomerMiddlewareDecision<TIntent>>;
}

export interface CustomerMiddlewareHold {
  readonly status: 202 | 409;
  readonly body: {
    readonly held: true;
    readonly outcome: CustomerMiddlewareOutcome;
    readonly mode: CustomerMiddlewareMode;
    readonly gateReason:
      | 'non-enforcing-mode'
      | 'not-allowed'
      | 'fail-closed'
      | 'required-checks'
      | 'execution-proof'
      | 'narrowed-intent-missing'
      | 'review'
      | 'block';
    readonly reasonCodes: readonly string[];
    readonly proofRefs: readonly CustomerMiddlewareProofRef[];
    readonly nextStep:
      | 'move-to-review-or-enforce'
      | 'add-execution-proof'
      | 'fix-required-checks'
      | 'review'
      | 'stop';
  };
}

export function executionProofRefs<TIntent>(
  decision: CustomerMiddlewareDecision<TIntent>,
): readonly CustomerMiddlewareProofRef[] {
  return decision.proofRefs.filter((proofRef) => proofRef.kind !== 'admission-receipt');
}

export function decisionCanExecute<TIntent>(
  decision: CustomerMiddlewareDecision<TIntent>,
): decision is CustomerMiddlewareDecision<TIntent> & {
  readonly outcome: 'admit' | 'narrow';
} {
  if (decision.outcome !== 'admit' && decision.outcome !== 'narrow') return false;
  if (decision.mode === 'observe' || decision.mode === 'warn') return false;
  if (decision.allowed !== true) return false;
  if (decision.failClosed === true) return false;
  if (decision.requiredChecksSatisfied !== true) return false;
  if (decision.proofSatisfied !== true) return false;
  if (executionProofRefs(decision).length === 0) return false;
  if (decision.outcome === 'narrow' && decision.narrowedIntent === undefined) return false;
  return true;
}

export function intentForExecution<TIntent>(
  originalIntent: TIntent,
  decision: CustomerMiddlewareDecision<TIntent>,
): TIntent {
  if (decision.outcome === 'narrow' && decision.narrowedIntent !== undefined) {
    return decision.narrowedIntent;
  }
  return originalIntent;
}

export function holdDecision<TIntent>(
  decision: CustomerMiddlewareDecision<TIntent>,
): CustomerMiddlewareHold {
  if (decisionCanExecute(decision)) {
    throw new Error('Executable decisions should not be converted to a hold.');
  }
  const gateReason = holdReason(decision);
  return {
    status: decision.outcome === 'block' || decision.failClosed ? 409 : 202,
    body: {
      held: true,
      outcome: decision.outcome,
      mode: decision.mode,
      gateReason,
      reasonCodes: decision.reasonCodes,
      proofRefs: decision.proofRefs,
      nextStep: holdNextStep(gateReason),
    },
  };
}

function holdReason<TIntent>(
  decision: CustomerMiddlewareDecision<TIntent>,
): CustomerMiddlewareHold['body']['gateReason'] {
  if (decision.outcome === 'block') return 'block';
  if (decision.failClosed) return 'fail-closed';
  if (decision.mode === 'observe' || decision.mode === 'warn') return 'non-enforcing-mode';
  if (decision.allowed !== true) return 'not-allowed';
  if (decision.requiredChecksSatisfied !== true) return 'required-checks';
  if (decision.proofSatisfied !== true || executionProofRefs(decision).length === 0) {
    return 'execution-proof';
  }
  if (decision.outcome === 'narrow' && decision.narrowedIntent === undefined) {
    return 'narrowed-intent-missing';
  }
  return 'review';
}

function holdNextStep(
  gateReason: CustomerMiddlewareHold['body']['gateReason'],
): CustomerMiddlewareHold['body']['nextStep'] {
  if (gateReason === 'block' || gateReason === 'fail-closed') return 'stop';
  if (gateReason === 'non-enforcing-mode') return 'move-to-review-or-enforce';
  if (gateReason === 'execution-proof') return 'add-execution-proof';
  if (gateReason === 'required-checks') return 'fix-required-checks';
  return 'review';
}
