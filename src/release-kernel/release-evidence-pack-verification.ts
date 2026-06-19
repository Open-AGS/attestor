import { createPublicKey, verify } from 'node:crypto';
import {
  RELEASE_EVIDENCE_PACK_PREDICATE_TYPE,
  RELEASE_EVIDENCE_PACK_STATEMENT_TYPE,
  RELEASE_EVIDENCE_PACK_VERIFICATION_SPEC_VERSION,
  type ReleaseEvidencePackVerificationResult,
  type ReleaseEvidenceStatement,
  type ReleaseEvidenceStatementSubject,
  type VerifyReleaseEvidencePackInput,
} from './release-evidence-pack-types.js';
import { canonicalEqual, stripSha256Prefix } from './release-evidence-pack-digest.js';
import { buildBundleDigest, dssePreAuthEncoding } from './release-evidence-pack-dsse.js';
import {
  assertNullableStringField,
  assertPolicyContextMatchesFields,
  assertReleaseEvidencePolicyContextShape,
  assertSameNullableString,
  buildEvidencePackPolicyContext,
} from './release-evidence-pack-policy-context.js';
import { summarizeArtifactVerification } from './release-evidence-pack-summary.js';

function assertSubjectDigestMatches(
  subject: ReleaseEvidenceStatementSubject | undefined,
  expectedName: string,
  expectedDigest: string,
): void {
  if (!subject || subject.name !== expectedName || subject.digest.sha256 !== stripSha256Prefix(expectedDigest)) {
    throw new Error('Release evidence pack statement subject does not match its signed release material.');
  }
}

function assertPredicateInternalConsistency(statement: ReleaseEvidenceStatement): void {
  const { evidencePack, decision, releaseToken } = statement.predicate;
  assertNullableStringField(evidencePack.policyIrHash, 'evidencePack.policyIrHash');
  assertNullableStringField(
    evidencePack.policyProvenanceSource,
    'evidencePack.policyProvenanceSource',
  );
  assertNullableStringField(
    evidencePack.compiledPolicyIndexVersion,
    'evidencePack.compiledPolicyIndexVersion',
  );
  assertNullableStringField(
    evidencePack.compiledPolicyIrVersion,
    'evidencePack.compiledPolicyIrVersion',
  );
  assertNullableStringField(decision.policyIrHash, 'decision.policyIrHash');
  assertNullableStringField(
    decision.policyProvenanceSource,
    'decision.policyProvenanceSource',
  );
  assertNullableStringField(
    decision.compiledPolicyIndexVersion,
    'decision.compiledPolicyIndexVersion',
  );
  assertNullableStringField(decision.compiledPolicyIrVersion, 'decision.compiledPolicyIrVersion');
  if (evidencePack.policyContext !== undefined) {
    assertReleaseEvidencePolicyContextShape(
      evidencePack.policyContext,
      'evidencePack.policyContext',
      'required',
    );
  }
  if (decision.policyContext !== undefined) {
    assertReleaseEvidencePolicyContextShape(
      decision.policyContext,
      'decision.policyContext',
      'required',
    );
  }
  const evidencePackPolicyContext =
    evidencePack.policyContext ?? buildEvidencePackPolicyContext(evidencePack);
  const decisionPolicyContext =
    decision.policyContext ??
    buildEvidencePackPolicyContext({
      policyVersion: decision.policyVersion,
      policyHash: decision.policyHash,
      policyIrHash: decision.policyIrHash,
      policyProvenanceSource: decision.policyProvenanceSource,
      compiledPolicyIndexVersion: decision.compiledPolicyIndexVersion,
      compiledPolicyIrVersion: decision.compiledPolicyIrVersion,
    });
  assertPolicyContextMatchesFields(
    evidencePackPolicyContext,
    buildEvidencePackPolicyContext(evidencePack),
    'Release evidence pack policy context',
  );
  assertPolicyContextMatchesFields(
    decisionPolicyContext,
    {
      policyVersion: decision.policyVersion,
      policyHash: decision.policyHash,
      policyIrHash: decision.policyIrHash,
      policyProvenanceSource: decision.policyProvenanceSource,
      compiledPolicyIndexVersion: decision.compiledPolicyIndexVersion,
      compiledPolicyIrVersion: decision.compiledPolicyIrVersion,
    },
    'Release evidence pack decision policy context',
  );
  if (releaseToken) {
    assertNullableStringField(releaseToken.policyVersion, 'releaseToken.policyVersion');
    assertNullableStringField(releaseToken.policyIrHash, 'releaseToken.policyIrHash');
    assertNullableStringField(
      releaseToken.policyProvenanceSource,
      'releaseToken.policyProvenanceSource',
    );
    assertNullableStringField(
      releaseToken.compiledPolicyIndexVersion,
      'releaseToken.compiledPolicyIndexVersion',
    );
    assertNullableStringField(
      releaseToken.compiledPolicyIrVersion,
      'releaseToken.compiledPolicyIrVersion',
    );
    if (releaseToken.policyContext !== undefined) {
      assertReleaseEvidencePolicyContextShape(
        releaseToken.policyContext,
        'releaseToken.policyContext',
        'nullable',
      );
    }
    assertPolicyContextMatchesFields(
      releaseToken.policyContext ?? {
        policyVersion: releaseToken.policyVersion,
        policyHash: releaseToken.policyHash,
        policyIrHash: releaseToken.policyIrHash,
        policyProvenanceSource: releaseToken.policyProvenanceSource,
        compiledPolicyIndexVersion: releaseToken.compiledPolicyIndexVersion,
        compiledPolicyIrVersion: releaseToken.compiledPolicyIrVersion,
      },
      {
        policyVersion: releaseToken.policyVersion,
        policyHash: releaseToken.policyHash,
        policyIrHash: releaseToken.policyIrHash,
        policyProvenanceSource: releaseToken.policyProvenanceSource,
        compiledPolicyIndexVersion: releaseToken.compiledPolicyIndexVersion,
        compiledPolicyIrVersion: releaseToken.compiledPolicyIrVersion,
      },
      'Release evidence pack token policy context',
    );
  }

  if (decision.evidencePackId !== evidencePack.id) {
    throw new Error('Release evidence pack decision summary does not match the evidence pack id.');
  }
  if (decision.policyVersion !== evidencePack.policyVersion) {
    throw new Error('Release evidence pack decision summary policy version does not match the evidence pack.');
  }
  if (decision.policyHash !== evidencePack.policyHash) {
    throw new Error('Release evidence pack decision summary policy hash does not match the evidence pack.');
  }
  assertSameNullableString(
    decision.policyIrHash,
    evidencePack.policyIrHash,
    'Release evidence pack decision summary policy IR hash does not match the evidence pack.',
  );
  if (decision.policyProvenanceSource !== evidencePack.policyProvenanceSource) {
    throw new Error('Release evidence pack decision summary policy provenance source does not match the evidence pack.');
  }
  assertSameNullableString(
    decision.compiledPolicyIndexVersion,
    evidencePack.compiledPolicyIndexVersion,
    'Release evidence pack decision summary compiled policy index version does not match the evidence pack.',
  );
  assertSameNullableString(
    decision.compiledPolicyIrVersion,
    evidencePack.compiledPolicyIrVersion,
    'Release evidence pack decision summary compiled policy IR version does not match the evidence pack.',
  );

  if (releaseToken) {
    assertSameNullableString(
      releaseToken.policyVersion,
      evidencePack.policyVersion,
      'Release evidence pack token summary policy version does not match the evidence pack.',
    );
    if (releaseToken.policyHash !== evidencePack.policyHash) {
      throw new Error('Release evidence pack token summary policy hash does not match the evidence pack.');
    }
    assertSameNullableString(
      releaseToken.policyIrHash,
      evidencePack.policyIrHash,
      'Release evidence pack token summary policy IR hash does not match the evidence pack.',
    );
    if (releaseToken.policyProvenanceSource !== evidencePack.policyProvenanceSource) {
      throw new Error('Release evidence pack token summary policy provenance source does not match the evidence pack.');
    }
    assertSameNullableString(
      releaseToken.compiledPolicyIndexVersion,
      evidencePack.compiledPolicyIndexVersion,
      'Release evidence pack token summary compiled policy index version does not match the evidence pack.',
    );
    assertSameNullableString(
      releaseToken.compiledPolicyIrVersion,
      evidencePack.compiledPolicyIrVersion,
      'Release evidence pack token summary compiled policy IR version does not match the evidence pack.',
    );
  }

  assertSubjectDigestMatches(
    statement.subject[0],
    `release-output/${decision.id}`,
    evidencePack.outputHash,
  );
  assertSubjectDigestMatches(
    statement.subject[1],
    `release-consequence/${decision.targetId}`,
    evidencePack.consequenceHash,
  );
}

export function verifyIssuedReleaseEvidencePack(
  input: VerifyReleaseEvidencePackInput,
): ReleaseEvidencePackVerificationResult {
  const pack = input.issuedEvidencePack;
  if (!input.verificationKey) {
    throw new Error(
      'Release evidence pack verification requires an explicit trusted verification key.',
    );
  }
  const verificationKey = input.verificationKey;
  const payload = Buffer.from(pack.envelope.payload, 'base64');
  const pae = dssePreAuthEncoding(pack.envelope.payloadType, payload);
  const signature = pack.envelope.signatures[0];
  if (!signature) {
    throw new Error('Release evidence pack is missing DSSE signatures.');
  }

  const valid = verify(
    null,
    pae,
    createPublicKey(verificationKey.publicKeyPem),
    Buffer.from(signature.sig, 'base64'),
  );
  if (!valid) {
    throw new Error('Release evidence pack DSSE signature is invalid.');
  }

  const statement = JSON.parse(payload.toString('utf-8')) as ReleaseEvidenceStatement;
  if (
    statement._type !== RELEASE_EVIDENCE_PACK_STATEMENT_TYPE ||
    statement.predicateType !== RELEASE_EVIDENCE_PACK_PREDICATE_TYPE
  ) {
    throw new Error('Release evidence pack statement type is not recognized.');
  }

  if (!canonicalEqual(statement, pack.statement)) {
    throw new Error('Release evidence pack signed payload does not match the exported statement.');
  }

  if (!canonicalEqual(statement.predicate.evidencePack, pack.evidencePack)) {
    throw new Error('Release evidence pack signed payload does not match the exported evidence pack.');
  }

  if (statement.predicate.evidencePack.id !== pack.evidencePack.id) {
    throw new Error('Release evidence pack payload does not match the exported pack id.');
  }

  if (statement.subject.length < 2) {
    throw new Error('Release evidence pack statement subjects are incomplete.');
  }
  assertPredicateInternalConsistency(statement);

  const expectedBundleDigest = buildBundleDigest({
    evidencePack: pack.evidencePack,
    statement: pack.statement,
    envelope: pack.envelope,
    verificationKey: pack.verificationKey,
    issuedAt: pack.issuedAt,
    keyId: pack.keyId,
    publicKeyFingerprint: pack.publicKeyFingerprint,
  });
  if (expectedBundleDigest !== pack.bundleDigest) {
    throw new Error('Release evidence pack bundle digest does not match its contents.');
  }

  return {
    version: RELEASE_EVIDENCE_PACK_VERIFICATION_SPEC_VERSION,
    valid: true,
    evidencePackId: pack.evidencePack.id,
    decisionId: statement.predicate.decision.id,
    decisionStatus: statement.predicate.decision.status,
    consequenceType: statement.predicate.decision.consequenceType,
    riskClass: statement.predicate.decision.riskClass,
    outputHash: pack.evidencePack.outputHash,
    consequenceHash: pack.evidencePack.consequenceHash,
    policyVersion: pack.evidencePack.policyVersion,
    policyHash: pack.evidencePack.policyHash,
    policyIrHash: pack.evidencePack.policyIrHash,
    policyProvenanceSource: pack.evidencePack.policyProvenanceSource,
    compiledPolicyIndexVersion: pack.evidencePack.compiledPolicyIndexVersion,
    compiledPolicyIrVersion: pack.evidencePack.compiledPolicyIrVersion,
    policyContext:
      pack.evidencePack.policyContext ?? buildEvidencePackPolicyContext(pack.evidencePack),
    releaseTokenId: statement.predicate.releaseToken?.tokenId ?? null,
    reviewId: statement.predicate.review?.reviewId ?? null,
    keyId: signature.keyid,
    predicateType: statement.predicateType,
    subjectCount: statement.subject.length,
    bundleDigest: pack.bundleDigest,
    artifactVerificationSummary: summarizeArtifactVerification(pack.evidencePack.artifacts),
  };
}
