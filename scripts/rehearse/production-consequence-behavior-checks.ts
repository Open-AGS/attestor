type CheckStatus = 'pass' | 'fail' | 'skip';

export interface ProductionConsequenceBehaviorCheck {
  readonly id: string;
  readonly status: CheckStatus;
  readonly detail: string;
  readonly evidence?: unknown;
}

export function pass(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionConsequenceBehaviorCheck {
  return { id, status: 'pass', detail, evidence };
}

export function fail(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionConsequenceBehaviorCheck {
  return { id, status: 'fail', detail, evidence };
}

export function skip(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionConsequenceBehaviorCheck {
  return { id, status: 'skip', detail, evidence };
}
