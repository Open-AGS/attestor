type CheckStatus = 'pass' | 'fail' | 'skip';
export type GoNoGoVerdict = 'go' | 'no-go';

export interface RehearsalCommand {
  readonly id: string;
  readonly phase: string;
  readonly command: string;
  readonly required: boolean;
  readonly stopOnFailure: boolean;
  readonly expectedArtifacts?: readonly string[];
  readonly evidenceIds: readonly string[];
}

interface RehearsalEvidenceItem {
  readonly id: string;
  readonly phase: string;
  readonly kind: string;
  readonly required: boolean;
  readonly producer: string;
  readonly artifactPath?: string;
  readonly digestSha256?: string;
  readonly workflowRunId?: string;
  readonly verification?: string;
  readonly status: 'pending' | 'pass' | 'fail' | 'blocked' | 'skipped';
}

export interface ProductionRehearsalManifest {
  readonly schemaVersion: 'attestor.production-rehearsal.manifest.v1';
  readonly rehearsalId: string;
  readonly targetEnvironment: {
    readonly name: string;
    readonly type: string;
    readonly provider: string;
    readonly region: string;
    readonly cluster?: string;
    readonly namespace?: string;
    readonly publicHostname?: string;
    readonly owner: string;
  };
  readonly source: {
    readonly repository: string;
    readonly commit: string;
    readonly tag?: string;
    readonly release?: string;
    readonly workflowRuns: Readonly<Record<string, string>>;
  };
  readonly runtime: {
    readonly profile: string;
    readonly requireSharedAuthority: boolean;
    readonly noLocalFallback: boolean;
    readonly releaseAuthorityPgUrlRef?: string;
    readonly redisUrlRef?: string;
  };
  readonly secretPosture: {
    readonly mode: string;
    readonly plaintextSecretsAllowed: boolean;
    readonly redactedFields: readonly string[];
  };
  readonly commandPlan: readonly RehearsalCommand[];
  readonly evidenceItems: readonly RehearsalEvidenceItem[];
  readonly stopConditions: readonly string[];
  readonly nonClaims: readonly string[];
  readonly goNoGo: {
    readonly verdict: 'pending' | 'go' | 'no-go';
    readonly decidedBy?: string;
    readonly decidedAt?: string;
    readonly notes: string;
  };
}

export interface ReadinessPacketSummary {
  readonly readiness?: {
    readonly state?: string;
    readonly promotionGatePassed?: boolean;
    readonly issues?: readonly string[];
    readonly missingInputs?: readonly string[];
  };
}

export interface ProductionPromotionCandidateCheck {
  readonly id: string;
  readonly status: CheckStatus;
  readonly detail: string;
  readonly evidence?: unknown;
}

export interface IncludedArtifact {
  readonly id: string;
  readonly sourcePath: string;
  readonly bundlePath: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly producer: string;
  readonly verification: string | null;
  readonly kind: string;
}

export interface MissingArtifact {
  readonly id: string;
  readonly path: string;
  readonly required: boolean;
}

export type ArtifactPathBoundaryReason =
  | 'absolute-path-not-allowed'
  | 'parent-traversal-not-allowed'
  | 'outside-allowed-artifact-roots'
  | 'symlink-artifact-not-allowed';

export interface DeniedArtifact {
  readonly id: string;
  readonly path: string;
  readonly required: boolean;
  readonly reason: ArtifactPathBoundaryReason;
  readonly allowedRoots: readonly string[];
}

export interface ArtifactPathBoundary {
  readonly policyVersion: 'attestor.production-promotion.artifact-path-boundary.v1';
  readonly allowedRoots: readonly string[];
  readonly denyAbsolutePaths: boolean;
  readonly denyParentTraversal: boolean;
  readonly denySymlinkArtifacts: boolean;
}

export interface BundleSignature {
  readonly type: 'attestor.production-promotion.attestation.v1';
  readonly subject: {
    readonly name: string;
    readonly path: string;
    readonly sha256: string;
    readonly bytes: number;
  };
  readonly predicate: {
    readonly rehearsalId: string;
    readonly source: ProductionRehearsalManifest['source'];
    readonly targetEnvironment: ProductionRehearsalManifest['targetEnvironment'];
    readonly runtime: ProductionRehearsalManifest['runtime'];
    readonly goNoGo: {
      readonly verdict: GoNoGoVerdict;
      readonly manifestVerdict: ProductionRehearsalManifest['goNoGo']['verdict'];
      readonly blockers: readonly string[];
    };
    readonly includedArtifactCount: number;
    readonly limitations: readonly string[];
  };
  readonly signing: {
    readonly algorithm: 'ed25519';
    readonly publicKey: string;
    readonly fingerprint: string;
    readonly payloadSha256: string;
    readonly signature: string;
  };
}

export interface ProductionPromotionCandidateSummary {
  readonly schemaVersion: 'attestor.production-promotion-candidate.v1';
  readonly generatedAt: string;
  readonly rehearsalId: string;
  readonly targetEnvironment: ProductionRehearsalManifest['targetEnvironment'];
  readonly source: ProductionRehearsalManifest['source'];
  readonly runtime: ProductionRehearsalManifest['runtime'];
  readonly environmentPacket: {
    readonly artifactPath: string | null;
    readonly state: string | null;
    readonly promotionGatePassed: boolean | null;
    readonly issues: readonly string[];
    readonly missingInputs: readonly string[];
  };
  readonly commandPlan: readonly RehearsalCommand[];
  readonly evidence: {
    readonly requiredCount: number;
    readonly passingRequiredCount: number;
    readonly finalEvidenceIds: readonly string[];
    readonly includedArtifacts: readonly IncludedArtifact[];
    readonly missingArtifacts: readonly MissingArtifact[];
    readonly deniedArtifacts: readonly DeniedArtifact[];
    readonly digestMismatches: readonly string[];
  };
  readonly artifactPathBoundary: ArtifactPathBoundary;
  readonly checks: readonly ProductionPromotionCandidateCheck[];
  readonly goNoGo: {
    readonly verdict: GoNoGoVerdict;
    readonly manifestVerdict: ProductionRehearsalManifest['goNoGo']['verdict'];
    readonly blockers: readonly string[];
    readonly notes: string;
  };
  readonly artifacts: {
    readonly outputDir: string;
    readonly bundleDir: string;
    readonly summaryPath: string;
    readonly readmePath: string;
    readonly bundleManifestPath: string;
    readonly archivePath: string;
    readonly archiveSha256Path: string;
    readonly attestationPath: string | null;
    readonly publicKeyPath: string | null;
  };
  readonly attestation: {
    readonly localSignature: BundleSignature | null;
    readonly githubVerificationCommand: string;
    readonly nonClaim: string;
  };
  readonly limitations: readonly string[];
}
