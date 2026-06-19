import type { ReleaseEnforcementPolicyContext } from './object-model.js';
import type { EnforcementFailureReason } from './types.js';
import {
  ASYNC_CONSEQUENCE_ENVELOPE_ALGORITHM,
  ASYNC_CONSEQUENCE_ENVELOPE_PAYLOAD_TYPE,
  ASYNC_CONSEQUENCE_ENVELOPE_PREDICATE_TYPE,
  ASYNC_CONSEQUENCE_ENVELOPE_SPEC_VERSION,
  CLOUDEVENTS_SPEC_VERSION,
  DEFAULT_ASYNC_ENVELOPE_CLOCK_SKEW_SECONDS,
  DEFAULT_ASYNC_ENVELOPE_MAX_AGE_SECONDS,
  IN_TOTO_STATEMENT_V1_TYPE,
  type AsyncConsequenceEnvelopePredicate,
  type AsyncConsequenceEnvelopeStatement,
  type DsseEnvelope,
  type DsseSignature,
  type SignedAsyncConsequenceEnvelope,
  type SignedAsyncConsequenceEnvelopeVerification,
  type VerifySignedAsyncConsequenceEnvelopeInput,
} from './async-envelope-types.js';
import { canonicalJson } from './async-envelope-canonical.js';
import {
  publicJwkThumbprint,
  sha256Digest,
  timingSafeStringEqual,
  verifyEd25519,
} from './async-envelope-crypto.js';
import {
  dsseEnvelopeDigest,
  dssePreAuthenticationEncoding,
  replayKeyForEnvelope,
  signatureRef,
} from './async-envelope-dsse.js';
import {
  epochSeconds,
  normalizeIsoTimestamp,
  normalizePolicyContext,
  policyContextMatchesConsequence,
  uniqueFailureReasons,
} from './async-envelope-normalize.js';

function unwrapEnvelope(
  envelope: DsseEnvelope | SignedAsyncConsequenceEnvelope,
): DsseEnvelope {
  if ('envelope' in envelope) {
    return envelope.envelope;
  }
  return envelope;
}

function invalidVerification(checkedAt: string): SignedAsyncConsequenceEnvelopeVerification {
  return Object.freeze({
    version: ASYNC_CONSEQUENCE_ENVELOPE_SPEC_VERSION,
    status: 'invalid',
    checkedAt,
    keyId: null,
    publicKeyThumbprint: null,
    envelopeDigest: null,
    subjectDigest: null,
    statementDigest: null,
    signatureRef: null,
    createdAt: null,
    expiresAt: null,
    idempotencyKey: null,
    releaseTokenDigest: null,
    releaseTokenId: null,
    releaseDecisionId: null,
    policyHash: null,
    policyVersion: null,
    policyIrHash: null,
    policyProvenanceSource: null,
    compiledPolicyIndexVersion: null,
    compiledPolicyIrVersion: null,
    policyContext: null,
    targetId: null,
    messageId: null,
    queueOrTopic: null,
    cloudEvent: null,
    replayKey: null,
    failureReasons: uniqueFailureReasons(['invalid-signature']),
  });
}

function parseBase64(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error('Async consequence envelope value must be base64.');
  }
  return Buffer.from(value, 'base64');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStatement(payloadBytes: Buffer): AsyncConsequenceEnvelopeStatement {
  const parsed = JSON.parse(payloadBytes.toString('utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('Async consequence envelope payload must be a statement object.');
  }
  return parsed as unknown as AsyncConsequenceEnvelopeStatement;
}

function firstSignature(
  envelope: DsseEnvelope,
  expectedKeyId: string | null | undefined,
): DsseSignature {
  const signatures = envelope.signatures ?? [];
  if (signatures.length === 0) {
    throw new Error('Async consequence envelope requires a DSSE signature.');
  }
  const selected =
    expectedKeyId === undefined || expectedKeyId === null
      ? signatures[0]
      : signatures.find((signature) => signature.keyid === expectedKeyId);
  if (!selected) {
    throw new Error('Async consequence envelope does not include the expected key id.');
  }
  return selected;
}

function statementShapeFailures(
  statement: AsyncConsequenceEnvelopeStatement,
): readonly EnforcementFailureReason[] {
  const reasons: EnforcementFailureReason[] = [];
  if (statement._type !== IN_TOTO_STATEMENT_V1_TYPE) {
    reasons.push('binding-mismatch');
  }
  if (statement.predicateType !== ASYNC_CONSEQUENCE_ENVELOPE_PREDICATE_TYPE) {
    reasons.push('binding-mismatch');
  }
  if (!Array.isArray(statement.subject) || statement.subject.length === 0) {
    reasons.push('binding-mismatch');
  }
  if (statement.predicate?.version !== ASYNC_CONSEQUENCE_ENVELOPE_SPEC_VERSION) {
    reasons.push('binding-mismatch');
  }
  if (statement.predicate?.cloudEvent?.specversion !== CLOUDEVENTS_SPEC_VERSION) {
    reasons.push('binding-mismatch');
  }
  if (statement.predicate?.signer?.algorithm !== ASYNC_CONSEQUENCE_ENVELOPE_ALGORITHM) {
    reasons.push('invalid-signature');
  }
  return uniqueFailureReasons(reasons);
}

function subjectDigestFromStatement(statement: AsyncConsequenceEnvelopeStatement): string | null {
  const subject = statement.subject[0];
  const sha256 = subject?.digest?.sha256;
  return typeof sha256 === 'string' && sha256.length > 0 ? `sha256:${sha256.toLowerCase()}` : null;
}

function completePredicate(
  statement: AsyncConsequenceEnvelopeStatement,
): AsyncConsequenceEnvelopePredicate | null {
  const predicate = (statement as unknown as { readonly predicate?: unknown }).predicate;
  if (!isRecord(predicate)) {
    return null;
  }
  if (
    typeof predicate.createdAt !== 'string' ||
    typeof predicate.expiresAt !== 'string' ||
    typeof predicate.idempotencyKey !== 'string'
  ) {
    return null;
  }
  if (
    !isRecord(predicate.release) ||
    !isRecord(predicate.consequence) ||
    !isRecord(predicate.target) ||
    !isRecord(predicate.transport) ||
    !isRecord(predicate.cloudEvent) ||
    !isRecord(predicate.signer)
  ) {
    return null;
  }
  return predicate as unknown as AsyncConsequenceEnvelopePredicate;
}

function timeFailureReasons(input: {
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly now: string;
  readonly maxAgeSeconds: number;
  readonly clockSkewSeconds: number;
}): readonly EnforcementFailureReason[] {
  const reasons: EnforcementFailureReason[] = [];
  const now = epochSeconds(input.now);
  const created = epochSeconds(input.createdAt);
  const expires = epochSeconds(input.expiresAt);

  if (created > now + input.clockSkewSeconds) {
    reasons.push('future-issued-at');
  }
  if (now - created > input.maxAgeSeconds + input.clockSkewSeconds) {
    reasons.push('stale-authorization');
  }
  if (now - input.clockSkewSeconds >= expires) {
    reasons.push('expired-authorization');
  }

  return uniqueFailureReasons(reasons);
}

function compareExpected(
  actual: string | null,
  expected: string | null | undefined,
  reason: EnforcementFailureReason,
): readonly EnforcementFailureReason[] {
  if (expected === undefined || expected === null) {
    return [];
  }
  if (actual === null || !timingSafeStringEqual(actual, expected)) {
    return [reason];
  }
  return [];
}

function compareExpectedPolicyContext(
  actual: ReleaseEnforcementPolicyContext | null,
  expected: ReleaseEnforcementPolicyContext | null | undefined,
): readonly EnforcementFailureReason[] {
  if (expected === undefined || expected === null) {
    return [];
  }
  const normalizedExpected = normalizePolicyContext(expected);
  if (
    actual === null ||
    normalizedExpected === null ||
    !timingSafeStringEqual(canonicalJson(actual), canonicalJson(normalizedExpected))
  ) {
    return ['binding-mismatch'];
  }
  return [];
}

function bindingFailureReasons(input: {
  readonly verificationInput: VerifySignedAsyncConsequenceEnvelopeInput;
  readonly statement: AsyncConsequenceEnvelopeStatement;
  readonly envelopeDigest: string;
  readonly subjectDigest: string | null;
  readonly signatureRefValue: string;
  readonly publicKeyThumbprint: string;
  readonly keyId: string;
}): readonly EnforcementFailureReason[] {
  const predicate = input.statement.predicate;
  const expected = input.verificationInput;
  const reasons: EnforcementFailureReason[] = [];
  const policyContext = normalizePolicyContext(predicate.consequence.policyContext);

  reasons.push(
    ...compareExpected(input.envelopeDigest, expected.expectedEnvelopeDigest, 'binding-mismatch'),
    ...compareExpected(input.subjectDigest, expected.expectedSubjectDigest, 'binding-mismatch'),
    ...compareExpected(input.keyId, expected.expectedKeyId, 'binding-mismatch'),
    ...compareExpected(
      input.publicKeyThumbprint,
      expected.expectedJwkThumbprint,
      'binding-mismatch',
    ),
    ...compareExpected(
      predicate.release.tokenDigest,
      expected.expectedReleaseTokenDigest,
      'binding-mismatch',
    ),
    ...compareExpected(
      predicate.release.tokenId,
      expected.expectedReleaseTokenId,
      'binding-mismatch',
    ),
    ...compareExpected(
      predicate.release.decisionId,
      expected.expectedReleaseDecisionId,
      'binding-mismatch',
    ),
    ...compareExpected(predicate.release.audience, expected.expectedAudience, 'wrong-audience'),
    ...compareExpected(predicate.target.id, expected.expectedTargetId, 'binding-mismatch'),
    ...compareExpected(
      predicate.consequence.outputHash,
      expected.expectedOutputHash,
      'binding-mismatch',
    ),
    ...compareExpected(
      predicate.consequence.consequenceHash,
      expected.expectedConsequenceHash,
      'binding-mismatch',
    ),
    ...compareExpected(
      predicate.consequence.policyHash,
      expected.expectedPolicyHash,
      'binding-mismatch',
    ),
    ...compareExpected(
      predicate.consequence.policyVersion ?? null,
      expected.expectedPolicyVersion,
      'binding-mismatch',
    ),
    ...compareExpected(
      predicate.consequence.policyIrHash ?? null,
      expected.expectedPolicyIrHash,
      'binding-mismatch',
    ),
    ...compareExpected(
      predicate.consequence.policyProvenanceSource ?? null,
      expected.expectedPolicyProvenanceSource,
      'binding-mismatch',
    ),
    ...compareExpected(
      predicate.consequence.compiledPolicyIndexVersion ?? null,
      expected.expectedCompiledPolicyIndexVersion,
      'binding-mismatch',
    ),
    ...compareExpected(
      predicate.consequence.compiledPolicyIrVersion ?? null,
      expected.expectedCompiledPolicyIrVersion,
      'binding-mismatch',
    ),
    ...compareExpectedPolicyContext(policyContext, expected.expectedPolicyContext),
    ...compareExpected(
      predicate.idempotencyKey,
      expected.expectedIdempotencyKey,
      'binding-mismatch',
    ),
    ...compareExpected(
      predicate.transport.messageId,
      expected.expectedMessageId,
      'binding-mismatch',
    ),
    ...compareExpected(
      predicate.transport.queueOrTopic,
      expected.expectedQueueOrTopic,
      'binding-mismatch',
    ),
  );

  if (!policyContextMatchesConsequence(predicate.consequence)) {
    reasons.push('binding-mismatch');
  }

  if (
    expected.expectedConsequenceType !== undefined &&
    expected.expectedConsequenceType !== null &&
    predicate.consequence.consequenceType !== expected.expectedConsequenceType
  ) {
    reasons.push('wrong-consequence');
  }

  if (
    expected.expectedRiskClass !== undefined &&
    expected.expectedRiskClass !== null &&
    predicate.consequence.riskClass !== expected.expectedRiskClass
  ) {
    reasons.push('binding-mismatch');
  }

  if (predicate.signer.keyId !== input.keyId) {
    reasons.push('binding-mismatch');
  }
  if (predicate.signer.publicKeyThumbprint !== input.publicKeyThumbprint) {
    reasons.push('binding-mismatch');
  }
  if (input.signatureRefValue.length === 0) {
    reasons.push('invalid-signature');
  }

  return uniqueFailureReasons(reasons);
}

export async function verifySignedAsyncConsequenceEnvelope(
  input: VerifySignedAsyncConsequenceEnvelopeInput,
): Promise<SignedAsyncConsequenceEnvelopeVerification> {
  const checkedAt = normalizeIsoTimestamp(input.now, 'now');
  let envelope: DsseEnvelope;
  let payloadBytes: Buffer;
  let statement: AsyncConsequenceEnvelopeStatement;
  let signature: DsseSignature;
  let signatureBytes: Buffer;

  try {
    envelope = unwrapEnvelope(input.envelope);
    if (envelope.payloadType !== ASYNC_CONSEQUENCE_ENVELOPE_PAYLOAD_TYPE) {
      return invalidVerification(checkedAt);
    }
    signature = firstSignature(envelope, input.expectedKeyId);
    payloadBytes = parseBase64(envelope.payload);
    signatureBytes = parseBase64(signature.sig);
    statement = parseStatement(payloadBytes);
    if (canonicalJson(statement) !== payloadBytes.toString('utf8')) {
      return invalidVerification(checkedAt);
    }
  } catch {
    return invalidVerification(checkedAt);
  }

  const failureReasons: EnforcementFailureReason[] = [];
  const envelopeDigest = dsseEnvelopeDigest(envelope);
  const subjectDigest = subjectDigestFromStatement(statement);
  const statementDigest = sha256Digest(payloadBytes);
  const signatureRefValue = signatureRef({
    keyId: signature.keyid,
    signature: signature.sig,
  });
  const predicate = completePredicate(statement);
  let publicKeyThumbprintValue: string | null = null;

  failureReasons.push(...statementShapeFailures(statement));
  if (predicate === null) {
    failureReasons.push('binding-mismatch');
  }

  try {
    publicKeyThumbprintValue = await publicJwkThumbprint(input.publicJwk);
    if (
      !verifyEd25519({
        publicJwk: input.publicJwk,
        bytes: dssePreAuthenticationEncoding(envelope.payloadType, payloadBytes),
        signature: signatureBytes,
      })
    ) {
      failureReasons.push('invalid-signature');
    }
  } catch {
    failureReasons.push('invalid-signature');
  }

  if (publicKeyThumbprintValue !== null && predicate !== null) {
    failureReasons.push(
      ...bindingFailureReasons({
        verificationInput: input,
        statement,
        envelopeDigest,
        subjectDigest,
        signatureRefValue,
        publicKeyThumbprint: publicKeyThumbprintValue,
        keyId: signature.keyid,
      }),
    );
  }

  if (predicate !== null) {
    failureReasons.push(
      ...timeFailureReasons({
        createdAt: predicate.createdAt,
        expiresAt: predicate.expiresAt,
        now: checkedAt,
        maxAgeSeconds:
          input.maxEnvelopeAgeSeconds ?? DEFAULT_ASYNC_ENVELOPE_MAX_AGE_SECONDS,
        clockSkewSeconds:
          input.clockSkewSeconds ?? DEFAULT_ASYNC_ENVELOPE_CLOCK_SKEW_SECONDS,
      }),
    );
  }

  const replayKey = replayKeyForEnvelope(envelopeDigest);
  if (
    input.replayLedgerEntry &&
    input.replayLedgerEntry.key === replayKey &&
    new Date(input.replayLedgerEntry.expiresAt).getTime() >= new Date(checkedAt).getTime()
  ) {
    failureReasons.push('replayed-authorization');
  }

  const uniqueFailures = uniqueFailureReasons(failureReasons);
  return Object.freeze({
    version: ASYNC_CONSEQUENCE_ENVELOPE_SPEC_VERSION,
    status: uniqueFailures.length === 0 ? 'valid' : 'invalid',
    checkedAt,
    keyId: signature.keyid,
    publicKeyThumbprint: publicKeyThumbprintValue,
    envelopeDigest,
    subjectDigest,
    statementDigest,
    signatureRef: signatureRefValue,
    createdAt: predicate?.createdAt ?? null,
    expiresAt: predicate?.expiresAt ?? null,
    idempotencyKey: predicate?.idempotencyKey ?? null,
    releaseTokenDigest: predicate?.release.tokenDigest ?? null,
    releaseTokenId: predicate?.release.tokenId ?? null,
    releaseDecisionId: predicate?.release.decisionId ?? null,
    policyHash: predicate?.consequence.policyHash ?? null,
    policyVersion: predicate?.consequence.policyVersion ?? null,
    policyIrHash: predicate?.consequence.policyIrHash ?? null,
    policyProvenanceSource: predicate?.consequence.policyProvenanceSource ?? null,
    compiledPolicyIndexVersion: predicate?.consequence.compiledPolicyIndexVersion ?? null,
    compiledPolicyIrVersion: predicate?.consequence.compiledPolicyIrVersion ?? null,
    policyContext: normalizePolicyContext(predicate?.consequence.policyContext),
    targetId: predicate?.target.id ?? null,
    messageId: predicate?.transport.messageId ?? null,
    queueOrTopic: predicate?.transport.queueOrTopic ?? null,
    cloudEvent: predicate?.cloudEvent ?? null,
    replayKey,
    failureReasons: uniqueFailures,
  });
}
