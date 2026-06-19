type CheckStatus = 'pass' | 'fail' | 'skip';

export type Environment = Readonly<Record<string, string | undefined>>;

export interface TargetProfile {
  readonly profileId: string;
  readonly targetEnvironment: {
    readonly provider: string;
    readonly namespace: string;
  };
  readonly runtime: {
    readonly profile: string;
    readonly requireSharedAuthority: boolean;
    readonly noLocalFallback: boolean;
    readonly sharedAuthorityContract: string;
  };
  readonly substrates: readonly Array<{
    readonly id: string;
    readonly kind: string;
    readonly requiredEnv: readonly string[];
  }>;
}

export interface PriorStepSummary {
  readonly profileId?: string;
  readonly readiness: {
    readonly passed: boolean;
    readonly state: string;
    readonly issues?: readonly string[];
  };
  readonly target?: {
    readonly provider?: string;
    readonly namespace?: string;
    readonly publicHostname?: string | null;
  };
}

export interface PostgresPitrDrillEvidence {
  readonly schemaVersion: 'attestor.postgres-pitr-drill.v1';
  readonly generatedAt: string;
  readonly status: 'passed' | 'failed' | 'pending';
  readonly source: {
    readonly baseBackupId: string;
    readonly walArchiveRef: string;
    readonly sourcePgRef: string;
  };
  readonly restore: {
    readonly replacementTarget: string;
    readonly recoveredTo: string;
    readonly restoredAt: string;
    readonly validatedAt: string;
    readonly validationQueries: readonly string[];
  };
  readonly operator: string;
  readonly notes?: readonly string[];
}

export interface ControlPlaneBackupManifestComponent {
  readonly id: string;
  readonly tier: string;
  readonly snapshotPath: string | null;
  readonly present: boolean;
  readonly sha256: string | null;
  readonly bytes: number | null;
  readonly recordCount: number | null;
}

export interface ControlPlaneBackupManifest {
  readonly version: number;
  readonly snapshotId: string;
  readonly generatedAt: string;
  readonly includeEphemeral: boolean;
  readonly sharedControlPlaneMode: string;
  readonly sharedBillingLedgerConfigured: boolean;
  readonly components: readonly ControlPlaneBackupManifestComponent[];
}

export interface ProductionBackupRestoreDrCheck {
  readonly id: string;
  readonly status: CheckStatus;
  readonly detail: string;
  readonly evidence?: unknown;
}

export interface NpmCommandResult {
  readonly command: string;
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error: string | null;
}

export interface RedisDurabilityPosture {
  readonly ping: string;
  readonly maxmemoryPolicy: string;
  readonly appendonly: string;
  readonly appendfsync: string | null;
  readonly save: string | null;
  readonly durablePersistenceConfigured: boolean;
}

export interface PostgresValidationSummary {
  readonly releaseAuthority: {
    readonly sourceReadyComponents: number;
    readonly replacementReadyComponents: number;
    readonly replacementComponentCount: number;
  };
  readonly controlPlane: {
    readonly restoredTables: Record<string, number>;
    readonly comparedComponents: number;
  };
  readonly billingLedger: {
    readonly eventCount: number;
    readonly invoiceLineItemCount: number;
    readonly chargeCount: number;
  };
}

export interface BackupRestoreDrBehavior {
  readonly controlPlaneBackup: {
    readonly snapshotDir: string;
    readonly manifestPath: string;
    readonly snapshotId: string;
    readonly manifestDigest: string;
    readonly presentComponents: number;
  };
  readonly controlPlaneRestore: {
    readonly replacementControlPlane: string;
    readonly replacementBillingLedger: string;
    readonly restoredComponentCount: number;
    readonly skippedComponentCount: number;
  };
  readonly postgresPitr: {
    readonly evidencePath: string;
    readonly baseBackupId: string;
    readonly walArchiveRef: string;
    readonly recoveredTo: string;
    readonly validationQueryCount: number;
  };
  readonly redisDurability: {
    readonly source: RedisDurabilityPosture;
    readonly replacement: RedisDurabilityPosture;
  };
  readonly postRestore: {
    readonly postgres: PostgresValidationSummary;
    readonly apiReadyStatus: number;
    readonly workerReadyStatus: number;
    readonly admissionAllowed: boolean;
    readonly blockedFailClosed: boolean;
  };
}

export interface ProductionBackupRestoreDrSummary {
  readonly generatedAt: string;
  readonly profileId: string;
  readonly readiness: {
    readonly state:
      | 'passed-backup-restore-dr-rehearsal'
      | 'blocked-on-target-prerequisites'
      | 'failed-backup-restore-dr-rehearsal';
    readonly passed: boolean;
    readonly issues: readonly string[];
  };
  readonly target: {
    readonly provider: string;
    readonly namespace: string;
    readonly publicHostname: string | null;
  };
  readonly replacementTarget: {
    readonly controlPlanePgUrlRef: string;
    readonly billingLedgerPgUrlRef: string;
    readonly releaseAuthorityPgUrlRef: string;
    readonly redisUrlRef: string;
    readonly apiReadyUrl: string;
    readonly workerReadyUrl: string;
  };
  readonly artifacts: {
    readonly outputDir: string;
    readonly summaryPath: string;
    readonly readmePath: string;
    readonly backupSnapshotDir: string;
    readonly pitrEvidencePath: string | null;
  };
  readonly checks: readonly ProductionBackupRestoreDrCheck[];
  readonly commands: readonly NpmCommandResult[];
  readonly behavior: BackupRestoreDrBehavior | null;
  readonly nonClaims: readonly string[];
}

export interface PgClient {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  end(): Promise<void>;
}

export function pass(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionBackupRestoreDrCheck {
  return { id, status: 'pass', detail, evidence };
}

export function fail(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionBackupRestoreDrCheck {
  return { id, status: 'fail', detail, evidence };
}

export function skip(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionBackupRestoreDrCheck {
  return { id, status: 'skip', detail, evidence };
}
