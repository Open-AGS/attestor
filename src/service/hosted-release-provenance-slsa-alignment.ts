export const HOSTED_RELEASE_PROVENANCE_SLSA_ALIGNMENT_VERSION =
  'attestor.hosted-release-provenance-slsa-alignment.v1';

export type HostedReleaseProvenanceSlsaSurface =
  | 'release_workflow_identity'
  | 'artifact_subject_and_digest'
  | 'sbom_dependency_evidence'
  | 'package_surface_gate'
  | 'proof_release_packet_binding'
  | 'promotion_non_claim_boundary';

export type HostedReleaseProvenanceSlsaRisk =
  | 'workflow_identity_ambiguous'
  | 'elevated_attestation_permission_bleed'
  | 'unsigned_or_untraceable_archive'
  | 'artifact_digest_not_verified'
  | 'sbom_missing_or_stale'
  | 'dependency_or_action_drift'
  | 'package_surface_drift'
  | 'proof_packet_not_digest_bound'
  | 'tamper_history_gap'
  | 'secret_leak_in_release_evidence'
  | 'slsa_or_production_overclaim';

export type HostedReleaseProvenanceSlsaControl =
  | 'dedicated_release_workflow_only'
  | 'reviewer_workflows_read_only'
  | 'attestation_permissions_scoped'
  | 'oidc_permission_scoped'
  | 'sha_pinned_actions'
  | 'tagged_evaluation_trigger'
  | 'artifact_archive_single_subject'
  | 'artifact_subject_path_attested'
  | 'slsa_build_provenance_predicate'
  | 'github_attestation_verify_command'
  | 'github_signer_workflow_pin'
  | 'cyclonedx_sbom_generated'
  | 'cyclonedx_sbom_attested'
  | 'sbom_packaged_with_artifacts'
  | 'supply_chain_baseline_gate'
  | 'npm_audit_high_gate'
  | 'package_surface_probe_gate'
  | 'build_before_package_probes'
  | 'private_package_boundary'
  | 'canonical_release_json'
  | 'release_evidence_dsse_statement'
  | 'release_evidence_subject_digest'
  | 'tamper_evident_history_chain'
  | 'privacy_minimized_evidence'
  | 'no_live_secret_output'
  | 'no_full_production_claim'
  | 'deployment_provenance_separate';

export interface HostedReleaseProvenanceSlsaGuard {
  readonly id: string;
  readonly title: string;
  readonly surface: HostedReleaseProvenanceSlsaSurface;
  readonly releaseRisks: readonly HostedReleaseProvenanceSlsaRisk[];
  readonly requiredControls: readonly HostedReleaseProvenanceSlsaControl[];
  readonly artifactBoundary: string;
  readonly provenanceBoundary: string;
  readonly verificationBoundary: string;
  readonly nonClaimBoundary: string;
  readonly implementationEvidence: readonly string[];
  readonly validation: readonly string[];
  readonly standards: readonly string[];
}

export const HOSTED_RELEASE_PROVENANCE_SLSA_GUARDS: readonly HostedReleaseProvenanceSlsaGuard[] = [
  {
    id: 'workflow.identity-permission-boundary',
    title: 'Release workflow identity and elevated permission boundary',
    surface: 'release_workflow_identity',
    releaseRisks: [
      'workflow_identity_ambiguous',
      'elevated_attestation_permission_bleed',
      'dependency_or_action_drift',
    ],
    requiredControls: [
      'dedicated_release_workflow_only',
      'reviewer_workflows_read_only',
      'attestation_permissions_scoped',
      'oidc_permission_scoped',
      'sha_pinned_actions',
      'tagged_evaluation_trigger',
      'supply_chain_baseline_gate',
    ],
    artifactBoundary:
      'Only the dedicated release-provenance workflow may mint artifact attestations; push, PR, scheduled verify, and security scan workflows remain read-only reviewer evidence paths.',
    provenanceBoundary:
      'The attestation signer identity is the pinned release-provenance workflow running on an evaluation tag or explicit manual dispatch ref, not an arbitrary branch workflow.',
    verificationBoundary:
      'Reviewers verify the produced artifact against the repository and signer workflow before relying on the archive as release evidence.',
    nonClaimBoundary:
      'Scoped attestation permissions are an alignment control; they do not by themselves certify every runtime, operator environment, or downstream deployment.',
    implementationEvidence: [
      '.github/workflows/release-provenance.yml',
      '.github/workflows/evaluation-smoke.yml',
      '.github/workflows/full-verify.yml',
      '.github/workflows/security-scan.yml',
      'scripts/check-supply-chain-baseline.mjs',
    ],
    validation: [
      'tests/security-baseline-docs.test.ts',
      'tests/hosted-release-provenance-slsa-alignment.test.ts',
    ],
    standards: [
      'SLSA v1.2 Build Track: provenance depends on trusted build identity, source identity, and verifiable subjects.',
      'GitHub artifact attestations: build provenance requires id-token and attestations permissions scoped to the attesting workflow.',
      'NIST SSDF SP 800-218: release integrity controls should be defined, verified, and protected from unauthorized modification.',
    ],
  },
  {
    id: 'artifact.subject-digest-verification',
    title: 'Release artifact subject, digest, and verifier command',
    surface: 'artifact_subject_and_digest',
    releaseRisks: [
      'unsigned_or_untraceable_archive',
      'artifact_digest_not_verified',
      'slsa_or_production_overclaim',
    ],
    requiredControls: [
      'artifact_archive_single_subject',
      'artifact_subject_path_attested',
      'slsa_build_provenance_predicate',
      'github_attestation_verify_command',
      'github_signer_workflow_pin',
      'no_full_production_claim',
    ],
    artifactBoundary:
      'The attested subject is the narrow evaluation archive `.attestor/release-provenance/evaluation-artifacts.tar.gz`, not the whole repository, runtime, cloud account, or customer deployment.',
    provenanceBoundary:
      'The archive is produced after rendering proof surface, proof showcase, SBOM, evaluation docs, and security material in the release workflow.',
    verificationBoundary:
      'The documented reviewer command uses `gh attestation verify evaluation-artifacts.tar.gz -R 0xlamarr-labs/attestor --signer-workflow 0xlamarr-labs/attestor/.github/workflows/release-provenance.yml`.',
    nonClaimBoundary:
      'A verified archive proves provenance for the selected evaluation release artifacts; it does not prove customer-operated deployment provenance or live production readiness.',
    implementationEvidence: [
      '.github/workflows/release-provenance.yml',
      'docs/08-deployment/artifact-attestation-plan.md',
      '.github/workflows/production-rehearsal.yml',
    ],
    validation: [
      'tests/security-baseline-docs.test.ts',
      'tests/production-rehearsal-workflow.test.ts',
      'tests/hosted-release-provenance-slsa-alignment.test.ts',
    ],
    standards: [
      'SLSA v1.2 Build Provenance: subject digests and build definition are the verifier-facing unit.',
      'GitHub artifact attestations: `gh attestation verify` is the reviewer-side provenance verification path.',
      'in-toto Statement v1: subjects are named artifacts bound to cryptographic digests.',
    ],
  },
  {
    id: 'sbom.dependency-evidence',
    title: 'SBOM and dependency evidence bound into the release packet',
    surface: 'sbom_dependency_evidence',
    releaseRisks: [
      'sbom_missing_or_stale',
      'dependency_or_action_drift',
      'secret_leak_in_release_evidence',
    ],
    requiredControls: [
      'cyclonedx_sbom_generated',
      'cyclonedx_sbom_attested',
      'sbom_packaged_with_artifacts',
      'supply_chain_baseline_gate',
      'npm_audit_high_gate',
      'sha_pinned_actions',
      'no_live_secret_output',
    ],
    artifactBoundary:
      'The release workflow generates a CycloneDX SBOM from the lockfile and packages it with the evaluation archive so dependency evidence travels with the artifact.',
    provenanceBoundary:
      'Dependency evidence is only trusted when the lockfile baseline, registry integrity metadata, install-script allowlist, pinned GitHub Actions, and high/critical audit gate remain green.',
    verificationBoundary:
      'Reviewers can inspect the bundled `sbom.cyclonedx.json` after verifying the archive attestation and can cross-check dependency posture through the security scan and supply-chain baseline.',
    nonClaimBoundary:
      'The SBOM is package-lock based release evidence; it does not claim runtime container inventory, cloud dependency inventory, or customer environment bill-of-materials coverage.',
    implementationEvidence: [
      'package.json',
      'package-lock.json',
      '.github/workflows/release-provenance.yml',
      '.github/workflows/security-scan.yml',
      'scripts/check-supply-chain-baseline.mjs',
      'SECURITY.md',
    ],
    validation: [
      'tests/security-baseline-docs.test.ts',
      'tests/package-script-runner.test.ts',
      'tests/hosted-release-provenance-slsa-alignment.test.ts',
    ],
    standards: [
      'SLSA v1.2 Build Provenance: dependencies and resolved materials should be inspectable by verifiers.',
      'CycloneDX SBOM: dependency inventory is a machine-readable artifact, not prose.',
      'NIST SSDF RV.1/RV.2: vulnerability and dependency posture should be analyzed before release.',
    ],
  },
  {
    id: 'package.surface-gate',
    title: 'Package surface probes and build ordering',
    surface: 'package_surface_gate',
    releaseRisks: [
      'package_surface_drift',
      'dependency_or_action_drift',
      'slsa_or_production_overclaim',
    ],
    requiredControls: [
      'package_surface_probe_gate',
      'build_before_package_probes',
      'private_package_boundary',
      'no_full_production_claim',
    ],
    artifactBoundary:
      'Package probes validate exported Attestor surfaces after build so the release archive and proof packet point at the same intended public package shape.',
    provenanceBoundary:
      'The verify runner orders typecheck, fast tests, service tests, build, and package-surface probes so export drift cannot hide behind stale dist output.',
    verificationBoundary:
      'The package-script runner test keeps the package-surface probes in the verify suite and keeps live/ops gates separate from deterministic repo verification.',
    nonClaimBoundary:
      'Package-surface validation proves repo export contracts, not public npm publication readiness or external deployment availability.',
    implementationEvidence: [
      'package.json',
      'scripts/run-suite.mjs',
      'scripts/probe-release-layer-package-surface.mjs',
      'scripts/probe-release-policy-control-plane-package-surface.mjs',
      'scripts/probe-release-enforcement-plane-package-surface.mjs',
      'scripts/probe-crypto-authorization-core-package-surface.mjs',
      'scripts/probe-crypto-intelligence-package-surface.mjs',
      'scripts/probe-crypto-execution-admission-package-surface.mjs',
      'scripts/probe-consequence-admission-package-surface.mjs',
    ],
    validation: [
      'tests/package-script-runner.test.ts',
      'tests/release-layer-platform-surface.test.ts',
      'tests/crypto-intelligence-package-surface-consistency.test.ts',
      'tests/hosted-release-provenance-slsa-alignment.test.ts',
    ],
    standards: [
      'SLSA v1.2 Verification: consumers should verify the artifact they intend to use, including the expected subject and build outputs.',
      'NIST SSDF PW.8: release verification should confirm artifacts meet defined criteria.',
      'OpenSSF Scorecard supply-chain practice: pinned dependencies and controlled release workflows reduce accidental trust expansion.',
    ],
  },
  {
    id: 'proof.release-packet-binding',
    title: 'Proof packet, DSSE evidence, and tamper-evident history binding',
    surface: 'proof_release_packet_binding',
    releaseRisks: [
      'proof_packet_not_digest_bound',
      'tamper_history_gap',
      'secret_leak_in_release_evidence',
    ],
    requiredControls: [
      'canonical_release_json',
      'release_evidence_dsse_statement',
      'release_evidence_subject_digest',
      'tamper_evident_history_chain',
      'privacy_minimized_evidence',
      'no_live_secret_output',
    ],
    artifactBoundary:
      'Release decisions, evidence packs, proof surfaces, audit exports, and tamper-evident histories bind to canonical JSON and SHA-256 digests instead of raw mutable payloads.',
    provenanceBoundary:
      'Attestor release evidence emits DSSE-wrapped in-toto-style statements whose subjects bind output and consequence hashes to the signed evidence pack.',
    verificationBoundary:
      'Evidence verification rejects mismatched signed payloads, mismatched subject digests, broken history chains, and secret-bearing proof material.',
    nonClaimBoundary:
      'Tamper-evident local history is an integrity guard; it does not claim external transparency-log immutability or compliance certification until that substrate exists.',
    implementationEvidence: [
      'src/release-kernel/release-canonicalization.ts',
      'src/release-kernel/release-evidence-pack.ts',
      'src/consequence-admission/tamper-evident-history.ts',
      'src/consequence-admission/audit-evidence-export.ts',
      'src/consequence-admission/external-review-packet.ts',
      'scripts/render-proof-surface.ts',
      'scripts/render-proof-showcase.ts',
    ],
    validation: [
      'tests/release-kernel-release-canonicalization.test.ts',
      'tests/release-kernel-release-evidence-pack.test.ts',
      'tests/consequence-tamper-evident-history.test.ts',
      'tests/consequence-audit-evidence-export.test.ts',
      'tests/consequence-external-review-packet.test.ts',
      'tests/proof-surface-readiness.test.ts',
      'tests/hosted-release-provenance-slsa-alignment.test.ts',
    ],
    standards: [
      'in-toto Statement v1 and DSSE: signed statements bind subjects and predicates for portable evidence.',
      'SLSA v1.2 Provenance: verifiers reason over subjects, digests, builder identity, and reproducible build metadata.',
      'NIST SSDF PS.3/PW.8: protected release evidence and verification results should be preserved.',
    ],
  },
  {
    id: 'promotion.non-claim-boundary',
    title: 'Production promotion and SLSA non-claim boundary',
    surface: 'promotion_non_claim_boundary',
    releaseRisks: [
      'slsa_or_production_overclaim',
      'workflow_identity_ambiguous',
      'secret_leak_in_release_evidence',
    ],
    requiredControls: [
      'no_full_production_claim',
      'deployment_provenance_separate',
      'privacy_minimized_evidence',
      'no_live_secret_output',
      'github_attestation_verify_command',
    ],
    artifactBoundary:
      'Evaluation artifact provenance remains separate from production deployment evidence, runtime readiness, live secrets, cloud substrate, observability, and customer-operated environments.',
    provenanceBoundary:
      'Production rehearsal may consume and verify release provenance artifacts, but final promotion still depends on live environment render/probe/rehearsal evidence.',
    verificationBoundary:
      'A green provenance check is one input to promotion; production readiness still requires deployment env, restart, endpoint probes, worker probes, Stripe/webhook smoke tests, observability checks, and rehearsal.',
    nonClaimBoundary:
      'Attestor documents SLSA alignment for selected evaluation release artifacts and does not claim SLSA certification or full production supply-chain provenance.',
    implementationEvidence: [
      'docs/08-deployment/artifact-attestation-plan.md',
      'docs/08-deployment/production-readiness.md',
      'docs/02-architecture/hosted-production-trust-hardening.md',
      '.github/workflows/production-rehearsal.yml',
    ],
    validation: [
      'tests/security-baseline-docs.test.ts',
      'tests/production-readiness-secret-safe-output.test.ts',
      'tests/production-rehearsal-workflow.test.ts',
      'tests/hosted-release-provenance-slsa-alignment.test.ts',
    ],
    standards: [
      'SLSA v1.2 Verification: artifact verification is not a substitute for deployment environment verification.',
      'GitHub artifact attestations: provenance establishes where artifacts came from, not whether an external runtime is correctly operated.',
      'NIST SSDF PO.5/PW.8: organizational release claims should match verified implementation and operational evidence.',
    ],
  },
] as const;

export function hostedReleaseProvenanceSlsaAlignmentProfile(): {
  readonly version: string;
  readonly posture: string;
  readonly currentClaim: string;
  readonly unresolvedProductionDependency: string;
  readonly guards: readonly HostedReleaseProvenanceSlsaGuard[];
} {
  return {
    version: HOSTED_RELEASE_PROVENANCE_SLSA_ALIGNMENT_VERSION,
    posture:
      'Release provenance ties the evaluation archive, SBOM, package-surface gates, proof packets, DSSE evidence packs, tamper-evident history, and reviewer verification commands into one explicit trust boundary.',
    currentClaim:
      'Selected evaluation release artifacts are SLSA-aligned and GitHub-attestation verifiable; Attestor does not claim SLSA certification or full production supply-chain provenance.',
    unresolvedProductionDependency:
      'Final production provenance still requires a real deployment target, injected live secrets, service restart, runtime readiness probes, worker probes, Stripe/webhook smoke tests, observability checks, and rehearsal evidence.',
    guards: HOSTED_RELEASE_PROVENANCE_SLSA_GUARDS,
  };
}

export function requireHostedReleaseProvenanceSlsaGuard(
  id: string,
): HostedReleaseProvenanceSlsaGuard {
  const guard = HOSTED_RELEASE_PROVENANCE_SLSA_GUARDS.find((entry) => entry.id === id);
  if (!guard) {
    throw new Error(`Hosted release provenance SLSA guard '${id}' was not found.`);
  }
  return guard;
}
