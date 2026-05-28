export type CustomerMiddlewareOutcome = 'admit' | 'narrow' | 'review' | 'block';

export interface CustomerMiddlewareDecision<TIntent> {
  readonly outcome: CustomerMiddlewareOutcome;
  readonly reasonCodes: readonly string[];
  readonly proofRefs: readonly string[];
  readonly narrowedIntent?: TIntent;
}

export interface CustomerMiddlewareAdmissionClient<TIntent> {
  admit(intent: TIntent): Promise<CustomerMiddlewareDecision<TIntent>>;
}

export interface CustomerMiddlewareHold {
  readonly status: 202 | 409;
  readonly body: {
    readonly held: true;
    readonly outcome: 'review' | 'block';
    readonly reasonCodes: readonly string[];
    readonly proofRefs: readonly string[];
    readonly nextStep: 'review' | 'stop';
  };
}

export function decisionCanExecute<TIntent>(
  decision: CustomerMiddlewareDecision<TIntent>,
): decision is CustomerMiddlewareDecision<TIntent> & {
  readonly outcome: 'admit' | 'narrow';
} {
  return decision.outcome === 'admit' || decision.outcome === 'narrow';
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
  if (decision.outcome !== 'review' && decision.outcome !== 'block') {
    throw new Error('Only review or block decisions can be held.');
  }
  return {
    status: decision.outcome === 'block' ? 409 : 202,
    body: {
      held: true,
      outcome: decision.outcome,
      reasonCodes: decision.reasonCodes,
      proofRefs: decision.proofRefs,
      nextStep: decision.outcome === 'block' ? 'stop' : 'review',
    },
  };
}
