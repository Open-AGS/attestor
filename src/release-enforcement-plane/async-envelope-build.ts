import type { IssuedReleaseToken } from '../release-kernel/release-token.js';
import type { ReleaseTokenConfirmationClaim } from '../release-kernel/object-model.js';
import {
  createReleasePresentation,
  type ReleasePresentationProof,
} from './object-model.js';
import {
  ASYNC_CONSEQUENCE_ENVELOPE_ALGORITHM,
  ASYNC_CONSEQUENCE_ENVELOPE_PAYLOAD_TYPE,
  ASYNC_CONSEQUENCE_ENVELOPE_PREDICATE_TYPE,
  ASYNC_CONSEQUENCE_ENVELOPE_SPEC_VERSION,
  CLOUDEVENTS_SPEC_VERSION,
  DEFAULT_ASYNC_ENVELOPE_MAX_AGE_SECONDS,
  IN_TOTO_STATEMENT_V1_TYPE,
  type AsyncConsequenceCloudEvent,
  type AsyncConsequenceEnvelopeStatement,
  type AsyncConsequenceEnvelopeTarget,
  type AsyncConsequencePayloadDescriptor,
  type AsyncConsequencePayloadInput,
  type CreateSignedAsyncConsequenceEnvelopeInput,
  type SignedAsyncConsequenceEnvelope,
} from './async-envelope-types.js';
import { canonicalJson } from './async-envelope-canonical.js';
import {
  asyncReleaseTokenDigest,
  publicJwkThumbprint,
  sha256Digest,
  signEd25519,
} from './async-envelope-crypto.js';
import { digestHex } from './async-envelope-digest.js';
import {
  dsseEnvelopeDigest,
  dssePreAuthenticationEncoding,
  replayKeyForEnvelope,
  signatureRef,
} from './async-envelope-dsse.js';
import {
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizeOptionalIdentifier,
  normalizeScope,
  policyContextFromClaims,
} from './async-envelope-normalize.js';

function contentBytes(content: AsyncConsequencePayloadInput['content']): Buffer | null {
  if (content === undefined || content === null) {
    return null;
  }

  if (typeof content === 'string') {
    return Buffer.from(content, 'utf8');
  }

  if (Buffer.isBuffer(content) || content instanceof Uint8Array) {
    return Buffer.from(content);
  }

  return Buffer.from(canonicalJson(content), 'utf8');
}

function payloadDescriptor(input: AsyncConsequencePayloadInput): AsyncConsequencePayloadDescriptor {
  const bytes = contentBytes(input.content);
  const digest =
    input.digest !== undefined
      ? normalizeIdentifier(input.digest, 'payload.digest')
      : bytes === null
        ? null
        : sha256Digest(bytes);
  if (digest === null) {
    throw new Error('Async consequence envelope payload requires either content or digest.');
  }

  if (!digest.startsWith('sha256:')) {
    throw new Error('Async consequence envelope payload digest must use sha256:<hex> form.');
  }

  return Object.freeze({
    name: normalizeIdentifier(input.name, 'payload.name'),
    mediaType: normalizeIdentifier(input.mediaType ?? 'application/octet-stream', 'payload.mediaType'),
    digest,
    sizeBytes: bytes === null ? input.sizeBytes ?? null : bytes.byteLength,
  });
}

function releasePresentationProof(input: {
  readonly envelopeDigest: string;
  readonly subjectDigest: string;
  readonly signatureRef: string;
}): ReleasePresentationProof {
  return Object.freeze({
    kind: 'signed-json-envelope',
    envelopeDigest: input.envelopeDigest,
    subjectDigest: input.subjectDigest,
    signatureRef: input.signatureRef,
  });
}

function normalizeCloudEventSource(input: {
  readonly source?: string;
  readonly producer: string;
}): string {
  return normalizeIdentifier(
    input.source ?? `urn:attestor:release-enforcement:${input.producer}`,
    'cloudEvent.source',
  );
}

function normalizeCloudEventType(value: string | undefined): string {
  return normalizeIdentifier(
    value ?? 'dev.attestor.release-enforcement.async-consequence.v1',
    'cloudEvent.type',
  );
}

function createCloudEvent(input: {
  readonly envelopeId: string;
  readonly messageId: string | null;
  readonly source?: string;
  readonly type?: string;
  readonly subject?: string;
  readonly targetId: string;
  readonly createdAt: string;
  readonly producer: string;
}): AsyncConsequenceCloudEvent {
  return Object.freeze({
    specversion: CLOUDEVENTS_SPEC_VERSION,
    id: input.messageId ?? input.envelopeId,
    source: normalizeCloudEventSource({
      source: input.source,
      producer: input.producer,
    }),
    type: normalizeCloudEventType(input.type),
    subject: normalizeIdentifier(input.subject ?? input.targetId, 'cloudEvent.subject'),
    time: input.createdAt,
    datacontenttype: ASYNC_CONSEQUENCE_ENVELOPE_PAYLOAD_TYPE,
    dataschema: ASYNC_CONSEQUENCE_ENVELOPE_PREDICATE_TYPE,
  });
}

function statementPayloadBytes(statement: AsyncConsequenceEnvelopeStatement): Buffer {
  return Buffer.from(canonicalJson(statement), 'utf8');
}

function buildStatement(input: {
  readonly envelopeId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly idempotencyKey: string;
  readonly producer: string;
  readonly target: AsyncConsequenceEnvelopeTarget;
  readonly issuedToken: IssuedReleaseToken;
  readonly payload: AsyncConsequencePayloadDescriptor;
  readonly messageId: string | null;
  readonly queueOrTopic: string | null;
  readonly cloudEvent: AsyncConsequenceCloudEvent;
  readonly keyId: string;
  readonly publicKeyThumbprint: string;
}): AsyncConsequenceEnvelopeStatement {
  const subjectHex = digestHex(input.payload.digest, 'payload.digest');
  return Object.freeze({
    _type: IN_TOTO_STATEMENT_V1_TYPE,
    subject: Object.freeze([
      Object.freeze({
        name: input.payload.name,
        digest: Object.freeze({
          sha256: subjectHex,
        }),
      }),
    ]),
    predicateType: ASYNC_CONSEQUENCE_ENVELOPE_PREDICATE_TYPE,
    predicate: Object.freeze({
      version: ASYNC_CONSEQUENCE_ENVELOPE_SPEC_VERSION,
      envelopeId: input.envelopeId,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      idempotencyKey: input.idempotencyKey,
      producer: input.producer,
      target: input.target,
      release: Object.freeze({
        tokenId: input.issuedToken.tokenId,
        tokenDigest: asyncReleaseTokenDigest(input.issuedToken.token),
        decisionId: input.issuedToken.claims.decision_id,
        issuer: input.issuedToken.claims.iss,
        subject: input.issuedToken.claims.sub,
        audience: input.issuedToken.claims.aud,
        expiresAt: input.issuedToken.expiresAt,
        scope: normalizeScope(input.issuedToken.claims.scope?.split(/\s+/)),
      }),
      consequence: Object.freeze({
        consequenceType: input.issuedToken.claims.consequence_type,
        riskClass: input.issuedToken.claims.risk_class,
        outputHash: input.issuedToken.claims.output_hash,
        consequenceHash: input.issuedToken.claims.consequence_hash,
        policyHash: input.issuedToken.claims.policy_hash,
        policyVersion: input.issuedToken.claims.policy_version ?? null,
        policyIrHash: input.issuedToken.claims.policy_ir_hash ?? null,
        policyProvenanceSource: input.issuedToken.claims.policy_provenance_source ?? null,
        compiledPolicyIndexVersion: input.issuedToken.claims.compiled_policy_index_version ?? null,
        compiledPolicyIrVersion: input.issuedToken.claims.compiled_policy_ir_version ?? null,
        policyContext: policyContextFromClaims(input.issuedToken.claims),
      }),
      payload: input.payload,
      transport: Object.freeze({
        messageId: input.messageId,
        queueOrTopic: input.queueOrTopic,
      }),
      cloudEvent: input.cloudEvent,
      signer: Object.freeze({
        algorithm: ASYNC_CONSEQUENCE_ENVELOPE_ALGORITHM,
        keyId: input.keyId,
        publicKeyThumbprint: input.publicKeyThumbprint,
      }),
    }),
  });
}

export function createAsyncEnvelopeReleaseTokenConfirmation(input: {
  readonly publicKeyThumbprint: string;
}): ReleaseTokenConfirmationClaim {
  return Object.freeze({
    jkt: normalizeIdentifier(input.publicKeyThumbprint, 'publicKeyThumbprint'),
  });
}

export async function createSignedAsyncConsequenceEnvelope(
  input: CreateSignedAsyncConsequenceEnvelopeInput,
): Promise<SignedAsyncConsequenceEnvelope> {
  const createdAt = normalizeIsoTimestamp(input.createdAt ?? new Date().toISOString(), 'createdAt');
  const expiresAt = normalizeIsoTimestamp(
    input.expiresAt ??
      new Date(
        new Date(createdAt).getTime() + DEFAULT_ASYNC_ENVELOPE_MAX_AGE_SECONDS * 1000,
      ).toISOString(),
    'expiresAt',
  );
  const envelopeId = normalizeIdentifier(input.envelopeId, 'envelopeId');
  const idempotencyKey = normalizeIdentifier(input.idempotencyKey, 'idempotencyKey');
  const producer = normalizeIdentifier(input.producer ?? 'attestor.release-enforcement', 'producer');
  const target = Object.freeze({
    kind: input.target.kind,
    id: normalizeIdentifier(input.target.id, 'target.id'),
  });
  const messageId = normalizeOptionalIdentifier(input.messageId, 'messageId');
  const queueOrTopic = normalizeOptionalIdentifier(input.queueOrTopic, 'queueOrTopic');
  const publicKeyThumbprintValue = await publicJwkThumbprint(input.publicJwk);
  const keyId = input.keyId ?? publicKeyThumbprintValue;
  const payload = payloadDescriptor(input.payload);
  const cloudEvent = createCloudEvent({
    envelopeId,
    messageId,
    source: input.cloudEventSource,
    type: input.cloudEventType,
    subject: input.cloudEventSubject,
    targetId: target.id,
    createdAt,
    producer,
  });
  const statement = buildStatement({
    envelopeId,
    createdAt,
    expiresAt,
    idempotencyKey,
    producer,
    target,
    issuedToken: input.issuedToken,
    payload,
    messageId,
    queueOrTopic,
    cloudEvent,
    keyId,
    publicKeyThumbprint: publicKeyThumbprintValue,
  });
  const statementBytes = statementPayloadBytes(statement);
  const signatureBytes = signEd25519({
    privateJwk: input.privateJwk,
    bytes: dssePreAuthenticationEncoding(
      ASYNC_CONSEQUENCE_ENVELOPE_PAYLOAD_TYPE,
      statementBytes,
    ),
  });
  const signature = signatureBytes.toString('base64');
  const envelope = Object.freeze({
    payloadType: ASYNC_CONSEQUENCE_ENVELOPE_PAYLOAD_TYPE,
    payload: statementBytes.toString('base64'),
    signatures: Object.freeze([
      Object.freeze({
        keyid: keyId,
        sig: signature,
      }),
    ]),
  });
  const envelopeDigest = dsseEnvelopeDigest(envelope);
  const subjectDigest = payload.digest;
  const statementDigest = sha256Digest(statementBytes);
  const signatureRefValue = signatureRef({ keyId, signature });
  const releaseTokenDigest = asyncReleaseTokenDigest(input.issuedToken.token);
  const presentation = createReleasePresentation({
    mode: 'signed-json-envelope',
    presentedAt: input.presentedAt ?? createdAt,
    releaseToken: input.issuedToken.token,
    releaseTokenId: input.issuedToken.tokenId,
    releaseTokenDigest,
    issuer: input.issuedToken.claims.iss,
    subject: input.issuedToken.claims.sub,
    audience: input.issuedToken.claims.aud,
    expiresAt: input.issuedToken.expiresAt,
    scope: input.scope ?? input.issuedToken.claims.scope?.split(/\s+/) ?? [],
    proof: releasePresentationProof({
      envelopeDigest,
      subjectDigest,
      signatureRef: signatureRefValue,
    }),
  });

  return Object.freeze({
    version: ASYNC_CONSEQUENCE_ENVELOPE_SPEC_VERSION,
    algorithm: ASYNC_CONSEQUENCE_ENVELOPE_ALGORITHM,
    envelope,
    statement,
    createdAt,
    expiresAt,
    idempotencyKey,
    releaseTokenDigest,
    subjectDigest,
    statementDigest,
    envelopeDigest,
    signatureRef: signatureRefValue,
    keyId,
    publicKeyThumbprint: publicKeyThumbprintValue,
    cloudEvent,
    target,
    replayKey: replayKeyForEnvelope(envelopeDigest),
    presentation,
  });
}
