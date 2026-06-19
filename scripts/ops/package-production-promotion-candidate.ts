import {
  createHash,
  createPublicKey,
} from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  canonicalize,
  signPayload,
} from '../../src/signing/sign.js';
import { derivePublicKeyIdentity } from '../../src/signing/keys.js';
import { renderReadme } from './production-promotion-candidate-readme.ts';
import type {
  ArtifactPathBoundary,
  ArtifactPathBoundaryReason,
  BundleSignature,
  DeniedArtifact,
  GoNoGoVerdict,
  IncludedArtifact,
  MissingArtifact,
  ProductionPromotionCandidateCheck,
  ProductionPromotionCandidateSummary,
  ProductionRehearsalManifest,
  ReadinessPacketSummary,
  RehearsalCommand,
} from './production-promotion-candidate-types.ts';

export type {
  ProductionPromotionCandidateCheck,
  ProductionPromotionCandidateSummary,
} from './production-promotion-candidate-types.ts';

const DEFAULT_MANIFEST_PATH = 'docs/08-deployment/production-rehearsal-manifest.example.json';
const DEFAULT_OUTPUT_DIR = '.attestor/rehearsal/gke-production-rehearsal/production-promotion-candidate';
const FINAL_COMMAND_ID = 'package-production-promotion-candidate';
const ARTIFACT_PATH_BOUNDARY: ArtifactPathBoundary = Object.freeze({
  policyVersion: 'attestor.production-promotion.artifact-path-boundary.v1',
  allowedRoots: Object.freeze([
    '.attestor/rehearsal',
    '.attestor/production-readiness',
    '.attestor/release-provenance',
  ]),
  denyAbsolutePaths: true,
  denyParentTraversal: true,
  denySymlinkArtifacts: true,
});
const REQUIRED_WORKFLOW_RUNS = [
  'evaluationSmoke',
  'fullVerify',
  'releaseProvenance',
  'productionRehearsal',
] as const;

function arg(name: string, fallback?: string): string | undefined {
  const prefixed = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefixed));
  if (found) return found.slice(prefixed.length);
  return fallback;
}

function pass(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionPromotionCandidateCheck {
  return { id, status: 'pass', detail, evidence };
}

function fail(
  id: string,
  detail: string,
  evidence?: unknown,
): ProductionPromotionCandidateCheck {
  return { id, status: 'fail', detail, evidence };
}

function sha256(buffer: Buffer | string): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function resolveFromRoot(rootDir: string, path: string): string {
  return isAbsolute(path) ? path : resolve(rootDir, path);
}

function containsParentTraversal(path: string): boolean {
  return path.split(/[\\/]+/u).some((segment) => segment === '..');
}

function isInsidePath(parentPath: string, candidatePath: string): boolean {
  const candidateRelative = relative(parentPath, candidatePath);
  return candidateRelative === ''
    || (!candidateRelative.startsWith('..') && !isAbsolute(candidateRelative));
}

function allowedArtifactRootPaths(rootDir: string): readonly string[] {
  return ARTIFACT_PATH_BOUNDARY.allowedRoots.map((allowedRoot) => {
    const resolved = resolve(rootDir, allowedRoot);
    return existsSync(resolved) ? realpathSync(resolved) : resolved;
  });
}

function artifactPathBoundaryDenial(
  rootDir: string,
  ref: {
    readonly id: string;
    readonly path: string;
    readonly required: boolean;
  },
): {
  readonly absolutePath: string;
  readonly deniedArtifact?: DeniedArtifact;
} {
  if (isAbsolute(ref.path)) {
    return {
      absolutePath: ref.path,
      deniedArtifact: {
        id: ref.id,
        path: ref.path,
        required: ref.required,
        reason: 'absolute-path-not-allowed',
        allowedRoots: ARTIFACT_PATH_BOUNDARY.allowedRoots,
      },
    };
  }

  if (containsParentTraversal(ref.path)) {
    return {
      absolutePath: resolve(rootDir, ref.path),
      deniedArtifact: {
        id: ref.id,
        path: ref.path,
        required: ref.required,
        reason: 'parent-traversal-not-allowed',
        allowedRoots: ARTIFACT_PATH_BOUNDARY.allowedRoots,
      },
    };
  }

  const absolutePath = resolve(rootDir, ref.path);
  const allowedRoots = allowedArtifactRootPaths(rootDir);
  if (!allowedRoots.some((allowedRoot) => isInsidePath(allowedRoot, absolutePath))) {
    return {
      absolutePath,
      deniedArtifact: {
        id: ref.id,
        path: ref.path,
        required: ref.required,
        reason: 'outside-allowed-artifact-roots',
        allowedRoots: ARTIFACT_PATH_BOUNDARY.allowedRoots,
      },
    };
  }

  if (existsSync(absolutePath)) {
    const lstat = lstatSync(absolutePath);
    if (lstat.isSymbolicLink()) {
      return {
        absolutePath,
        deniedArtifact: {
          id: ref.id,
          path: ref.path,
          required: ref.required,
          reason: 'symlink-artifact-not-allowed',
          allowedRoots: ARTIFACT_PATH_BOUNDARY.allowedRoots,
        },
      };
    }
    const realPath = realpathSync(absolutePath);
    if (!allowedRoots.some((allowedRoot) => isInsidePath(allowedRoot, realPath))) {
      return {
        absolutePath,
        deniedArtifact: {
          id: ref.id,
          path: ref.path,
          required: ref.required,
          reason: 'outside-allowed-artifact-roots',
          allowedRoots: ARTIFACT_PATH_BOUNDARY.allowedRoots,
        },
      };
    }
  }

  return { absolutePath };
}

function sourceFileBoundaryDenial(rootDir: string, sourceFile: string, ref: {
  readonly id: string;
  readonly path: string;
  readonly required: boolean;
}): DeniedArtifact | null {
  const allowedRoots = allowedArtifactRootPaths(rootDir);
  const lstat = lstatSync(sourceFile);
  if (lstat.isSymbolicLink()) {
    return {
      id: ref.id,
      path: relative(rootDir, sourceFile).replaceAll('\\', '/'),
      required: ref.required,
      reason: 'symlink-artifact-not-allowed',
      allowedRoots: ARTIFACT_PATH_BOUNDARY.allowedRoots,
    };
  }
  const realPath = realpathSync(sourceFile);
  if (!allowedRoots.some((allowedRoot) => isInsidePath(allowedRoot, realPath))) {
    return {
      id: ref.id,
      path: relative(rootDir, sourceFile).replaceAll('\\', '/'),
      required: ref.required,
      reason: 'outside-allowed-artifact-roots',
      allowedRoots: ARTIFACT_PATH_BOUNDARY.allowedRoots,
    };
  }
  return null;
}

function isPlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === ''
    || normalized === 'pending'
    || normalized === 'replace-with-run-id'
    || normalized === 'replace-with-target-name'
    || normalized === 'replace-with-region'
    || normalized === 'replace-with-cluster'
    || normalized === 'replace-with-hostname'
    || normalized === 'replace-with-operator'
    || normalized === '0000000'
    || normalized.startsWith('replace-with-');
}

function safeArtifactName(id: string, sourcePath: string): string {
  const suffix = basename(sourcePath).replace(/[^A-Za-z0-9._-]/gu, '_');
  const prefix = id.replace(/[^A-Za-z0-9._-]/gu, '_').slice(0, 56);
  return `${prefix}-${suffix}`.slice(0, 96);
}

function listFiles(path: string): readonly string[] {
  const stat = lstatSync(path);
  if (stat.isFile()) return [path];
  if (stat.isSymbolicLink()) return [path];
  if (!stat.isDirectory()) return [];
  return readdirSync(path)
    .flatMap((entry) => listFiles(join(path, entry)))
    .sort();
}

function finalEvidenceIds(manifest: ProductionRehearsalManifest): Set<string> {
  const finalCommands = manifest.commandPlan.filter((command) =>
    command.id === FINAL_COMMAND_ID
    || command.command.includes('package:production-promotion-candidate'));
  return new Set(finalCommands.flatMap((command) => command.evidenceIds));
}

function isFinalCommand(command: RehearsalCommand): boolean {
  return command.id === FINAL_COMMAND_ID
    || command.command.includes('package:production-promotion-candidate');
}

function collectArtifactReferences(
  manifest: ProductionRehearsalManifest,
  finalIds: Set<string>,
): readonly Array<{
  readonly id: string;
  readonly path: string;
  readonly required: boolean;
  readonly producer: string;
  readonly verification: string | null;
  readonly kind: string;
  readonly expectedDigest: string | null;
}> {
  const refs = new Map<string, {
    id: string;
    path: string;
    required: boolean;
    producer: string;
    verification: string | null;
    kind: string;
    expectedDigest: string | null;
  }>();

  for (const item of manifest.evidenceItems) {
    if (finalIds.has(item.id) || !item.artifactPath) continue;
    refs.set(`${item.id}:${item.artifactPath}`, {
      id: item.id,
      path: item.artifactPath,
      required: item.required,
      producer: item.producer,
      verification: item.verification ?? null,
      kind: item.kind,
      expectedDigest: item.digestSha256 ?? null,
    });
  }

  for (const command of manifest.commandPlan) {
    if (isFinalCommand(command)) continue;
    for (const artifactPath of command.expectedArtifacts ?? []) {
      refs.set(`${command.id}:${artifactPath}`, {
        id: command.id,
        path: artifactPath,
        required: command.required,
        producer: command.command,
        verification: `Expected artifact from ${command.id}`,
        kind: 'artifact',
        expectedDigest: null,
      });
    }
  }

  return [...refs.values()];
}

function copyReferencedArtifacts(
  rootDir: string,
  bundleDir: string,
  manifest: ProductionRehearsalManifest,
  finalIds: Set<string>,
): {
  readonly includedArtifacts: readonly IncludedArtifact[];
  readonly missingArtifacts: readonly MissingArtifact[];
  readonly deniedArtifacts: readonly DeniedArtifact[];
  readonly digestMismatches: readonly string[];
} {
  const artifactDir = resolve(bundleDir, 'artifacts');
  mkdirSync(artifactDir, { recursive: true });
  const includedArtifacts: IncludedArtifact[] = [];
  const missingArtifacts: MissingArtifact[] = [];
  const deniedArtifacts: DeniedArtifact[] = [];
  const digestMismatches: string[] = [];

  for (const ref of collectArtifactReferences(manifest, finalIds)) {
    const { absolutePath, deniedArtifact } = artifactPathBoundaryDenial(rootDir, ref);
    if (deniedArtifact) {
      deniedArtifacts.push(deniedArtifact);
      continue;
    }
    if (!existsSync(absolutePath)) {
      missingArtifacts.push({ id: ref.id, path: ref.path, required: ref.required });
      continue;
    }

    for (const sourceFile of listFiles(absolutePath)) {
      const fileDenial = sourceFileBoundaryDenial(rootDir, sourceFile, ref);
      if (fileDenial) {
        deniedArtifacts.push(fileDenial);
        continue;
      }
      const buffer = readFileSync(sourceFile);
      const digest = sha256(buffer);
      if (ref.expectedDigest && ref.expectedDigest !== digest) {
        digestMismatches.push(`${ref.id}: ${ref.path} expected ${ref.expectedDigest} but found ${digest}`);
      }
      const bundlePath = `artifacts/${safeArtifactName(ref.id, sourceFile)}`;
      copyFileSync(sourceFile, resolve(bundleDir, bundlePath));
      includedArtifacts.push({
        id: ref.id,
        sourcePath: relative(rootDir, sourceFile).replaceAll('\\', '/'),
        bundlePath,
        sha256: digest,
        bytes: buffer.byteLength,
        producer: ref.producer,
        verification: ref.verification,
        kind: ref.kind,
      });
    }
  }

  return { includedArtifacts, missingArtifacts, deniedArtifacts, digestMismatches };
}

function validateManifest(
  manifest: ProductionRehearsalManifest,
  finalIds: Set<string>,
): ProductionPromotionCandidateCheck[] {
  const checks: ProductionPromotionCandidateCheck[] = [];
  const targetValues = [
    manifest.targetEnvironment.name,
    manifest.targetEnvironment.provider,
    manifest.targetEnvironment.region,
    manifest.targetEnvironment.cluster,
    manifest.targetEnvironment.publicHostname,
    manifest.targetEnvironment.owner,
  ];
  checks.push(
    targetValues.some(isPlaceholder)
      ? fail('target-environment', 'Target environment identity still contains placeholders.', manifest.targetEnvironment)
      : pass('target-environment', 'Target environment identity is concrete.', manifest.targetEnvironment),
  );

  const commitOk = /^[a-f0-9]{7,40}$/u.test(manifest.source.commit) && !isPlaceholder(manifest.source.commit);
  checks.push(
    commitOk
      ? pass('source-commit', `Source commit is pinned to ${manifest.source.commit}.`)
      : fail('source-commit', 'Source commit is missing, placeholder, or not commit-shaped.', manifest.source),
  );

  const missingWorkflowRuns = REQUIRED_WORKFLOW_RUNS.filter((key) =>
    isPlaceholder(manifest.source.workflowRuns[key]));
  checks.push(
    missingWorkflowRuns.length === 0
      ? pass('workflow-runs', 'Required workflow run ids are populated.', manifest.source.workflowRuns)
      : fail('workflow-runs', `Missing or placeholder workflow run ids: ${missingWorkflowRuns.join(', ')}.`, manifest.source.workflowRuns),
  );

  checks.push(
    manifest.runtime.profile === 'production-shared'
      && manifest.runtime.requireSharedAuthority
      && manifest.runtime.noLocalFallback
      ? pass('runtime-contract', 'Runtime is production-shared with shared authority and no local fallback.')
      : fail('runtime-contract', 'Runtime must be production-shared, require shared authority, and block local fallback.', manifest.runtime),
  );

  checks.push(
    manifest.secretPosture.plaintextSecretsAllowed === false
      && manifest.secretPosture.redactedFields.length > 0
      ? pass('secret-posture', 'Secret posture is redacted/external and plaintext secrets are blocked.')
      : fail('secret-posture', 'Secret posture must block plaintext secrets and name redacted fields.', manifest.secretPosture),
  );

  const requiredEvidence = manifest.evidenceItems.filter((item) =>
    item.required && !finalIds.has(item.id));
  const nonPassingEvidence = requiredEvidence.filter((item) => item.status !== 'pass');
  checks.push(
    nonPassingEvidence.length === 0
      ? pass('required-evidence-status', 'All prerequisite required evidence items are pass.')
      : fail('required-evidence-status', `Required prerequisite evidence is not pass: ${nonPassingEvidence.map((item) => `${item.id}:${item.status}`).join(', ')}.`),
  );

  checks.push(
    manifest.goNoGo.verdict === 'pending'
      ? fail('manifest-go-no-go', 'Manifest go/no-go verdict is still pending.')
      : pass('manifest-go-no-go', `Manifest carries an explicit ${manifest.goNoGo.verdict} verdict.`),
  );

  return checks;
}

function readEnvironmentPacket(
  rootDir: string,
  manifest: ProductionRehearsalManifest,
): ProductionPromotionCandidateSummary['environmentPacket'] {
  const item = manifest.evidenceItems.find((entry) => entry.id === 'production-readiness-packet');
  if (!item?.artifactPath) {
    return {
      artifactPath: null,
      state: null,
      promotionGatePassed: null,
      issues: ['production-readiness-packet evidence item is missing.'],
      missingInputs: [],
    };
  }
  const path = resolveFromRoot(rootDir, item.artifactPath);
  if (!existsSync(path)) {
    return {
      artifactPath: item.artifactPath,
      state: null,
      promotionGatePassed: null,
      issues: [`Production readiness packet is missing at ${item.artifactPath}.`],
      missingInputs: [],
    };
  }
  const packet = readJsonFile<ReadinessPacketSummary>(path);
  return {
    artifactPath: item.artifactPath,
    state: packet.readiness?.state ?? null,
    promotionGatePassed: packet.readiness?.promotionGatePassed ?? null,
    issues: packet.readiness?.issues ?? [],
    missingInputs: packet.readiness?.missingInputs ?? [],
  };
}

function signingKeyPathFromOptions(options?: {
  readonly signingKeyPath?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}): string | null {
  const env = options?.env ?? process.env;
  const value = options?.signingKeyPath
    ?? arg('signing-key', env.ATTESTOR_PRODUCTION_PROMOTION_SIGNING_PRIVATE_KEY_PATH);
  return value && value.trim() ? value.trim() : null;
}

function tarHeader(name: string, size: number): Buffer {
  if (Buffer.byteLength(name) > 100) {
    throw new Error(`Tar path is too long for the built-in production bundle writer: ${name}`);
  }
  const header = Buffer.alloc(512, 0);
  header.write(name, 0, 100, 'utf8');
  header.write('0000644\0', 100, 8, 'ascii');
  header.write('0000000\0', 108, 8, 'ascii');
  header.write('0000000\0', 116, 8, 'ascii');
  header.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
  header.write('00000000000\0', 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header.write('0', 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return header;
}

function createTarGz(sourceDir: string, outputPath: string): void {
  const chunks: Buffer[] = [];
  for (const filePath of listFiles(sourceDir)) {
    const name = relative(sourceDir, filePath).replaceAll('\\', '/');
    const body = readFileSync(filePath);
    chunks.push(tarHeader(name, body.byteLength));
    chunks.push(body);
    const padding = (512 - (body.byteLength % 512)) % 512;
    if (padding > 0) chunks.push(Buffer.alloc(padding, 0));
  }
  chunks.push(Buffer.alloc(1024, 0));
  writeFileSync(outputPath, gzipSync(Buffer.concat(chunks), { level: 9 }));
}

function createSignedAttestation(params: {
  readonly archivePath: string;
  readonly archiveSha256: string;
  readonly archiveBytes: number;
  readonly summary: Omit<ProductionPromotionCandidateSummary, 'attestation' | 'artifacts'>;
  readonly signingKeyPath: string;
}): {
  readonly attestation: BundleSignature;
  readonly publicKeyPem: string;
} {
  const privateKeyPem = readFileSync(params.signingKeyPath, 'utf8');
  const publicKeyPem = createPublicKey(privateKeyPem).export({
    type: 'spki',
    format: 'pem',
  }) as string;
  const identity = derivePublicKeyIdentity(publicKeyPem);
  const body = {
    type: 'attestor.production-promotion.attestation.v1' as const,
    subject: {
      name: basename(params.archivePath),
      path: params.archivePath,
      sha256: params.archiveSha256,
      bytes: params.archiveBytes,
    },
    predicate: {
      rehearsalId: params.summary.rehearsalId,
      source: params.summary.source,
      targetEnvironment: params.summary.targetEnvironment,
      runtime: params.summary.runtime,
      goNoGo: params.summary.goNoGo,
      includedArtifactCount: params.summary.evidence.includedArtifacts.length,
      limitations: params.summary.limitations,
    },
  };
  const payload = canonicalize(body);
  return {
    publicKeyPem,
    attestation: {
      ...body,
      signing: {
        algorithm: 'ed25519',
        publicKey: identity.publicKeyHex,
        fingerprint: identity.fingerprint,
        payloadSha256: sha256(payload),
        signature: signPayload(payload, privateKeyPem),
      },
    },
  };
}

export async function packageProductionPromotionCandidate(options?: {
  readonly rootDir?: string;
  readonly manifestPath?: string;
  readonly outputDir?: string;
  readonly signingKeyPath?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}): Promise<ProductionPromotionCandidateSummary> {
  const rootDir = resolve(options?.rootDir ?? process.cwd());
  const manifestPath = resolveFromRoot(rootDir, options?.manifestPath ?? arg('manifest', DEFAULT_MANIFEST_PATH)!);
  const outputDir = resolveFromRoot(rootDir, options?.outputDir ?? arg('output-dir', DEFAULT_OUTPUT_DIR)!);
  const bundleDir = resolve(outputDir, 'bundle');
  const archivePath = resolve(outputDir, 'production-promotion-candidate.tar.gz');
  const archiveSha256Path = `${archivePath}.sha256`;
  const summaryPath = resolve(outputDir, 'summary.json');
  const readmePath = resolve(outputDir, 'README.md');
  const bundleManifestPath = resolve(bundleDir, 'production-promotion-candidate.json');
  const attestationPath = resolve(outputDir, 'production-promotion-attestation.json');
  const publicKeyPath = resolve(outputDir, 'production-promotion-public-key.pem');
  const signingKeyPath = signingKeyPathFromOptions(options);
  const signingKeyReady = Boolean(signingKeyPath && existsSync(resolveFromRoot(rootDir, signingKeyPath)));

  mkdirSync(bundleDir, { recursive: true });
  const manifest = readJsonFile<ProductionRehearsalManifest>(manifestPath);
  const finalIds = finalEvidenceIds(manifest);
  const checks = validateManifest(manifest, finalIds);
  const artifactResult = copyReferencedArtifacts(rootDir, bundleDir, manifest, finalIds);
  const environmentPacket = readEnvironmentPacket(rootDir, manifest);

  checks.push(
    artifactResult.deniedArtifacts.length === 0
      ? pass('artifact-path-boundary', 'All manifest artifact paths stayed inside the promotion evidence allowlist.', ARTIFACT_PATH_BOUNDARY)
      : fail('artifact-path-boundary', `Denied artifact paths: ${artifactResult.deniedArtifacts.map((item) => `${item.id}:${item.reason}`).join(', ')}`, artifactResult.deniedArtifacts),
  );
  checks.push(
    artifactResult.missingArtifacts.filter((item) => item.required).length === 0
      ? pass('required-artifacts-present', 'All required prerequisite artifacts are present.')
      : fail('required-artifacts-present', `Missing required artifacts: ${artifactResult.missingArtifacts.filter((item) => item.required).map((item) => `${item.id}:${item.path}`).join(', ')}.`),
  );
  checks.push(
    artifactResult.digestMismatches.length === 0
      ? pass('artifact-digests', 'Artifact digests were computed without mismatch.')
      : fail('artifact-digests', `Artifact digest mismatches: ${artifactResult.digestMismatches.join('; ')}`),
  );
  checks.push(
    environmentPacket.state === 'ready-for-environment-promotion'
      && environmentPacket.promotionGatePassed === true
      ? pass('environment-packet', 'Production readiness packet is ready for environment promotion.', environmentPacket)
      : fail('environment-packet', 'Production readiness packet is missing or not ready for environment promotion.', environmentPacket),
  );
  checks.push(
    signingKeyReady
      ? pass('local-signing-key', 'Production promotion signing key is present.')
      : fail('local-signing-key', 'ATTESTOR_PRODUCTION_PROMOTION_SIGNING_PRIVATE_KEY_PATH or --signing-key is required to sign the bundle.'),
  );

  const requiredEvidence = manifest.evidenceItems.filter((item) =>
    item.required && !finalIds.has(item.id));
  const blockers = checks
    .filter((check) => check.status === 'fail')
    .map((check) => `${check.id}: ${check.detail}`);
  if (manifest.goNoGo.verdict === 'no-go') {
    blockers.push('manifest-go-no-go: manifest explicitly records no-go.');
  }

  const verdict: GoNoGoVerdict = blockers.length === 0 && manifest.goNoGo.verdict === 'go'
    ? 'go'
    : 'no-go';
  const limitations = [
    ...manifest.nonClaims,
    'This bundle is a target-bound production-promotion candidate, not market validation.',
    'This bundle is not a blanket production guarantee for other environments.',
    'This bundle does not replace independent security, compliance, or operator approval.',
    'GitHub artifact attestation is only claimed after a GitHub Actions attestation verifies this exact archive.',
  ];

  const summaryWithoutAttestation = {
    schemaVersion: 'attestor.production-promotion-candidate.v1' as const,
    generatedAt: new Date().toISOString(),
    rehearsalId: manifest.rehearsalId,
    targetEnvironment: manifest.targetEnvironment,
    source: manifest.source,
    runtime: manifest.runtime,
    environmentPacket,
    commandPlan: manifest.commandPlan,
    evidence: {
      requiredCount: requiredEvidence.length,
      passingRequiredCount: requiredEvidence.filter((item) => item.status === 'pass').length,
      finalEvidenceIds: [...finalIds],
      includedArtifacts: artifactResult.includedArtifacts,
      missingArtifacts: artifactResult.missingArtifacts,
      deniedArtifacts: artifactResult.deniedArtifacts,
      digestMismatches: artifactResult.digestMismatches,
    },
    artifactPathBoundary: ARTIFACT_PATH_BOUNDARY,
    checks,
    goNoGo: {
      verdict,
      manifestVerdict: manifest.goNoGo.verdict,
      blockers,
      notes: manifest.goNoGo.notes,
    },
    limitations,
  };

  writeJson(resolve(bundleDir, 'input-manifest.json'), manifest);
  writeJson(bundleManifestPath, summaryWithoutAttestation);
  writeFileSync(resolve(bundleDir, 'README.md'), renderReadme({
    ...summaryWithoutAttestation,
    artifacts: {
      outputDir,
      bundleDir,
      summaryPath,
      readmePath,
      bundleManifestPath,
      archivePath,
      archiveSha256Path,
      attestationPath: signingKeyReady ? attestationPath : null,
      publicKeyPath: signingKeyReady ? publicKeyPath : null,
    },
    attestation: {
      localSignature: null,
      githubVerificationCommand: 'gh attestation verify production-promotion-candidate.tar.gz -R AI-gateway-systems/attestor --signer-workflow AI-gateway-systems/attestor/.github/workflows/release-provenance.yml',
      nonClaim: 'GitHub artifact attestation is not produced by the local packager.',
    },
  }), 'utf8');

  createTarGz(bundleDir, archivePath);
  const archiveBuffer = readFileSync(archivePath);
  const archiveDigest = sha256(archiveBuffer);
  writeFileSync(archiveSha256Path, `${archiveDigest}  ${basename(archivePath)}\n`, 'utf8');

  let localSignature: BundleSignature | null = null;
  let publicKeyPem: string | null = null;
  if (signingKeyReady && signingKeyPath) {
    const signed = createSignedAttestation({
      archivePath,
      archiveSha256: archiveDigest,
      archiveBytes: archiveBuffer.byteLength,
      summary: summaryWithoutAttestation,
      signingKeyPath: resolveFromRoot(rootDir, signingKeyPath),
    });
    localSignature = signed.attestation;
    publicKeyPem = signed.publicKeyPem;
    writeJson(attestationPath, localSignature);
    writeFileSync(publicKeyPath, publicKeyPem, 'utf8');
  }

  const summary: ProductionPromotionCandidateSummary = {
    ...summaryWithoutAttestation,
    artifacts: {
      outputDir,
      bundleDir,
      summaryPath,
      readmePath,
      bundleManifestPath,
      archivePath,
      archiveSha256Path,
      attestationPath: localSignature ? attestationPath : null,
      publicKeyPath: publicKeyPem ? publicKeyPath : null,
    },
    attestation: {
      localSignature,
      githubVerificationCommand: 'gh attestation verify production-promotion-candidate.tar.gz -R AI-gateway-systems/attestor --signer-workflow AI-gateway-systems/attestor/.github/workflows/release-provenance.yml',
      nonClaim: 'The local packager creates an Attestor Ed25519 attestation. GitHub artifact attestation is only claimed after a GitHub Actions attestation verifies this exact archive.',
    },
  };

  writeJson(summaryPath, summary);
  writeFileSync(readmePath, renderReadme(summary), 'utf8');
  return summary;
}

async function main(): Promise<void> {
  const summary = await packageProductionPromotionCandidate();
  console.log(`Production promotion candidate bundle: ${summary.goNoGo.verdict}`);
  console.log(`Summary: ${summary.artifacts.summaryPath}`);
  console.log(`Archive: ${summary.artifacts.archivePath}`);
  if (summary.artifacts.attestationPath) {
    console.log(`Attestation: ${summary.artifacts.attestationPath}`);
  }
  if (summary.goNoGo.verdict !== 'go') {
    for (const blocker of summary.goNoGo.blockers) {
      console.error(`- ${blocker}`);
    }
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
