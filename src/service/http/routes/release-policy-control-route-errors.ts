import type { Context } from 'hono';

export type PolicyControlPlaneErrorCode =
  | 'bad_request'
  | 'not_found'
  | 'conflict'
  | 'forbidden'
  | 'unavailable'
  | 'internal';
export type PolicyControlPlaneHttpStatus = 400 | 403 | 404 | 409 | 500 | 503;

export const POLICY_CONTROL_ERROR_STATUS: Record<PolicyControlPlaneErrorCode, PolicyControlPlaneHttpStatus> = {
  bad_request: 400,
  not_found: 404,
  conflict: 409,
  forbidden: 403,
  unavailable: 503,
  internal: 500,
};

export class PolicyControlPlaneRouteError extends Error {
  readonly code: PolicyControlPlaneErrorCode;

  constructor(code: PolicyControlPlaneErrorCode, message: string) {
    super(message);
    this.name = 'PolicyControlPlaneRouteError';
    this.code = code;
  }
}

export function policyControlPlaneError(
  code: PolicyControlPlaneErrorCode,
  message: string,
): PolicyControlPlaneRouteError {
  return new PolicyControlPlaneRouteError(code, message);
}

export function badRequest(message: string): PolicyControlPlaneRouteError {
  return policyControlPlaneError('bad_request', message);
}

export function policyErrorResponse(c: Context, error: unknown): Response {
  const mapped = mapPolicyControlPlaneError(error);
  return c.json({
    error: mapped.message,
    code: mapped.code,
  }, mapped.status);
}

export function mapPolicyControlPlaneError(error: unknown): {
  readonly code: PolicyControlPlaneErrorCode;
  readonly status: PolicyControlPlaneHttpStatus;
  readonly message: string;
} {
  if (error instanceof PolicyControlPlaneRouteError) {
    return {
      code: error.code,
      status: POLICY_CONTROL_ERROR_STATUS[error.code],
      message: error.message,
    };
  }
  if (!(error instanceof Error)) {
    return internalPolicyError();
  }

  const message = error.message;
  const normalized = message.toLowerCase();
  if (normalized.includes('was not found') || normalized.includes(' not found')) {
    return knownPolicyError('not_found', message);
  }
  if (
    normalized.includes('already ') ||
    normalized.includes('ambiguous') ||
    normalized.includes('conflict') ||
    normalized.includes('cannot rollback policy activation')
  ) {
    return knownPolicyError('conflict', message);
  }
  if (
    normalized.includes('cannot be granted by the same actor') ||
    normalized.includes('is not allowed for this policy activation approval')
  ) {
    return knownPolicyError('forbidden', message);
  }
  if (
    normalized.includes(' must ') ||
    normalized.includes(' requires ') ||
    normalized.includes(' require ') ||
    normalized.includes(' cannot be blank') ||
    normalized.startsWith('unsupported ') ||
    normalized.includes(' is invalid') ||
    normalized.includes(' invalid ')
  ) {
    return knownPolicyError('bad_request', message);
  }
  return internalPolicyError();
}

export function knownPolicyError(
  code: PolicyControlPlaneErrorCode,
  message: string,
): {
  readonly code: PolicyControlPlaneErrorCode;
  readonly status: PolicyControlPlaneHttpStatus;
  readonly message: string;
} {
  return {
    code,
    status: POLICY_CONTROL_ERROR_STATUS[code],
    message,
  };
}

export function internalPolicyError(): {
  readonly code: PolicyControlPlaneErrorCode;
  readonly status: PolicyControlPlaneHttpStatus;
  readonly message: string;
} {
  return {
    code: 'internal',
    status: 500,
    message: 'Release policy control-plane operation failed.',
  };
}
