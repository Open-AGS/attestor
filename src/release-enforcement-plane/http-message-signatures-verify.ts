import type { ParsedSignatureInput } from './http-message-signatures-parse.js';
import type { EnforcementFailureReason } from './types.js';
import {
  DEFAULT_HTTP_AUTHORIZATION_ENVELOPE_COMPONENTS,
  DEFAULT_HTTP_MESSAGE_SIGNATURE_CLOCK_SKEW_SECONDS,
  DEFAULT_HTTP_MESSAGE_SIGNATURE_MAX_AGE_SECONDS,
  HTTP_MESSAGE_SIGNATURE_ALGORITHM,
  HTTP_MESSAGE_SIGNATURE_LABEL,
  HTTP_MESSAGE_SIGNATURE_PRESENTATION_SPEC_VERSION,
  type HttpMessageSignatureVerification,
  type VerifyHttpMessageSignatureInput,
} from './http-message-signatures-types.js';
import {
  numericParam,
  parseSignatureBytes,
  parseSignatureInput,
  signatureBase,
  stringParam,
} from './http-message-signatures-parse.js';
import {
  publicJwkThumbprint,
  verifyEd25519,
} from './http-message-signatures-crypto.js';
import {
  contentDigestFailureReasons,
  coverageFailureReasons,
  timeFailureReasons,
} from './http-message-signatures-validation.js';
import {
  isoFromEpochSeconds,
  normalizeComponentName,
  normalizeHttpMessageHeaders,
  normalizeIsoTimestamp,
  uniqueFailureReasons,
} from './http-message-signatures-utils.js';
import {
  httpMessageSignatureReplayKey,
} from './http-message-signatures-create.js';

export async function verifyHttpMessageSignature(
  input: VerifyHttpMessageSignatureInput,
): Promise<HttpMessageSignatureVerification> {
  const checkedAt = normalizeIsoTimestamp(input.now, 'now');
  const label = input.label ?? HTTP_MESSAGE_SIGNATURE_LABEL;
  let parsed: ParsedSignatureInput;
  let signatureBytes: Buffer;

  try {
    parsed = parseSignatureInput(input.signatureInput, label);
    signatureBytes = parseSignatureBytes(input.signature, parsed.label);
  } catch {
    return Object.freeze({
      version: HTTP_MESSAGE_SIGNATURE_PRESENTATION_SPEC_VERSION,
      status: 'invalid',
      checkedAt,
      label,
      algorithm: null,
      keyId: null,
      publicKeyThumbprint: null,
      coveredComponents: Object.freeze([]),
      createdAt: null,
      expiresAt: null,
      nonce: null,
      tag: null,
      contentDigest: null,
      replayKey: null,
      failureReasons: uniqueFailureReasons(['invalid-signature']),
    });
  }

  const algorithm = stringParam(parsed.params, 'alg');
  const keyId = stringParam(parsed.params, 'keyid');
  const nonce = stringParam(parsed.params, 'nonce');
  const tag = stringParam(parsed.params, 'tag');
  const created = numericParam(parsed.params, 'created');
  const expires = numericParam(parsed.params, 'expires');
  const requiredCoveredComponents =
    input.requiredCoveredComponents === undefined
      ? DEFAULT_HTTP_AUTHORIZATION_ENVELOPE_COMPONENTS
      : Object.freeze(input.requiredCoveredComponents.map(normalizeComponentName));
  const headers = normalizeHttpMessageHeaders(input.message.headers);
  const failureReasons: EnforcementFailureReason[] = [];
  let publicKeyThumbprintValue: string | null = null;

  if (algorithm !== HTTP_MESSAGE_SIGNATURE_ALGORITHM) {
    failureReasons.push('invalid-signature');
  }

  if (keyId === null) {
    failureReasons.push('invalid-signature');
  } else if (
    input.expectedKeyId !== undefined &&
    input.expectedKeyId !== null &&
    keyId !== input.expectedKeyId
  ) {
    failureReasons.push('binding-mismatch');
  }

  if (
    input.expectedTag !== undefined &&
    input.expectedTag !== null &&
    tag !== input.expectedTag
  ) {
    failureReasons.push('binding-mismatch');
  }

  if (input.expectedNonce !== undefined && input.expectedNonce !== null) {
    if (nonce === null) {
      failureReasons.push('missing-nonce');
    } else if (nonce !== input.expectedNonce) {
      failureReasons.push('invalid-nonce');
    }
  }

  failureReasons.push(
    ...coverageFailureReasons({
      coveredComponents: parsed.coveredComponents,
      requiredCoveredComponents,
    }),
    ...timeFailureReasons({
      created,
      expires,
      now: checkedAt,
      maxAgeSeconds:
        input.maxSignatureAgeSeconds ?? DEFAULT_HTTP_MESSAGE_SIGNATURE_MAX_AGE_SECONDS,
      clockSkewSeconds:
        input.clockSkewSeconds ?? DEFAULT_HTTP_MESSAGE_SIGNATURE_CLOCK_SKEW_SECONDS,
    }),
  );

  if (parsed.coveredComponents.includes('content-digest')) {
    failureReasons.push(...contentDigestFailureReasons(input.message));
  }

  try {
    publicKeyThumbprintValue = await publicJwkThumbprint(input.publicJwk);
    if (
      input.expectedJwkThumbprint !== undefined &&
      input.expectedJwkThumbprint !== null &&
      publicKeyThumbprintValue !== input.expectedJwkThumbprint
    ) {
      failureReasons.push('binding-mismatch');
    }

    const base = signatureBase(
      input.message,
      parsed.coveredComponents,
      parsed.signatureParamsValue,
    );
    if (
      algorithm === HTTP_MESSAGE_SIGNATURE_ALGORITHM &&
      !verifyEd25519({
        publicJwk: input.publicJwk,
        signatureBase: base,
        signature: signatureBytes,
      })
    ) {
      failureReasons.push('invalid-signature');
    }
  } catch {
    failureReasons.push('invalid-signature');
  }

  const replayKey = httpMessageSignatureReplayKey({
    nonce,
    signature: signatureBytes.toString('base64'),
  });
  if (
    input.replayLedgerEntry &&
    input.replayLedgerEntry.key === replayKey &&
    new Date(input.replayLedgerEntry.expiresAt).getTime() >= new Date(checkedAt).getTime()
  ) {
    failureReasons.push('replayed-authorization');
  }

  const uniqueFailures = uniqueFailureReasons(failureReasons);
  return Object.freeze({
    version: HTTP_MESSAGE_SIGNATURE_PRESENTATION_SPEC_VERSION,
    status: uniqueFailures.length === 0 ? 'valid' : 'invalid',
    checkedAt,
    label: parsed.label,
    algorithm,
    keyId,
    publicKeyThumbprint: publicKeyThumbprintValue,
    coveredComponents: parsed.coveredComponents,
    createdAt: isoFromEpochSeconds(created),
    expiresAt: isoFromEpochSeconds(expires),
    nonce,
    tag,
    contentDigest: headers['content-digest'] ?? null,
    replayKey,
    failureReasons: uniqueFailures,
  });
}
