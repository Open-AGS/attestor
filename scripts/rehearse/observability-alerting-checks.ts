type CheckStatus = 'pass' | 'fail' | 'skip';

export interface ProductionObservabilityAlertingCheck {
  readonly id: string;
  readonly status: CheckStatus;
  readonly detail: string;
  readonly evidence?: unknown;
}

export function pass(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionObservabilityAlertingCheck {
  return { id, status: 'pass', detail, evidence };
}

export function fail(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionObservabilityAlertingCheck {
  return { id, status: 'fail', detail, evidence };
}

export function skip(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionObservabilityAlertingCheck {
  return { id, status: 'skip', detail, evidence };
}
