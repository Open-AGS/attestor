import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  isAbsolute,
  resolve,
} from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  digestReference,
  safeErrorMessage,
  stringifySecretSafe,
} from './secret-safe-output.ts';

type GateStatus = 'pass' | 'fail' | 'not-applicable';
type GoNoGoVerdict = 'go' | 'no-go';
type TargetScope = 'environment-promotion' | 'customer-enforcement';
type ProviderRouteMode = 'not-used' | 'required';

interface IncludedArtifact {
  readonly id?: string;
  readonly sourcePath?: string;
  readonly sha256?: string;
}

interface ProductionPromotionCandidateSummary {
  readonly schemaVersion?: string;
  readonly rehearsalId?: string;
  readonly targetEnvironment?: {
    readonly name?: string;
    readonly type?: string;
    readonly provider?: string;
    readonly region?: string;
    readonly publicHostname?: string;
  };
  readonly source?: {
    readonly repository?: string;
    readonly commit?: string;
    readonly tag?: string;
    readonly workflowRuns?: Readonly<Record<string, string>>;
  };
  readonly runtime?: {
    readonly profile?: string;
    readonly requireSharedAuthority?: boolean;
    readonly noLocalFallback?: boolean;
  };
  readonly environmentPacket?: {
    readonly state?: string | null;
    readonly promotionGatePassed?: boolean | null;
    readonly issues?: readonly string[];
    readonly missingInputs?: readonly string[];
  };
  readonly evidence?: {
    readonly requiredCount?: number;
    readonly passingRequiredCount?: number;
    readonly includedArtifacts?: readonly IncludedArtifact[];
    readonly missingArtifacts?: readonly unknown[];
    readonly digestMismatches?: readonly string[];
  };
  readonly goNoGo?: {
    readonly verdict?: string;
    readonly manifestVerdict?: string;
    readonly blockers?: readonly string[];
    readonly notes?: string;
  };
  readonly artifacts?: {
    readonly summaryPath?: string;
    readonly archivePath?: string;
    readonly archiveSha256Path?: string;
    readonly attestationPath?: string | null;
  };
  readonly attestation?: {
    readonly localSignature?: unknown;
  };
  readonly limitations?: readonly string[];
}

export interface ProductionGoNoGoGate {
  readonly id: string;
  readonly title: string;
  readonly status: GateStatus;
  readonly required: boolean;
  readonly protectedPrinciples: readonly string[];
  readonly summary: string;
  readonly evidenceRefs: readonly string[];
  readonly blockers: readonly string[];
}

export interface ProductionGoNoGoPacket {
  readonly schemaVersion: 'attestor.production-go-no-go-packet.v1';
  readonly generatedAt: string;
  readonly targetScope: TargetScope;
  readonly providerRouteMode: ProviderRouteMode;
  readonly promotionCandidate: {
    readonly summaryPath: string | null;
    readonly loaded: boolean;
    readonly schemaVersion: string | null;
    readonly rehearsalId: string | null;
    readonly targetEnvironment: ProductionPromotionCandidateSummary['targetEnvironment'] | null;
    readonly source: ProductionPromotionCandidateSummary['source'] | null;
    readonly runtime: ProductionPromotionCandidateSummary['runtime'] | null;
  };
  readonly decision: {
    readonly verdict: GoNoGoVerdict;
    readonly blockers: readonly string[];
    readonly humanApproval: {
      readonly actorRef: string | null;
      readonly approvedAt: string | null;
      readonly present: boolean;
    };
  };
  readonly gates: readonly ProductionGoNoGoGate[];
  readonly artifacts: {
    readonly outputDir: string;
    readonly summaryPath: string;
    readonly readmePath: string;
  };
  readonly limitations: readonly string[];
}

const DEFAULT_OUTPUT_DIR = '.attestor/production-go-no-go/latest';
const DEFAULT_RUNBOOK_PATH = 'docs/08-deployment/production-rehearsal-operator-runbook.md';
const REQUIRED_REHEARSAL_EVIDENCE_IDS = Object.freeze([
  'repo-verify-output',
  'production-readiness-packet',
  'production-rehearsal-substrate-readiness',
  'production-rehearsal-consequence-behavior',
  'production-rehearsal-async-recovery',
  'production-rehearsal-backup-restore-dr',
  'production-rehearsal-observability-alerting',
  'release-provenance-verification',
]);

function arg(name: string, fallback?: string): string | undefined {
  const prefixed = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefixed));
  if (found) return found.slice(prefixed.length);
  return fallback;
}

function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function readJsonIfPresent<T>(path: string | null): T | null {
  if (!path) return null;
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function resolveFromRoot(rootDir: string, path: string): string {
  return isAbsolute(path) ? path : resolve(rootDir, path);
}

function normalizeTargetScope(value: string | null | undefined): TargetScope {
  return value === 'customer-enforcement' ? 'customer-enforcement' : 'environment-promotion';
}

function normalizeProviderRouteMode(value: string | null | undefined): ProviderRouteMode {
  return value === 'required' ? 'required' : 'not-used';
}

function validDigest(value: string | null): boolean {
  if (!value) return false;
  return /^sha256:[a-f0-9]{32,64}$/iu.test(value)
    || /^[a-f0-9]{64}$/iu.test(value);
}

function validIsoTimestamp(value: string | null): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= Date.now() + 300_000;
}

function gate(input: ProductionGoNoGoGate): ProductionGoNoGoGate {
  return Object.freeze({
    ...input,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    blockers: Object.freeze([...input.blockers]),
    protectedPrinciples: Object.freeze([...input.protectedPrinciples]),
  });
}

function pass(input: Omit<ProductionGoNoGoGate, 'status' | 'blockers'> & {
  readonly blockers?: readonly string[];
}): ProductionGoNoGoGate {
  return gate({ ...input, status: 'pass', blockers: input.blockers ?? [] });
}

function fail(input: Omit<ProductionGoNoGoGate, 'status'>): ProductionGoNoGoGate {
  return gate({ ...input, status: 'fail' });
}

function notApplicable(input: Omit<ProductionGoNoGoGate, 'status' | 'required' | 'blockers'>): ProductionGoNoGoGate {
  return gate({ ...input, status: 'not-applicable', required: false, blockers: [] });
}

function includedArtifactIds(summary: ProductionPromotionCandidateSummary | null): Set<string> {
  return new Set(
    summary?.evidence?.includedArtifacts
      ?.map((artifact) => artifact.id)
      .filter((id): id is string => Boolean(id)) ?? [],
  );
}

function promotionCandidateGate(summary: ProductionPromotionCandidateSummary | null): ProductionGoNoGoGate {
  if (!summary) {
    return fail({
      id: 'production-promotion-candidate',
      title: 'Production promotion candidate',
      required: true,
      protectedPrinciples: ['proof integrity', 'runtime readiness', 'no overclaim'],
      summary: 'No production-promotion candidate summary was loaded.',
      evidenceRefs: [],
      blockers: ['production-promotion-candidate-summary-missing'],
    });
  }

  const blockers: string[] = [];
  if (summary.schemaVersion !== 'attestor.production-promotion-candidate.v1') {
    blockers.push('production-promotion-candidate-schema-mismatch');
  }
  if (summary.goNoGo?.verdict !== 'go') {
    blockers.push('production-promotion-candidate-verdict-not-go');
  }
  if (summary.goNoGo?.blockers?.length) {
    blockers.push('production-promotion-candidate-has-blockers');
  }
  if (summary.environmentPacket?.state !== 'ready-for-environment-promotion') {
    blockers.push('environment-packet-not-ready');
  }
  if (summary.environmentPacket?.promotionGatePassed !== true) {
    blockers.push('environment-packet-promotion-gate-not-passed');
  }
  if (!summary.attestation?.localSignature || !summary.artifacts?.attestationPath) {
    blockers.push('production-promotion-candidate-local-attestation-missing');
  }

  const evidenceRefs = [
    summary.artifacts?.summaryPath,
    summary.artifacts?.archivePath,
    summary.artifacts?.archiveSha256Path,
    summary.artifacts?.attestationPath ?? undefined,
  ].filter((ref): ref is string => Boolean(ref));

  if (blockers.length > 0) {
    return fail({
      id: 'production-promotion-candidate',
      title: 'Production promotion candidate',
      required: true,
      protectedPrinciples: ['proof integrity', 'runtime readiness', 'no overclaim'],
      summary: 'The production-promotion candidate is not ready to drive a go decision.',
      evidenceRefs,
      blockers,
    });
  }

  return pass({
    id: 'production-promotion-candidate',
    title: 'Production promotion candidate',
    required: true,
    protectedPrinciples: ['proof integrity', 'runtime readiness', 'no overclaim'],
    summary: 'The production-promotion candidate is signed, target-bound, and carries a go verdict.',
    evidenceRefs,
  });
}

function rehearsalEvidenceGate(summary: ProductionPromotionCandidateSummary | null): ProductionGoNoGoGate {
  const ids = includedArtifactIds(summary);
  const missing = REQUIRED_REHEARSAL_EVIDENCE_IDS.filter((id) => !ids.has(id));
  const evidence = summary?.evidence;
  const blockers = [
    ...missing.map((id) => `missing-rehearsal-evidence:${id}`),
  ];

  if (typeof evidence?.requiredCount === 'number'
    && typeof evidence?.passingRequiredCount === 'number'
    && evidence.passingRequiredCount < evidence.requiredCount) {
    blockers.push('required-evidence-not-all-passing');
  }
  if (evidence?.missingArtifacts?.length) blockers.push('required-artifacts-missing');
  if (evidence?.digestMismatches?.length) blockers.push('artifact-digest-mismatch');

  if (blockers.length > 0) {
    return fail({
      id: 'target-rehearsal-evidence',
      title: 'Target rehearsal evidence chain',
      required: true,
      protectedPrinciples: ['runtime readiness', 'auditability', 'operational boundedness'],
      summary: 'The target-bound rehearsal chain is incomplete.',
      evidenceRefs: [...ids],
      blockers,
    });
  }

  return pass({
    id: 'target-rehearsal-evidence',
    title: 'Target rehearsal evidence chain',
    required: true,
    protectedPrinciples: ['runtime readiness', 'auditability', 'operational boundedness'],
    summary: 'Repository verify, readiness packet, substrate, consequence, async, DR, observability, and provenance evidence are present.',
    evidenceRefs: [...ids],
  });
}

function externalSignerGate(digest: string | null): ProductionGoNoGoGate {
  if (!validDigest(digest)) {
    return fail({
      id: 'external-signer-runtime-proof',
      title: 'External signer runtime proof',
      required: true,
      protectedPrinciples: ['proof integrity', 'customer authority', 'runtime readiness'],
      summary: 'Repository-side KMS adapter contracts are not enough for production promotion; a target runtime signer proof digest is required.',
      evidenceRefs: [],
      blockers: ['external-signer-runtime-proof-digest-required'],
    });
  }

  return pass({
    id: 'external-signer-runtime-proof',
    title: 'External signer runtime proof',
    required: true,
    protectedPrinciples: ['proof integrity', 'customer authority', 'runtime readiness'],
    summary: 'A target runtime external signer proof digest is present.',
    evidenceRefs: [digest],
  });
}

function sharedStoreGate(summary: ProductionPromotionCandidateSummary | null): ProductionGoNoGoGate {
  const runtime = summary?.runtime;
  const blockers: string[] = [];
  if (runtime?.profile !== 'production-shared') blockers.push('runtime-profile-not-production-shared');
  if (runtime?.requireSharedAuthority !== true) blockers.push('shared-authority-not-required');
  if (runtime?.noLocalFallback !== true) blockers.push('local-fallback-not-blocked');
  if (summary?.environmentPacket?.promotionGatePassed !== true) {
    blockers.push('shared-store-readiness-not-cleared-by-environment-packet');
  }

  if (blockers.length > 0) {
    return fail({
      id: 'shared-store-runtime-boundary',
      title: 'Shared-store runtime boundary',
      required: true,
      protectedPrinciples: ['tenant isolation', 'replay and idempotency safety', 'runtime readiness'],
      summary: 'The production-shared runtime and shared consequence-store path are not proven by the promotion candidate.',
      evidenceRefs: [],
      blockers,
    });
  }

  return pass({
    id: 'shared-store-runtime-boundary',
    title: 'Shared-store runtime boundary',
    required: true,
    protectedPrinciples: ['tenant isolation', 'replay and idempotency safety', 'runtime readiness'],
    summary: 'The candidate is bound to production-shared, shared authority, no local fallback, and a passing environment packet.',
    evidenceRefs: ['production-readiness-packet'],
  });
}

function customerPepGate(scope: TargetScope, digest: string | null): ProductionGoNoGoGate {
  if (scope === 'environment-promotion') {
    return notApplicable({
      id: 'customer-pep-cutover-proof',
      title: 'Customer PEP cutover proof',
      protectedPrinciples: ['customer authority', 'fail-closed boundary', 'no overclaim'],
      summary: 'Customer PEP traffic cutover is outside this environment-promotion scope; the packet does not claim live customer enforcement.',
      evidenceRefs: ['customer-pep-scope:not-in-scope'],
    });
  }

  if (!validDigest(digest)) {
    return fail({
      id: 'customer-pep-cutover-proof',
      title: 'Customer PEP cutover proof',
      required: true,
      protectedPrinciples: ['customer authority', 'fail-closed boundary', 'no overclaim'],
      summary: 'Customer-enforcement scope requires a target customer PEP cutover proof digest.',
      evidenceRefs: [],
      blockers: ['customer-pep-cutover-proof-digest-required'],
    });
  }

  return pass({
    id: 'customer-pep-cutover-proof',
    title: 'Customer PEP cutover proof',
    required: true,
    protectedPrinciples: ['customer authority', 'fail-closed boundary', 'no overclaim'],
    summary: 'A target customer PEP cutover proof digest is present for customer-enforcement scope.',
    evidenceRefs: [digest],
  });
}

function providerRouteGate(mode: ProviderRouteMode, digest: string | null): ProductionGoNoGoGate {
  if (mode === 'not-used') {
    return notApplicable({
      id: 'llm-provider-route-proof',
      title: 'LLM provider route proof',
      protectedPrinciples: ['runtime readiness', 'data minimization and redaction', 'no overclaim'],
      summary: 'No hosted production consequence route is declared dependent on a live LLM provider for this promotion.',
      evidenceRefs: ['llm-provider-route:not-used'],
    });
  }

  if (!validDigest(digest)) {
    return fail({
      id: 'llm-provider-route-proof',
      title: 'LLM provider route proof',
      required: true,
      protectedPrinciples: ['runtime readiness', 'data minimization and redaction', 'no overclaim'],
      summary: 'A production route that depends on a live LLM provider requires fresh provider-route smoke proof.',
      evidenceRefs: [],
      blockers: ['llm-provider-route-proof-digest-required'],
    });
  }

  return pass({
    id: 'llm-provider-route-proof',
    title: 'LLM provider route proof',
    required: true,
    protectedPrinciples: ['runtime readiness', 'data minimization and redaction', 'no overclaim'],
    summary: 'A live LLM provider-route proof digest is present.',
    evidenceRefs: [digest],
  });
}

function incidentRunbookGate(rootDir: string, path: string, summary: ProductionPromotionCandidateSummary | null): ProductionGoNoGoGate {
  const resolved = resolveFromRoot(rootDir, path);
  const blockers: string[] = [];
  if (!existsSync(resolved)) {
    blockers.push('operator-runbook-missing');
  } else {
    const content = readFileSync(resolved, 'utf8');
    if (!content.includes('## Stop Conditions')) blockers.push('operator-runbook-stop-conditions-missing');
    if (!content.includes('rehearse:production-observability-alerting')) blockers.push('operator-runbook-observability-step-missing');
    if (!content.includes('do not call production ready')) blockers.push('operator-runbook-no-overclaim-language-missing');
  }

  if (!includedArtifactIds(summary).has('production-rehearsal-observability-alerting')) {
    blockers.push('observability-alerting-evidence-missing');
  }

  const evidenceRefs = existsSync(resolved)
    ? [`runbook:${sha256(readFileSync(resolved, 'utf8')).slice(0, 24)}`, 'production-rehearsal-observability-alerting']
    : ['production-rehearsal-observability-alerting'];

  if (blockers.length > 0) {
    return fail({
      id: 'incident-runbook-and-observability',
      title: 'Incident runbook and observability',
      required: true,
      protectedPrinciples: ['auditability', 'operational boundedness', 'runtime readiness'],
      summary: 'Incident/runbook and observability evidence are incomplete.',
      evidenceRefs,
      blockers,
    });
  }

  return pass({
    id: 'incident-runbook-and-observability',
    title: 'Incident runbook and observability',
    required: true,
    protectedPrinciples: ['auditability', 'operational boundedness', 'runtime readiness'],
    summary: 'Operator stop conditions and observability rehearsal evidence are present.',
    evidenceRefs,
  });
}

function humanApprovalGate(approvedBy: string | null, approvedAt: string | null): ProductionGoNoGoGate {
  const actorRef = digestReference('approval-actor', approvedBy);
  const blockers: string[] = [];
  if (!actorRef) blockers.push('human-approval-actor-required');
  if (!validIsoTimestamp(approvedAt)) blockers.push('human-approval-timestamp-required');

  if (blockers.length > 0) {
    return fail({
      id: 'human-approval',
      title: 'Human approval',
      required: true,
      protectedPrinciples: ['customer authority', 'no overclaim', 'operational boundedness'],
      summary: 'A final go decision requires an explicit human approval actor and timestamp.',
      evidenceRefs: [],
      blockers,
    });
  }

  return pass({
    id: 'human-approval',
    title: 'Human approval',
    required: true,
    protectedPrinciples: ['customer authority', 'no overclaim', 'operational boundedness'],
    summary: 'A digest-only human approval reference and timestamp are present.',
    evidenceRefs: [actorRef!, approvedAt!],
  });
}

function renderReadme(packet: ProductionGoNoGoPacket): string {
  const blockers = packet.decision.blockers.length
    ? packet.decision.blockers.map((blocker) => `- ${blocker}`).join('\n')
    : '- none';
  const gates = packet.gates.map((entry) =>
    `| ${entry.id} | ${entry.status} | ${entry.required} | ${entry.summary.replace(/\|/gu, '/')} |`).join('\n');

  return `# Attestor Production Go/No-Go Packet

Generated at:

- ${packet.generatedAt}

Decision:

- verdict: ${packet.decision.verdict}
- target scope: ${packet.targetScope}
- provider route mode: ${packet.providerRouteMode}
- human approval present: ${packet.decision.humanApproval.present}
- human approval actor ref: ${packet.decision.humanApproval.actorRef ?? 'missing'}

Target:

- rehearsal id: ${packet.promotionCandidate.rehearsalId ?? 'missing'}
- environment: ${packet.promotionCandidate.targetEnvironment?.name ?? 'missing'}
- runtime profile: ${packet.promotionCandidate.runtime?.profile ?? 'missing'}

Gates:

| Gate | Status | Required | Summary |
|---|---|---|---|
${gates}

Blockers:

${blockers}

Limitations:

${packet.limitations.map((limitation) => `- ${limitation}`).join('\n')}
`;
}

export async function renderProductionGoNoGoPacket(options?: {
  readonly rootDir?: string;
  readonly promotionSummaryPath?: string | null;
  readonly outputDir?: string;
  readonly targetScope?: TargetScope;
  readonly providerRouteMode?: ProviderRouteMode;
  readonly externalSignerProofDigest?: string | null;
  readonly customerPepProofDigest?: string | null;
  readonly providerRouteProofDigest?: string | null;
  readonly approvedBy?: string | null;
  readonly approvedAt?: string | null;
  readonly operatorRunbookPath?: string;
}): Promise<ProductionGoNoGoPacket> {
  const rootDir = resolve(options?.rootDir ?? process.cwd());
  const promotionSummaryArg = options?.promotionSummaryPath
    ?? arg('promotion-summary', env('ATTESTOR_PRODUCTION_PROMOTION_CANDIDATE_SUMMARY_PATH') ?? undefined)
    ?? null;
  const promotionSummaryPath = promotionSummaryArg ? resolveFromRoot(rootDir, promotionSummaryArg) : null;
  const promotion = readJsonIfPresent<ProductionPromotionCandidateSummary>(promotionSummaryPath);
  const outputDir = resolveFromRoot(rootDir, options?.outputDir ?? arg('output-dir', DEFAULT_OUTPUT_DIR)!);
  const summaryPath = resolve(outputDir, 'summary.json');
  const readmePath = resolve(outputDir, 'README.md');
  const targetScope = options?.targetScope ?? normalizeTargetScope(arg('target-scope', env('ATTESTOR_PRODUCTION_GO_NO_GO_TARGET_SCOPE') ?? undefined));
  const providerRouteMode = options?.providerRouteMode ?? normalizeProviderRouteMode(arg('provider-route-mode', env('ATTESTOR_PRODUCTION_GO_NO_GO_PROVIDER_ROUTE_MODE') ?? undefined));
  const approvedBy = options?.approvedBy ?? arg('approved-by', env('ATTESTOR_PRODUCTION_GO_NO_GO_APPROVED_BY') ?? undefined) ?? null;
  const approvedAt = options?.approvedAt ?? arg('approved-at', env('ATTESTOR_PRODUCTION_GO_NO_GO_APPROVED_AT') ?? undefined) ?? null;
  const actorRef = digestReference('approval-actor', approvedBy);

  const gates = [
    promotionCandidateGate(promotion),
    rehearsalEvidenceGate(promotion),
    externalSignerGate(options?.externalSignerProofDigest ?? arg('external-signer-proof-digest', env('ATTESTOR_PRODUCTION_GO_NO_GO_EXTERNAL_SIGNER_PROOF_DIGEST') ?? undefined) ?? null),
    sharedStoreGate(promotion),
    customerPepGate(targetScope, options?.customerPepProofDigest ?? arg('customer-pep-proof-digest', env('ATTESTOR_PRODUCTION_GO_NO_GO_CUSTOMER_PEP_PROOF_DIGEST') ?? undefined) ?? null),
    providerRouteGate(providerRouteMode, options?.providerRouteProofDigest ?? arg('provider-route-proof-digest', env('ATTESTOR_PRODUCTION_GO_NO_GO_PROVIDER_ROUTE_PROOF_DIGEST') ?? undefined) ?? null),
    incidentRunbookGate(rootDir, options?.operatorRunbookPath ?? arg('operator-runbook', DEFAULT_RUNBOOK_PATH)!, promotion),
    humanApprovalGate(approvedBy, approvedAt),
  ] as const;

  const blockers = gates
    .filter((entry) => entry.required && entry.status !== 'pass')
    .flatMap((entry) => entry.blockers.map((blocker) => `${entry.id}:${blocker}`));
  const packet: ProductionGoNoGoPacket = {
    schemaVersion: 'attestor.production-go-no-go-packet.v1',
    generatedAt: new Date().toISOString(),
    targetScope,
    providerRouteMode,
    promotionCandidate: {
      summaryPath: promotionSummaryPath,
      loaded: Boolean(promotion),
      schemaVersion: promotion?.schemaVersion ?? null,
      rehearsalId: promotion?.rehearsalId ?? null,
      targetEnvironment: promotion?.targetEnvironment ?? null,
      source: promotion?.source ?? null,
      runtime: promotion?.runtime ?? null,
    },
    decision: {
      verdict: blockers.length === 0 ? 'go' : 'no-go',
      blockers,
      humanApproval: {
        actorRef,
        approvedAt: validIsoTimestamp(approvedAt) ? approvedAt : null,
        present: Boolean(actorRef && validIsoTimestamp(approvedAt)),
      },
    },
    gates,
    artifacts: {
      outputDir,
      summaryPath,
      readmePath,
    },
    limitations: [
      'This packet is target-bound and does not prove readiness for other environments.',
      'This packet does not replace independent security, compliance, or customer approval.',
      'Customer PEP traffic cutover is claimed only when targetScope is customer-enforcement and the PEP proof digest gate passes.',
      'Live LLM provider route readiness is claimed only when providerRouteMode is required and the provider route proof digest gate passes.',
      'A go verdict is an operator promotion decision for the named target, not a blanket production guarantee.',
    ],
  };

  mkdirSync(dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  writeFileSync(readmePath, renderReadme(packet), 'utf8');
  return packet;
}

async function main(): Promise<void> {
  const packet = await renderProductionGoNoGoPacket();
  console.log(stringifySecretSafe(packet));
  if (packet.decision.verdict !== 'go') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(safeErrorMessage(error));
    process.exit(1);
  });
}
