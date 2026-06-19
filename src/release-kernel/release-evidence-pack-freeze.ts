import type { EvidencePack } from './object-model.js';
import type {
  IssuedReleaseEvidencePack,
  ReleaseEvidenceDecisionLogSummary,
  ReleaseEvidenceDecisionSummary,
  ReleaseEvidenceReviewSummary,
  ReleaseEvidenceStatement,
  ReleaseEvidenceTokenSummary,
} from './release-evidence-pack-types.js';
import {
  buildEvidencePackPolicyContext,
  freezeReleaseEvidencePolicyContext,
  freezeReleaseEvidenceTokenPolicyContext,
} from './release-evidence-pack-policy-context.js';

export function freezeEvidencePack(pack: EvidencePack): EvidencePack {
  return Object.freeze({
    ...pack,
    policyContext: freezeReleaseEvidencePolicyContext(
      pack.policyContext ?? buildEvidencePackPolicyContext(pack),
    ),
    findings: Object.freeze(pack.findings.map((finding) => Object.freeze({ ...finding }))),
    artifacts: Object.freeze(pack.artifacts.map((artifact) => Object.freeze({ ...artifact }))),
  });
}

export function freezeReleaseEvidenceDecisionSummary(
  summary: ReleaseEvidenceDecisionSummary,
): ReleaseEvidenceDecisionSummary {
  return Object.freeze({
    ...summary,
    policyContext: freezeReleaseEvidencePolicyContext(
      summary.policyContext ??
        buildEvidencePackPolicyContext({
          policyVersion: summary.policyVersion,
          policyHash: summary.policyHash,
          policyIrHash: summary.policyIrHash,
          policyProvenanceSource: summary.policyProvenanceSource,
          compiledPolicyIndexVersion: summary.compiledPolicyIndexVersion,
          compiledPolicyIrVersion: summary.compiledPolicyIrVersion,
        }),
    ),
    override: summary.override
      ? Object.freeze({ ...summary.override })
      : null,
  });
}

export function freezeReleaseEvidenceDecisionLogSummary(
  summary: ReleaseEvidenceDecisionLogSummary,
): ReleaseEvidenceDecisionLogSummary {
  return Object.freeze({
    ...summary,
    phases: Object.freeze([...summary.phases]),
  });
}

export function freezeReleaseEvidenceReviewSummary(
  summary: ReleaseEvidenceReviewSummary | null,
): ReleaseEvidenceReviewSummary | null {
  return summary ? Object.freeze({ ...summary }) : null;
}

export function freezeReleaseEvidenceTokenSummary(
  summary: ReleaseEvidenceTokenSummary | null,
): ReleaseEvidenceTokenSummary | null {
  return summary
    ? Object.freeze({
        ...summary,
        policyContext: freezeReleaseEvidenceTokenPolicyContext(
          summary.policyContext ?? {
            policyVersion: summary.policyVersion,
            policyHash: summary.policyHash,
            policyIrHash: summary.policyIrHash,
            policyProvenanceSource: summary.policyProvenanceSource,
            compiledPolicyIndexVersion: summary.compiledPolicyIndexVersion,
            compiledPolicyIrVersion: summary.compiledPolicyIrVersion,
          },
        ),
      })
    : null;
}

export function freezeReleaseEvidenceStatement(
  statement: ReleaseEvidenceStatement,
): ReleaseEvidenceStatement {
  return Object.freeze({
    ...statement,
    subject: Object.freeze(
      statement.subject.map((subject) =>
        Object.freeze({
          ...subject,
          digest: Object.freeze({ ...subject.digest }),
        }),
      ),
    ),
    predicate: Object.freeze({
      ...statement.predicate,
      evidencePack: freezeEvidencePack(statement.predicate.evidencePack),
      decision: freezeReleaseEvidenceDecisionSummary(statement.predicate.decision),
      decisionLog: freezeReleaseEvidenceDecisionLogSummary(statement.predicate.decisionLog),
      review: freezeReleaseEvidenceReviewSummary(statement.predicate.review),
      releaseToken: freezeReleaseEvidenceTokenSummary(statement.predicate.releaseToken),
    }),
  });
}

export function freezeIssuedReleaseEvidencePack(
  pack: IssuedReleaseEvidencePack,
): IssuedReleaseEvidencePack {
  return Object.freeze({
    ...pack,
    evidencePack: freezeEvidencePack(pack.evidencePack),
    statement: freezeReleaseEvidenceStatement(pack.statement),
    envelope: Object.freeze({
      ...pack.envelope,
      signatures: Object.freeze(pack.envelope.signatures.map((entry) => Object.freeze({ ...entry }))),
    }),
    verificationKey: Object.freeze({ ...pack.verificationKey }),
  });
}
