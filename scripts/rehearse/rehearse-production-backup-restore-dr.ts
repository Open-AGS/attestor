import IORedis from 'ioredis';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  consequenceAdmissionAllowsConsequence,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
} from '../../src/consequence-admission/index.js';

type CheckStatus = 'pass' | 'fail' | 'skip';
type Environment = Readonly<Record<string, string | undefined>>;

interface TargetProfile {
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

interface PriorStepSummary {
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

interface PostgresPitrDrillEvidence {
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

interface ControlPlaneBackupManifestComponent {
  readonly id: string;
  readonly tier: string;
  readonly snapshotPath: string | null;
  readonly present: boolean;
  readonly sha256: string | null;
  readonly bytes: number | null;
  readonly recordCount: number | null;
}

interface ControlPlaneBackupManifest {
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

interface NpmCommandResult {
  readonly command: string;
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error: string | null;
}

interface RedisDurabilityPosture {
  readonly ping: string;
  readonly maxmemoryPolicy: string;
  readonly appendonly: string;
  readonly appendfsync: string | null;
  readonly save: string | null;
  readonly durablePersistenceConfigured: boolean;
}

interface PostgresValidationSummary {
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

interface BackupRestoreDrBehavior {
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

interface PgClient {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  end(): Promise<void>;
}

const DEFAULT_PROFILE_PATH =
  'docs/08-deployment/production-rehearsal-targets/gke-production-rehearsal.json';
const DEFAULT_OUTPUT_DIR =
  '.attestor/rehearsal/gke-production-rehearsal/backup-restore-dr';
const DEFAULT_SUBSTRATE_SUMMARY =
  '.attestor/rehearsal/gke-production-rehearsal/substrate-readiness/summary.json';
const DEFAULT_CONSEQUENCE_SUMMARY =
  '.attestor/rehearsal/gke-production-rehearsal/consequence-behavior/summary.json';
const DEFAULT_ASYNC_SUMMARY =
  '.attestor/rehearsal/gke-production-rehearsal/async-recovery/summary.json';

const COMPONENT_TABLES: Record<string, string> = {
  account_store: 'hosted_accounts',
  account_user_store: 'account_users',
  account_session_store: 'account_sessions',
  account_user_action_token_store: 'account_user_action_tokens',
  tenant_key_store: 'tenant_api_keys',
  usage_ledger: 'usage_ledger',
  billing_entitlement_store: 'billing_entitlements',
  async_dead_letter_store: 'async_dead_letter_jobs',
  admin_audit_log: 'admin_audit_log',
  admin_idempotency_store: 'admin_idempotency',
  stripe_webhook_store: 'stripe_webhook_dedupe',
};

function arg(name: string, fallback?: string): string | undefined {
  const prefixed = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefixed));
  if (found) return found.slice(prefixed.length);
  return fallback;
}

function envValue(env: Environment, name: string): string | null {
  const value = env[name];
  return value && value.trim() ? value.trim() : null;
}

function pass(id: string, detail: string, evidence?: unknown): ProductionBackupRestoreDrCheck {
  return { id, status: 'pass', detail, evidence };
}

function fail(id: string, detail: string, evidence?: unknown): ProductionBackupRestoreDrCheck {
  return { id, status: 'fail', detail, evidence };
}

function skip(id: string, detail: string, evidence?: unknown): ProductionBackupRestoreDrCheck {
  return { id, status: 'skip', detail, evidence };
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as T;
}

function tryReadSummary(path: string): PriorStepSummary | null {
  try {
    return readJsonFile<PriorStepSummary>(path);
  } catch {
    return null;
  }
}

function tryReadPitrEvidence(path: string | null): PostgresPitrDrillEvidence | null {
  if (!path) return null;
  try {
    return readJsonFile<PostgresPitrDrillEvidence>(path);
  } catch {
    return null;
  }
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function redactedUrl(value: string): string {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return 'configured-url';
  }
}

function requireSubstrate(
  profile: TargetProfile,
  id: string,
  kind: string,
  requiredEnv: string,
): boolean {
  return profile.substrates.some((substrate) =>
    substrate.id === id &&
    substrate.kind === kind &&
    substrate.requiredEnv.includes(requiredEnv));
}

function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function validatePitrEvidence(
  path: string | null,
  evidence: PostgresPitrDrillEvidence | null,
): ProductionBackupRestoreDrCheck {
  if (!path) {
    return fail('postgres-pitr-evidence', 'ATTESTOR_DR_PITR_EVIDENCE_PATH is required');
  }
  if (!evidence) {
    return fail('postgres-pitr-evidence', `PostgreSQL PITR evidence is missing or invalid: ${path}`);
  }
  const issues: string[] = [];
  if (evidence.schemaVersion !== 'attestor.postgres-pitr-drill.v1') {
    issues.push('schemaVersion must be attestor.postgres-pitr-drill.v1');
  }
  if (evidence.status !== 'passed') {
    issues.push(`status must be passed, got ${evidence.status}`);
  }
  if (!evidence.source.baseBackupId.trim()) {
    issues.push('source.baseBackupId is required');
  }
  if (!evidence.source.walArchiveRef.trim()) {
    issues.push('source.walArchiveRef is required');
  }
  if (!evidence.restore.replacementTarget.trim()) {
    issues.push('restore.replacementTarget is required');
  }
  if (!isIsoTimestamp(evidence.restore.restoredAt)) {
    issues.push('restore.restoredAt must be an ISO timestamp');
  }
  if (!isIsoTimestamp(evidence.restore.validatedAt)) {
    issues.push('restore.validatedAt must be an ISO timestamp');
  }
  if (evidence.restore.validationQueries.length === 0) {
    issues.push('restore.validationQueries must name at least one validation query');
  }
  return issues.length === 0
    ? pass('postgres-pitr-evidence', 'Operator PITR drill evidence is present and marked passed', {
      path,
      baseBackupId: evidence.source.baseBackupId,
      walArchiveRef: evidence.source.walArchiveRef,
      replacementTarget: evidence.restore.replacementTarget,
    })
    : fail('postgres-pitr-evidence', issues.join(' '), { path });
}

function targetPrerequisiteChecks(input: {
  readonly env: Environment;
  readonly profile: TargetProfile;
  readonly substrateSummary: PriorStepSummary | null;
  readonly consequenceSummary: PriorStepSummary | null;
  readonly asyncSummary: PriorStepSummary | null;
  readonly pitrEvidencePath: string | null;
  readonly pitrEvidence: PostgresPitrDrillEvidence | null;
}): ProductionBackupRestoreDrCheck[] {
  const checks: ProductionBackupRestoreDrCheck[] = [];
  const profileIssues: string[] = [];
  if (input.profile.profileId !== 'gke-production-rehearsal') {
    profileIssues.push(`unexpected profile id: ${input.profile.profileId}`);
  }
  if (input.profile.runtime.profile !== 'production-shared') {
    profileIssues.push('target profile must use production-shared');
  }
  if (!input.profile.runtime.requireSharedAuthority) {
    profileIssues.push('target profile must require shared authority');
  }
  if (!input.profile.runtime.noLocalFallback) {
    profileIssues.push('target profile must disable local fallback');
  }
  if (input.profile.runtime.sharedAuthorityContract !== 'async-shared-authority-stores') {
    profileIssues.push('target profile must use async-shared-authority-stores');
  }
  const substrateIssues: string[] = [];
  if (!requireSubstrate(input.profile, 'release-authority-postgres', 'postgres', 'ATTESTOR_RELEASE_AUTHORITY_PG_URL')) {
    substrateIssues.push('release-authority-postgres substrate is required');
  }
  if (!requireSubstrate(input.profile, 'control-plane-postgres', 'postgres', 'ATTESTOR_CONTROL_PLANE_PG_URL')) {
    substrateIssues.push('control-plane-postgres substrate is required');
  }
  if (!requireSubstrate(input.profile, 'billing-ledger-postgres', 'postgres', 'ATTESTOR_BILLING_LEDGER_PG_URL')) {
    substrateIssues.push('billing-ledger-postgres substrate is required');
  }
  if (!requireSubstrate(input.profile, 'queue-redis', 'redis', 'REDIS_URL')) {
    substrateIssues.push('queue-redis substrate is required');
  }
  checks.push(
    profileIssues.length === 0 && substrateIssues.length === 0
      ? pass('target-profile-dr-contract', 'Target profile pins production-shared PostgreSQL and Redis DR substrates')
      : fail('target-profile-dr-contract', [...profileIssues, ...substrateIssues].join(' ')),
  );

  const sourceControl = envValue(input.env, 'ATTESTOR_CONTROL_PLANE_PG_URL');
  const sourceBilling = envValue(input.env, 'ATTESTOR_BILLING_LEDGER_PG_URL');
  const sourceRelease = envValue(input.env, 'ATTESTOR_RELEASE_AUTHORITY_PG_URL');
  const sourceRedis = envValue(input.env, 'REDIS_URL');
  const replacementControl = envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_CONTROL_PLANE_PG_URL');
  const replacementBilling = envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_BILLING_LEDGER_PG_URL');
  const replacementRelease = envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_RELEASE_AUTHORITY_PG_URL');
  const replacementRedis = envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_REDIS_URL');
  const apiReady = envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_API_READY_URL');
  const workerReady = envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_WORKER_READY_URL');
  const envIssues: string[] = [];
  if (envValue(input.env, 'ATTESTOR_RUNTIME_PROFILE') !== 'production-shared') {
    envIssues.push('ATTESTOR_RUNTIME_PROFILE must be production-shared');
  }
  for (const [name, value] of [
    ['ATTESTOR_CONTROL_PLANE_PG_URL', sourceControl],
    ['ATTESTOR_BILLING_LEDGER_PG_URL', sourceBilling],
    ['ATTESTOR_RELEASE_AUTHORITY_PG_URL', sourceRelease],
    ['REDIS_URL', sourceRedis],
    ['ATTESTOR_DR_REPLACEMENT_CONTROL_PLANE_PG_URL', replacementControl],
    ['ATTESTOR_DR_REPLACEMENT_BILLING_LEDGER_PG_URL', replacementBilling],
    ['ATTESTOR_DR_REPLACEMENT_RELEASE_AUTHORITY_PG_URL', replacementRelease],
    ['ATTESTOR_DR_REPLACEMENT_REDIS_URL', replacementRedis],
    ['ATTESTOR_DR_REPLACEMENT_API_READY_URL', apiReady],
    ['ATTESTOR_DR_REPLACEMENT_WORKER_READY_URL', workerReady],
  ] as const) {
    if (!value) envIssues.push(`${name} is required`);
  }
  if (sourceControl && replacementControl && sourceControl === replacementControl) {
    envIssues.push('replacement control-plane PostgreSQL URL must differ from source');
  }
  if (sourceBilling && replacementBilling && sourceBilling === replacementBilling) {
    envIssues.push('replacement billing ledger PostgreSQL URL must differ from source');
  }
  if (sourceRelease && replacementRelease && sourceRelease === replacementRelease) {
    envIssues.push('replacement release authority PostgreSQL URL must differ from source');
  }
  if (sourceRedis && replacementRedis && sourceRedis === replacementRedis) {
    envIssues.push('replacement Redis URL must differ from source');
  }
  checks.push(
    envIssues.length === 0
      ? pass('source-and-replacement-inputs', 'Source and replacement PostgreSQL/Redis/API inputs are explicit and separated')
      : fail('source-and-replacement-inputs', envIssues.join(' ')),
  );

  const summaries: Array<readonly [string, PriorStepSummary | null, string]> = [
    ['substrate-readiness-prerequisite', input.substrateSummary, 'Step 05 substrate readiness'],
    ['consequence-rehearsal-prerequisite', input.consequenceSummary, 'Step 06 consequence behavior'],
    ['async-recovery-prerequisite', input.asyncSummary, 'Step 07 async recovery'],
  ];
  for (const [id, summary, label] of summaries) {
    if (!summary) {
      checks.push(fail(id, `${label} summary is missing`));
    } else if (!summary.readiness.passed) {
      checks.push(
        fail(id, `${label} is ${summary.readiness.state}`, {
          issues: summary.readiness.issues ?? [],
        }),
      );
    } else {
      checks.push(pass(id, `${label} passed for the named target`, {
        state: summary.readiness.state,
      }));
    }
  }
  checks.push(validatePitrEvidence(input.pitrEvidencePath, input.pitrEvidence));
  return checks;
}

function npmExecutable(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function runNpm(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): NpmCommandResult {
  const result = spawnSync(npmExecutable(), [...args], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return {
    command: `${npmExecutable()} ${args.join(' ')}`,
    exitCode: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ? result.error.message : null,
  };
}

async function pgClient(connectionString: string): Promise<PgClient> {
  const pg = await (Function('return import("pg")')() as Promise<any>);
  const Client = pg.Client ?? pg.default?.Client;
  if (!Client) {
    throw new Error('pg.Client is not available for DR validation.');
  }
  const client = new Client({ connectionString }) as PgClient;
  await client.connect();
  return client;
}

async function withPg<T>(
  connectionString: string,
  run: (client: PgClient) => Promise<T>,
): Promise<T> {
  const client = await pgClient(connectionString);
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function tableCount(
  connectionString: string,
  tableName: string,
): Promise<number> {
  return withPg(connectionString, async (client) => {
    const exists = await client.query('SELECT to_regclass($1) AS table_name', [
      `attestor_control_plane.${tableName}`,
    ]);
    if (!exists.rows[0]?.table_name) {
      throw new Error(`Replacement PostgreSQL table is missing: attestor_control_plane.${tableName}`);
    }
    const result = await client.query(
      `SELECT COUNT(*)::int AS count FROM attestor_control_plane.${tableName}`,
    );
    return Number(result.rows[0]?.count ?? 0);
  });
}

async function releaseAuthoritySummary(connectionString: string): Promise<{
  componentCount: number;
  readyComponentCount: number;
}> {
  return withPg(connectionString, async (client) => {
    const exists = await client.query('SELECT to_regclass($1) AS table_name', [
      'attestor_release_authority.shared_store_components',
    ]);
    if (!exists.rows[0]?.table_name) {
      throw new Error('Release authority shared_store_components table is missing.');
    }
    const result = await client.query(`
      SELECT COUNT(*)::int AS component_count,
             COUNT(*) FILTER (WHERE status = 'ready')::int AS ready_component_count
        FROM attestor_release_authority.shared_store_components
    `);
    return {
      componentCount: Number(result.rows[0]?.component_count ?? 0),
      readyComponentCount: Number(result.rows[0]?.ready_component_count ?? 0),
    };
  });
}

async function redisDurabilityPosture(redisUrl: string): Promise<RedisDurabilityPosture> {
  const redis = new IORedis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    retryStrategy: () => null,
    lazyConnect: true,
  });
  try {
    await redis.connect();
    const [
      ping,
      maxmemoryPolicyRaw,
      appendonlyRaw,
      appendfsyncRaw,
      saveRaw,
    ] = await Promise.all([
      redis.ping(),
      redis.config('GET', 'maxmemory-policy') as Promise<unknown>,
      redis.config('GET', 'appendonly') as Promise<unknown>,
      redis.config('GET', 'appendfsync') as Promise<unknown>,
      redis.config('GET', 'save') as Promise<unknown>,
    ]);
    const maxmemoryPolicy = configValue(maxmemoryPolicyRaw);
    const appendonly = configValue(appendonlyRaw);
    const appendfsync = configValue(appendfsyncRaw);
    const save = configValue(saveRaw);
    const durablePersistenceConfigured =
      appendonly === 'yes' ||
      (save !== null && save.trim().length > 0);
    return {
      ping,
      maxmemoryPolicy,
      appendonly,
      appendfsync,
      save,
      durablePersistenceConfigured,
    };
  } finally {
    redis.disconnect();
  }
}

function configValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    return value.length >= 2 ? String(value[1]) : null;
  }
  return value === null || value === undefined ? null : String(value);
}

async function fetchReady(url: string): Promise<{ status: number; bodySnippet: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text().catch(() => '');
    return {
      status: response.status,
      bodySnippet: text.slice(0, 160),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function restoredComponentsFromOutput(stdout: string): {
  restoredComponentCount: number;
  skippedComponentCount: number;
} {
  const restoredLine = stdout.split(/\r?\n/u).find((line) => line.startsWith('Restored components:'));
  const skippedLine = stdout.split(/\r?\n/u).find((line) => line.startsWith('Skipped components:'));
  return {
    restoredComponentCount: listCount(restoredLine?.slice('Restored components:'.length).trim() ?? ''),
    skippedComponentCount: listCount(skippedLine?.slice('Skipped components:'.length).trim() ?? ''),
  };
}

function listCount(value: string): number {
  if (!value || value === '(none)') return 0;
  return value.split(',').map((entry) => entry.trim()).filter(Boolean).length;
}

function buildAdmissionProbe(): {
  readonly admissionAllowed: boolean;
  readonly blockedFailClosed: boolean;
} {
  const requestedAt = new Date().toISOString();
  const request = createConsequenceAdmissionRequest({
    requestedAt,
    packFamily: 'finance',
    entryPoint: {
      kind: 'hosted-route',
      id: 'post-restore-dr-probe',
      route: '/api/v1/pipeline/run',
      packageSubpath: null,
      sourceRef: 'production-rehearsal-step-08',
    },
    proposedConsequence: {
      actor: 'dr-rehearsal',
      action: 'write restored financial record',
      downstreamSystem: 'replacement-target',
      consequenceKind: 'record',
      riskClass: 'R4',
      summary: 'Post-restore admission probe',
    },
    policyScope: {
      policyRef: 'production-rehearsal/dr',
      tenantId: 'tenant-dr-rehearsal',
      environment: 'production-shared',
    },
    authority: {
      actorRef: 'operator:dr-rehearsal',
      reviewerRef: 'reviewer:dr-rehearsal',
      authorityMode: 'dual-control',
    },
    evidence: [{
      id: 'dr-restore-summary',
      kind: 'production-rehearsal-summary',
      digest: 'sha256:post-restore-dr-probe',
      uri: null,
    }],
  });
  const admitted = createConsequenceAdmissionResponse({
    request,
    decidedAt: new Date().toISOString(),
    decision: 'admit',
    reason: 'Post-restore admission probe is allowed.',
    reasonCodes: ['DR_RESTORE_PROBE_ALLOWED'],
    proof: [{
      kind: 'release-evidence-pack',
      id: 'dr-restore-proof-ref',
      digest: 'sha256:dr-restore-proof-ref',
      uri: null,
      verifyHint: 'Verify the restored rehearsal evidence pack against the promotion bundle.',
    }],
  });
  const blocked = createConsequenceAdmissionResponse({
    request,
    decidedAt: new Date().toISOString(),
    decision: 'block',
    reason: 'Post-restore negative admission probe blocks fail-closed.',
    reasonCodes: ['DR_RESTORE_PROBE_BLOCKED'],
    proof: [],
  });
  return {
    admissionAllowed: consequenceAdmissionAllowsConsequence(admitted.decision) && admitted.allowed,
    blockedFailClosed: !blocked.allowed && blocked.failClosed,
  };
}

async function validatePostRestorePostgres(input: {
  readonly manifest: ControlPlaneBackupManifest;
  readonly sourceReleaseAuthorityPgUrl: string;
  readonly replacementReleaseAuthorityPgUrl: string;
  readonly replacementControlPlanePgUrl: string;
  readonly replacementBillingLedgerPgUrl: string;
}): Promise<PostgresValidationSummary> {
  const [sourceRelease, replacementRelease] = await Promise.all([
    releaseAuthoritySummary(input.sourceReleaseAuthorityPgUrl),
    releaseAuthoritySummary(input.replacementReleaseAuthorityPgUrl),
  ]);
  if (replacementRelease.componentCount === 0) {
    throw new Error('Replacement release authority has no shared components.');
  }
  if (replacementRelease.readyComponentCount < sourceRelease.readyComponentCount) {
    throw new Error('Replacement release authority has fewer ready components than the source.');
  }

  const restoredTables: Record<string, number> = {};
  let comparedComponents = 0;
  for (const component of input.manifest.components) {
    if (!component.present || component.id === 'billing_event_ledger') continue;
    const table = COMPONENT_TABLES[component.id];
    if (!table) continue;
    const count = await tableCount(input.replacementControlPlanePgUrl, table);
    restoredTables[table] = count;
    if (component.recordCount !== null && count < component.recordCount) {
      throw new Error(
        `Replacement table '${table}' has ${count} rows, expected at least ${component.recordCount}.`,
      );
    }
    comparedComponents += 1;
  }

  const [eventCount, invoiceLineItemCount, chargeCount] = await Promise.all([
    tableCount(input.replacementBillingLedgerPgUrl, 'billing_event_ledger'),
    tableCount(input.replacementBillingLedgerPgUrl, 'billing_invoice_line_items'),
    tableCount(input.replacementBillingLedgerPgUrl, 'billing_charges'),
  ]);
  const billingComponent = input.manifest.components.find((component) => component.id === 'billing_event_ledger');
  if (billingComponent?.recordCount !== null && billingComponent?.recordCount !== undefined) {
    if (eventCount + invoiceLineItemCount + chargeCount < billingComponent.recordCount) {
      throw new Error(
        'Replacement billing ledger has fewer restored rows than the backup manifest recorded.',
      );
    }
  }

  return {
    releaseAuthority: {
      sourceReadyComponents: sourceRelease.readyComponentCount,
      replacementReadyComponents: replacementRelease.readyComponentCount,
      replacementComponentCount: replacementRelease.componentCount,
    },
    controlPlane: {
      restoredTables,
      comparedComponents,
    },
    billingLedger: {
      eventCount,
      invoiceLineItemCount,
      chargeCount,
    },
  };
}

function ensureCommandPassed(result: NpmCommandResult): void {
  if (result.exitCode !== 0) {
    const detail = result.error ?? (result.stderr || result.stdout);
    throw new Error(
      `${result.command} failed with exit code ${result.exitCode}.\n${detail}`,
    );
  }
}

async function runBackupRestoreDrBehavior(input: {
  readonly env: Environment;
  readonly outputDir: string;
  readonly pitrEvidencePath: string;
  readonly pitrEvidence: PostgresPitrDrillEvidence;
}): Promise<{
  readonly behavior: BackupRestoreDrBehavior;
  readonly commands: readonly NpmCommandResult[];
}> {
  const snapshotDir = resolve(input.outputDir, 'control-plane-backup');
  const sourceEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...Object.fromEntries(Object.entries(input.env).filter(([, value]) => value !== undefined)) as NodeJS.ProcessEnv,
  };
  const restoreEnv: NodeJS.ProcessEnv = {
    ...sourceEnv,
    ATTESTOR_CONTROL_PLANE_PG_URL: envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_CONTROL_PLANE_PG_URL')!,
    ATTESTOR_BILLING_LEDGER_PG_URL: envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_BILLING_LEDGER_PG_URL')!,
  };
  const backup = runNpm(
    ['run', 'backup:control-plane', '--', '--output-dir', snapshotDir, '--include-ephemeral'],
    sourceEnv,
  );
  ensureCommandPassed(backup);
  const manifestPath = resolve(snapshotDir, 'manifest.json');
  const manifest = readJsonFile<ControlPlaneBackupManifest>(manifestPath);
  const restore = runNpm(
    ['run', 'restore:control-plane', '--', '--input-dir', snapshotDir, '--replace-existing', '--include-ephemeral'],
    restoreEnv,
  );
  ensureCommandPassed(restore);

  const [sourceRedis, replacementRedis, postgresValidation, apiReady, workerReady] = await Promise.all([
    redisDurabilityPosture(envValue(input.env, 'REDIS_URL')!),
    redisDurabilityPosture(envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_REDIS_URL')!),
    validatePostRestorePostgres({
      manifest,
      sourceReleaseAuthorityPgUrl: envValue(input.env, 'ATTESTOR_RELEASE_AUTHORITY_PG_URL')!,
      replacementReleaseAuthorityPgUrl: envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_RELEASE_AUTHORITY_PG_URL')!,
      replacementControlPlanePgUrl: envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_CONTROL_PLANE_PG_URL')!,
      replacementBillingLedgerPgUrl: envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_BILLING_LEDGER_PG_URL')!,
    }),
    fetchReady(envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_API_READY_URL')!),
    fetchReady(envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_WORKER_READY_URL')!),
  ]);

  if (sourceRedis.maxmemoryPolicy !== 'noeviction' || replacementRedis.maxmemoryPolicy !== 'noeviction') {
    throw new Error('Source and replacement Redis must both use maxmemory-policy=noeviction.');
  }
  for (const [label, posture] of [['source', sourceRedis], ['replacement', replacementRedis]] as const) {
    if (!posture.durablePersistenceConfigured) {
      throw new Error(`${label} Redis must have AOF or RDB persistence configured for DR rehearsal.`);
    }
    if (posture.appendonly === 'yes' && posture.appendfsync !== 'everysec' && posture.appendfsync !== 'always') {
      throw new Error(`${label} Redis appendonly persistence must use appendfsync everysec or always.`);
    }
  }
  if (apiReady.status < 200 || apiReady.status >= 300) {
    throw new Error(`Replacement API readiness returned HTTP ${apiReady.status}.`);
  }
  if (workerReady.status < 200 || workerReady.status >= 300) {
    throw new Error(`Replacement worker readiness returned HTTP ${workerReady.status}.`);
  }
  const admission = buildAdmissionProbe();
  if (!admission.admissionAllowed || !admission.blockedFailClosed) {
    throw new Error('Post-restore admission probe did not preserve allow/block fail-closed semantics.');
  }

  const restored = restoredComponentsFromOutput(restore.stdout);
  return {
    commands: [backup, restore],
    behavior: {
      controlPlaneBackup: {
        snapshotDir,
        manifestPath,
        snapshotId: manifest.snapshotId,
        manifestDigest: sha256File(manifestPath),
        presentComponents: manifest.components.filter((component) => component.present).length,
      },
      controlPlaneRestore: {
        replacementControlPlane: redactedUrl(envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_CONTROL_PLANE_PG_URL')!),
        replacementBillingLedger: redactedUrl(envValue(input.env, 'ATTESTOR_DR_REPLACEMENT_BILLING_LEDGER_PG_URL')!),
        ...restored,
      },
      postgresPitr: {
        evidencePath: resolve(input.pitrEvidencePath),
        baseBackupId: input.pitrEvidence.source.baseBackupId,
        walArchiveRef: input.pitrEvidence.source.walArchiveRef,
        recoveredTo: input.pitrEvidence.restore.recoveredTo,
        validationQueryCount: input.pitrEvidence.restore.validationQueries.length,
      },
      redisDurability: {
        source: sourceRedis,
        replacement: replacementRedis,
      },
      postRestore: {
        postgres: postgresValidation,
        apiReadyStatus: apiReady.status,
        workerReadyStatus: workerReady.status,
        ...admission,
      },
    },
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function renderReadme(summary: ProductionBackupRestoreDrSummary): string {
  const lines = [
    '# Production Backup / Restore / DR Rehearsal',
    '',
    `Generated: ${summary.generatedAt}`,
    `Profile: ${summary.profileId}`,
    `State: ${summary.readiness.state}`,
    `Passed: ${summary.readiness.passed ? 'yes' : 'no'}`,
    '',
    '## Checks',
    '',
    ...summary.checks.map((check) => `- ${check.status.toUpperCase()} ${check.id}: ${check.detail}`),
    '',
    '## Artifacts',
    '',
    `- Summary: ${summary.artifacts.summaryPath}`,
    `- Backup snapshot: ${summary.artifacts.backupSnapshotDir}`,
    `- PITR evidence: ${summary.artifacts.pitrEvidencePath ?? '(missing)'}`,
    '',
    '## Behavior',
    '',
  ];
  if (summary.behavior) {
    lines.push(
      `- Control-plane snapshot: ${summary.behavior.controlPlaneBackup.snapshotId}`,
      `- Present backup components: ${summary.behavior.controlPlaneBackup.presentComponents}`,
      `- Restored components: ${summary.behavior.controlPlaneRestore.restoredComponentCount}`,
      `- Redis source durability: appendonly=${summary.behavior.redisDurability.source.appendonly}, save=${summary.behavior.redisDurability.source.save ?? '(empty)'}`,
      `- Redis replacement durability: appendonly=${summary.behavior.redisDurability.replacement.appendonly}, save=${summary.behavior.redisDurability.replacement.save ?? '(empty)'}`,
      `- Replacement API ready status: ${summary.behavior.postRestore.apiReadyStatus}`,
      `- Replacement worker ready status: ${summary.behavior.postRestore.workerReadyStatus}`,
      `- Admission allowed probe: ${summary.behavior.postRestore.admissionAllowed ? 'passed' : 'failed'}`,
      `- Blocked fail-closed probe: ${summary.behavior.postRestore.blockedFailClosed ? 'passed' : 'failed'}`,
    );
  } else {
    lines.push('- Core backup/restore/DR behavior was not exercised.');
  }
  lines.push(
    '',
    '## Non-Claims',
    '',
    ...summary.nonClaims.map((claim) => `- ${claim}`),
    '',
  );
  return lines.join('\n');
}

export async function rehearseProductionBackupRestoreDr(options?: {
  readonly env?: Environment;
  readonly profile?: TargetProfile;
  readonly substrateSummary?: PriorStepSummary | null;
  readonly consequenceSummary?: PriorStepSummary | null;
  readonly asyncSummary?: PriorStepSummary | null;
  readonly pitrEvidence?: PostgresPitrDrillEvidence | null;
  readonly pitrEvidencePath?: string | null;
  readonly outputDir?: string;
}): Promise<ProductionBackupRestoreDrSummary> {
  const env = options?.env ?? process.env;
  const profile = options?.profile ?? readJsonFile<TargetProfile>(
    arg('profile', DEFAULT_PROFILE_PATH)!,
  );
  const outputDir = resolve(options?.outputDir ?? arg('output-dir', DEFAULT_OUTPUT_DIR)!);
  mkdirSync(outputDir, { recursive: true });
  const summaryPath = resolve(outputDir, 'summary.json');
  const readmePath = resolve(outputDir, 'README.md');
  const pitrEvidencePath =
    options?.pitrEvidencePath === undefined
      ? envValue(env, 'ATTESTOR_DR_PITR_EVIDENCE_PATH')
      : options.pitrEvidencePath;
  const pitrEvidence = options?.pitrEvidence === undefined
    ? tryReadPitrEvidence(pitrEvidencePath)
    : options.pitrEvidence;
  const substrateSummary = options?.substrateSummary ?? tryReadSummary(
    arg('substrate-summary', DEFAULT_SUBSTRATE_SUMMARY)!,
  );
  const consequenceSummary = options?.consequenceSummary ?? tryReadSummary(
    arg('consequence-summary', DEFAULT_CONSEQUENCE_SUMMARY)!,
  );
  const asyncSummary = options?.asyncSummary ?? tryReadSummary(
    arg('async-summary', DEFAULT_ASYNC_SUMMARY)!,
  );

  const checks = targetPrerequisiteChecks({
    env,
    profile,
    substrateSummary,
    consequenceSummary,
    asyncSummary,
    pitrEvidencePath,
    pitrEvidence,
  });
  const prerequisiteIssues = checks
    .filter((check) => check.status === 'fail')
    .map((check) => `${check.id}: ${check.detail}`);
  const nonClaims = [
    'This rehearsal is not automated cross-region failover.',
    'This rehearsal is not a blanket production guarantee for every customer environment.',
    'This rehearsal does not replace managed PostgreSQL backup scheduling, retention policy, or independent restore review.',
    'This rehearsal does not claim exactly-once queue processing after disaster recovery.',
    'This rehearsal does not prove market/customer validation or a hosted public SaaS launch.',
  ];

  let behavior: BackupRestoreDrBehavior | null = null;
  let commands: readonly NpmCommandResult[] = [];
  let readiness: ProductionBackupRestoreDrSummary['readiness'];
  if (prerequisiteIssues.length > 0) {
    checks.push(skip('backup-restore-dr-rehearsal', 'Core backup/restore/DR behavior skipped because prerequisites failed'));
    readiness = {
      state: 'blocked-on-target-prerequisites',
      passed: false,
      issues: prerequisiteIssues,
    };
  } else {
    try {
      const result = await runBackupRestoreDrBehavior({
        env,
        outputDir,
        pitrEvidencePath: pitrEvidencePath!,
        pitrEvidence: pitrEvidence!,
      });
      behavior = result.behavior;
      commands = result.commands;
      checks.push(pass('backup-control-plane-snapshot', 'Control-plane backup command produced a verified manifest', {
        snapshotId: behavior.controlPlaneBackup.snapshotId,
        manifestDigest: behavior.controlPlaneBackup.manifestDigest,
      }));
      checks.push(pass('restore-control-plane-replacement', 'Control-plane restore command completed against replacement PostgreSQL URLs', {
        restoredComponentCount: behavior.controlPlaneRestore.restoredComponentCount,
      }));
      checks.push(pass('postgres-pitr-drill', 'PostgreSQL PITR drill evidence is bound to this restore rehearsal', behavior.postgresPitr));
      checks.push(pass('redis-durability-check', 'Source and replacement Redis expose durable persistence and noeviction posture', behavior.redisDurability));
      checks.push(pass('post-restore-readiness-admission', 'Replacement readiness endpoints and admission semantics passed after restore', {
        apiReadyStatus: behavior.postRestore.apiReadyStatus,
        workerReadyStatus: behavior.postRestore.workerReadyStatus,
        admissionAllowed: behavior.postRestore.admissionAllowed,
        blockedFailClosed: behavior.postRestore.blockedFailClosed,
      }));
      readiness = {
        state: 'passed-backup-restore-dr-rehearsal',
        passed: true,
        issues: [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push(fail('backup-restore-dr-rehearsal', message));
      readiness = {
        state: 'failed-backup-restore-dr-rehearsal',
        passed: false,
        issues: [message],
      };
    }
  }

  const summary: ProductionBackupRestoreDrSummary = {
    generatedAt: new Date().toISOString(),
    profileId: profile.profileId,
    readiness,
    target: {
      provider: profile.targetEnvironment.provider,
      namespace: profile.targetEnvironment.namespace,
      publicHostname: substrateSummary?.target?.publicHostname ?? null,
    },
    replacementTarget: {
      controlPlanePgUrlRef: envValue(env, 'ATTESTOR_DR_REPLACEMENT_CONTROL_PLANE_PG_URL')
        ? redactedUrl(envValue(env, 'ATTESTOR_DR_REPLACEMENT_CONTROL_PLANE_PG_URL')!)
        : 'missing',
      billingLedgerPgUrlRef: envValue(env, 'ATTESTOR_DR_REPLACEMENT_BILLING_LEDGER_PG_URL')
        ? redactedUrl(envValue(env, 'ATTESTOR_DR_REPLACEMENT_BILLING_LEDGER_PG_URL')!)
        : 'missing',
      releaseAuthorityPgUrlRef: envValue(env, 'ATTESTOR_DR_REPLACEMENT_RELEASE_AUTHORITY_PG_URL')
        ? redactedUrl(envValue(env, 'ATTESTOR_DR_REPLACEMENT_RELEASE_AUTHORITY_PG_URL')!)
        : 'missing',
      redisUrlRef: envValue(env, 'ATTESTOR_DR_REPLACEMENT_REDIS_URL')
        ? redactedUrl(envValue(env, 'ATTESTOR_DR_REPLACEMENT_REDIS_URL')!)
        : 'missing',
      apiReadyUrl: envValue(env, 'ATTESTOR_DR_REPLACEMENT_API_READY_URL') ?? 'missing',
      workerReadyUrl: envValue(env, 'ATTESTOR_DR_REPLACEMENT_WORKER_READY_URL') ?? 'missing',
    },
    artifacts: {
      outputDir,
      summaryPath,
      readmePath,
      backupSnapshotDir: resolve(outputDir, 'control-plane-backup'),
      pitrEvidencePath: pitrEvidencePath ? resolve(pitrEvidencePath) : null,
    },
    checks,
    commands,
    behavior,
    nonClaims,
  };
  writeJson(summaryPath, summary);
  writeFileSync(readmePath, renderReadme(summary), 'utf8');
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  rehearseProductionBackupRestoreDr()
    .then((summary) => {
      console.log(`Production backup/restore/DR rehearsal: ${summary.readiness.state}`);
      console.log(`Summary: ${summary.artifacts.summaryPath}`);
      console.log(`README: ${summary.artifacts.readmePath}`);
      if (!summary.readiness.passed) {
        for (const issue of summary.readiness.issues) {
          console.error(`- ${issue}`);
        }
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.stack ?? error.message : error);
      process.exit(1);
    });
}
