import { createHash } from 'node:crypto';
import {
  ReleaseTokenVerificationFailure,
  verifyIssuedReleaseToken,
  type ReleaseTokenVerificationKey,
} from '../release-kernel/release-token.js';
import type {
  ReleaseTokenClaims,
} from '../release-kernel/object-model.js';
import type {
  ConsequenceAdmissionConstraint,
  ConsequenceAdmissionDecision,
  ConsequenceAdmissionProofRef,
  ConsequenceAdmissionResponse,
} from './index.js';

export const CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION =
  'attestor.consequence-admission-customer-gate.v1';
export const CONSEQUENCE_ADMISSION_CUSTOMER_GATE_SIGNED_BEARER_VERSION =
  'attestor.consequence-admission-customer-gate-signed-bearer.v1';

export type ConsequenceAdmissionCustomerGateOutcome = 'proceed' | 'hold';
export type ConsequenceAdmissionCustomerGateSignedBearerFailureReason =
  | 'base-gate-held'
  | 'missing-bearer-token'
  | 'malformed-bearer-token'
  | 'invalid-signature'
  | 'proof-ref-missing'
  | 'tenant-mismatch'
  | 'decision-not-accepted'
  | 'introspection-required'
  | 'sender-constrained-token-unsupported';

export interface EvaluateConsequenceAdmissionGateInput {
  readonly admission: ConsequenceAdmissionResponse;
  readonly downstreamAction: string;
  readonly requireProof?: boolean;
}

export interface EvaluateConsequenceAdmissionSignedBearerGateInput
  extends EvaluateConsequenceAdmissionGateInput {
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly authorizationHeader?: string | null;
  readonly bearerToken?: string | null;
  readonly audience?: string | null;
  readonly expectedTenantId?: string | null;
  readonly currentDate?: string;
}

export interface ConsequenceAdmissionCustomerGateDecision {
  readonly version: typeof CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION;
  readonly outcome: ConsequenceAdmissionCustomerGateOutcome;
  readonly downstreamAction: string;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly decision: ConsequenceAdmissionDecision;
  readonly allowedByAdmission: boolean;
  readonly failClosed: boolean;
  readonly proofRequired: boolean;
  readonly proofSatisfied: boolean;
  readonly proofSkippedByCaller: boolean;
  readonly proofRefs: readonly ConsequenceAdmissionProofRef[];
  readonly constraints: readonly ConsequenceAdmissionConstraint[];
  readonly reason: string;
  readonly reasonCodes: readonly string[];
  readonly instruction: string;
}

export interface ConsequenceAdmissionCustomerGateSignedBearerVerification {
  readonly version: typeof CONSEQUENCE_ADMISSION_CUSTOMER_GATE_SIGNED_BEARER_VERSION;
  readonly presented: boolean;
  readonly valid: boolean;
  readonly signatureVerified: boolean;
  readonly tokenDigest: string | null;
  readonly tokenId: string | null;
  readonly releaseDecisionId: string | null;
  readonly audience: string;
  readonly expectedTenantId: string | null;
  readonly claimsTenantId: string | null;
  readonly proofRefMatched: boolean;
  readonly introspectionRequired: boolean | null;
  readonly senderConstrained: boolean | null;
  readonly rawBearerTokenStored: false;
  readonly failureReasons: readonly ConsequenceAdmissionCustomerGateSignedBearerFailureReason[];
}

export interface ConsequenceAdmissionCustomerGateSignedBearerDecision
  extends Omit<ConsequenceAdmissionCustomerGateDecision, 'version'> {
  readonly version: typeof CONSEQUENCE_ADMISSION_CUSTOMER_GATE_SIGNED_BEARER_VERSION;
  readonly baseGateVersion: typeof CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION;
  readonly signedBearer: ConsequenceAdmissionCustomerGateSignedBearerVerification;
}

function normalizeDownstreamAction(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Consequence admission customer gate requires a downstream action label.');
  }
  return normalized;
}

function readonlyCopy<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function normalizeOptionalIdentifier(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function digestBearerToken(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

function extractBearerToken(input: {
  readonly authorizationHeader?: string | null;
  readonly bearerToken?: string | null;
}): { readonly token: string | null; readonly malformed: boolean } {
  const direct = normalizeOptionalIdentifier(input.bearerToken);
  if (direct) {
    return { token: direct, malformed: false };
  }

  const header = normalizeOptionalIdentifier(input.authorizationHeader);
  if (!header) {
    return { token: null, malformed: false };
  }
  const match = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/u.exec(header);
  if (!match?.[1]) {
    return { token: null, malformed: true };
  }
  return { token: match[1], malformed: false };
}

function releaseTokenProofRefMatched(input: {
  readonly admission: ConsequenceAdmissionResponse;
  readonly claims: ReleaseTokenClaims;
  readonly tokenDigest: string;
}): boolean {
  return input.admission.proof.some((proofRef) =>
    proofRef.kind === 'release-token' &&
    proofRef.id === input.claims.jti &&
    proofRef.digest === input.tokenDigest,
  );
}

function uniqueFailureReasons(
  reasons: readonly ConsequenceAdmissionCustomerGateSignedBearerFailureReason[],
): readonly ConsequenceAdmissionCustomerGateSignedBearerFailureReason[] {
  return Object.freeze(Array.from(new Set(reasons)));
}

export class ConsequenceAdmissionGateHeldError extends Error {
  readonly gateDecision: ConsequenceAdmissionCustomerGateDecision;

  constructor(gateDecision: ConsequenceAdmissionCustomerGateDecision) {
    super(gateDecision.reason);
    this.name = 'ConsequenceAdmissionGateHeldError';
    this.gateDecision = gateDecision;
  }
}

export class ConsequenceAdmissionSignedBearerGateHeldError extends Error {
  readonly gateDecision: ConsequenceAdmissionCustomerGateSignedBearerDecision;

  constructor(gateDecision: ConsequenceAdmissionCustomerGateSignedBearerDecision) {
    super(gateDecision.reason);
    this.name = 'ConsequenceAdmissionSignedBearerGateHeldError';
    this.gateDecision = gateDecision;
  }
}

export function evaluateConsequenceAdmissionGate(
  input: EvaluateConsequenceAdmissionGateInput,
): ConsequenceAdmissionCustomerGateDecision {
  const downstreamAction = normalizeDownstreamAction(input.downstreamAction);
  const proofRequired =
    input.requireProof ?? (input.admission.decision === 'admit' || input.admission.decision === 'narrow');
  const proofRefs = readonlyCopy(input.admission.proof);
  const proofSkippedByCaller = input.requireProof === false && proofRefs.length === 0;
  const proofSatisfied = !proofRequired || proofRefs.length > 0;
  const failedRequiredChecks = input.admission.checks.filter((check) =>
    check.required && check.outcome === 'fail',
  );
  const requiredChecksSatisfied = failedRequiredChecks.length === 0;
  const allowedByAdmission =
    input.admission.allowed &&
    (input.admission.decision === 'admit' || input.admission.decision === 'narrow') &&
    !input.admission.failClosed;
  const outcome: ConsequenceAdmissionCustomerGateOutcome =
    allowedByAdmission && proofSatisfied && requiredChecksSatisfied ? 'proceed' : 'hold';
  const missingRequiredProof = proofRequired && !proofSatisfied;
  const failedRequiredCheckCodes = failedRequiredChecks.map((check) => check.kind);
  const reasonCodes = Object.freeze([
    ...input.admission.reasonCodes,
    missingRequiredProof
      ? 'customer-gate-proof-required'
      : proofSkippedByCaller
        ? 'customer-gate-proof-skipped-by-caller'
        : 'customer-gate-proof-satisfied',
    requiredChecksSatisfied ? 'customer-gate-required-checks-satisfied' : 'customer-gate-required-check-failed',
    ...failedRequiredCheckCodes.map((kind) => `customer-gate-required-${kind}-failed`),
    `customer-gate-${outcome}`,
  ]);
  const reason = missingRequiredProof
    ? 'Customer gate held the consequence because required proof references were missing.'
    : !requiredChecksSatisfied
      ? `Customer gate held the consequence because required Attestor checks failed: ${failedRequiredCheckCodes.join(', ')}.`
    : outcome === 'proceed'
      ? 'Customer gate may run the downstream action because Attestor admitted the consequence.'
      : `Customer gate held the consequence because Attestor returned ${input.admission.decision}.`;

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION,
    outcome,
    downstreamAction,
    admissionId: input.admission.admissionId,
    admissionDigest: input.admission.digest,
    decision: input.admission.decision,
    allowedByAdmission,
    failClosed: input.admission.failClosed || outcome === 'hold',
    proofRequired,
    proofSatisfied,
    proofSkippedByCaller,
    proofRefs,
    constraints: readonlyCopy(input.admission.constraints),
    reason,
    reasonCodes,
    instruction: outcome === 'proceed'
      ? `Run downstream action: ${downstreamAction}`
      : `Do not run downstream action: ${downstreamAction}`,
  });
}

export function assertConsequenceAdmissionGateAllows(
  input: EvaluateConsequenceAdmissionGateInput,
): ConsequenceAdmissionCustomerGateDecision {
  const gateDecision = evaluateConsequenceAdmissionGate(input);
  if (gateDecision.outcome !== 'proceed') {
    throw new ConsequenceAdmissionGateHeldError(gateDecision);
  }
  return gateDecision;
}

export async function evaluateConsequenceAdmissionGateWithSignedBearerToken(
  input: EvaluateConsequenceAdmissionSignedBearerGateInput,
): Promise<ConsequenceAdmissionCustomerGateSignedBearerDecision> {
  const baseGate = evaluateConsequenceAdmissionGate(input);
  const audience = normalizeOptionalIdentifier(input.audience) ?? baseGate.downstreamAction;
  const expectedTenantId =
    input.expectedTenantId === null
      ? null
      : normalizeOptionalIdentifier(input.expectedTenantId) ??
        normalizeOptionalIdentifier(input.admission.request.policyScope.tenantId);
  const parsed = extractBearerToken(input);
  const failureReasons: ConsequenceAdmissionCustomerGateSignedBearerFailureReason[] = [];
  let claims: ReleaseTokenClaims | null = null;
  let signatureVerified = false;
  let tokenDigest: string | null = null;

  if (baseGate.outcome !== 'proceed') {
    failureReasons.push('base-gate-held');
  }
  if (parsed.malformed) {
    failureReasons.push('malformed-bearer-token');
  } else if (parsed.token === null) {
    failureReasons.push('missing-bearer-token');
  } else {
    tokenDigest = digestBearerToken(parsed.token);
    try {
      const verified = await verifyIssuedReleaseToken({
        token: parsed.token,
        verificationKey: input.verificationKey,
        audience,
        currentDate: input.currentDate,
      });
      claims = verified.claims;
      signatureVerified = true;
    } catch (error) {
      if (error instanceof ReleaseTokenVerificationFailure) {
        failureReasons.push('invalid-signature');
      } else {
        throw error;
      }
    }
  }

  const proofRefMatched = claims !== null && tokenDigest !== null
    ? releaseTokenProofRefMatched({
        admission: input.admission,
        claims,
        tokenDigest,
      })
    : false;
  if (claims !== null && !proofRefMatched) {
    failureReasons.push('proof-ref-missing');
  }
  if (claims !== null && expectedTenantId !== null && claims.tenant_id !== expectedTenantId) {
    failureReasons.push('tenant-mismatch');
  }
  if (claims !== null && claims.decision !== 'accepted' && claims.decision !== 'overridden') {
    failureReasons.push('decision-not-accepted');
  }
  if (claims?.introspection_required === true) {
    failureReasons.push('introspection-required');
  }
  if (claims?.cnf !== undefined) {
    failureReasons.push('sender-constrained-token-unsupported');
  }

  const signedBearerFailures = uniqueFailureReasons(failureReasons);
  const signedBearerValid = signedBearerFailures.length === 0;
  const outcome: ConsequenceAdmissionCustomerGateOutcome =
    baseGate.outcome === 'proceed' && signedBearerValid ? 'proceed' : 'hold';
  const reasonCodes = Object.freeze([
    ...baseGate.reasonCodes,
    ...signedBearerFailures.map((reason) => `customer-gate-signed-bearer-${reason}`),
    signedBearerValid
      ? 'customer-gate-signed-bearer-valid'
      : 'customer-gate-signed-bearer-invalid',
    `customer-gate-signed-bearer-${outcome}`,
  ]);
  const reason = outcome === 'proceed'
    ? 'Customer gate may run the downstream action because Attestor admitted the consequence and the signed bearer release token matched the admission proof.'
    : signedBearerFailures.includes('introspection-required') ||
        signedBearerFailures.includes('sender-constrained-token-unsupported')
      ? 'Customer gate held the consequence because this token requires the release-enforcement plane rather than bearer-only customer-gate verification.'
      : signedBearerFailures.includes('proof-ref-missing')
        ? 'Customer gate held the consequence because the signed bearer token did not match an admission release-token proof reference.'
        : signedBearerFailures.includes('invalid-signature')
          ? 'Customer gate held the consequence because the signed bearer token could not be verified.'
          : baseGate.reason;

  return Object.freeze({
    ...baseGate,
    version: CONSEQUENCE_ADMISSION_CUSTOMER_GATE_SIGNED_BEARER_VERSION,
    baseGateVersion: CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION,
    outcome,
    failClosed: baseGate.failClosed || outcome === 'hold',
    reason,
    reasonCodes,
    instruction: outcome === 'proceed'
      ? `Run downstream action: ${baseGate.downstreamAction}`
      : `Do not run downstream action: ${baseGate.downstreamAction}`,
    signedBearer: Object.freeze({
      version: CONSEQUENCE_ADMISSION_CUSTOMER_GATE_SIGNED_BEARER_VERSION,
      presented: parsed.token !== null,
      valid: signedBearerValid,
      signatureVerified,
      tokenDigest,
      tokenId: claims?.jti ?? null,
      releaseDecisionId: claims?.decision_id ?? null,
      audience,
      expectedTenantId,
      claimsTenantId: claims?.tenant_id ?? null,
      proofRefMatched,
      introspectionRequired: claims?.introspection_required ?? null,
      senderConstrained: claims?.cnf !== undefined ? true : claims === null ? null : false,
      rawBearerTokenStored: false,
      failureReasons: signedBearerFailures,
    }),
  });
}

export async function assertConsequenceAdmissionGateAllowsSignedBearerToken(
  input: EvaluateConsequenceAdmissionSignedBearerGateInput,
): Promise<ConsequenceAdmissionCustomerGateSignedBearerDecision> {
  const gateDecision = await evaluateConsequenceAdmissionGateWithSignedBearerToken(input);
  if (gateDecision.outcome !== 'proceed') {
    throw new ConsequenceAdmissionSignedBearerGateHeldError(gateDecision);
  }
  return gateDecision;
}
