type CheckStatus = 'pass' | 'fail' | 'skip';

export interface ProductionAsyncRecoveryCheck {
  readonly id: string;
  readonly status: CheckStatus;
  readonly detail: string;
  readonly evidence?: unknown;
}

export function pass(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionAsyncRecoveryCheck {
  return { id, status: 'pass', detail, evidence };
}

export function fail(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionAsyncRecoveryCheck {
  return { id, status: 'fail', detail, evidence };
}

export function skip(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionAsyncRecoveryCheck {
  return { id, status: 'skip', detail, evidence };
}
