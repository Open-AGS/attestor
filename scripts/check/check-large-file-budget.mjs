#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const TARGET_LINES = 800;
const HARD_LIMIT_LINES = 1200;

const SCANNED_ROOTS = Object.freeze([
  'src/',
  'tests/',
  'scripts/',
  'examples/',
  'docs/',
  'fixtures/',
]);

const TEXT_EXTENSIONS = Object.freeze([
  '.cjs',
  '.js',
  '.mjs',
  '.ts',
  '.tsx',
  '.md',
  '.json',
  '.yaml',
  '.yml',
]);

const EXCLUDED_PREFIXES = Object.freeze([
  'docs/assets/',
  'vendor/',
]);

const EXCLUDED_PATHS = Object.freeze(new Set([
  'package-lock.json',
]));

const REASONS = Object.freeze({
  billingSplitTarget: 'temporary billing split target; move-only ledger extraction must preserve event ordering, dedupe, and export parity.',
  bootstrapSplitTarget: 'temporary bootstrap split target; split only with runtime/bootstrap boundary tests.',
  conformanceFixture: 'large conformance fixture exception; split only when fixture families move with conformance tests.',
  consequenceAdmission: 'temporary consequence-admission split target; split only with guard, package-surface, or golden parity tests.',
  cryptoAuthorization: 'crypto authorization protocol surface; split only with adapter-specific negative and package-surface tests.',
  cryptoExecution: 'crypto execution adapter or conformance surface; split only with adapter-specific conformance tests.',
  generatedOpenApi: 'generated OpenAPI contract exception; split source contracts instead of hand-editing generated JSON.',
  largeDocument: 'temporary documentation split target; split by stable architecture sections without weakening no-claim language.',
  largeScript: 'temporary script split target; split collection, assertion, and rendering phases without changing CLI output.',
  largeTest: 'temporary test split target; split scenario families while keeping the package script and assertions stable.',
  proofSurface: 'proof-surface exception; split only with proof scenario and artifact parity tests.',
  providerAdapter: 'provider adapter surface; split only with runtime policy, timeout, redaction, and fake-client tests.',
  releaseEnforcement: 'release enforcement surface; split only with verifier, replay, signing, or route-risk parity tests.',
  releaseKernel: 'release kernel proof or queue surface; split only with canonicalization, DSSE, or queue parity tests.',
  researchLedger: 'research provenance ledger exception; split only by append-stable ledger volumes with citation tests.',
  routeSplitTarget: 'temporary route split target; move-only route-family extraction must preserve auth, status, headers, and audit behavior.',
  storeSplitTarget: 'temporary store split target; extraction must preserve snapshots, shared-store behavior, tenant scope, and backup parity.',
  temporarySplitTarget: 'temporary split target; must not grow while queued for responsibility-based extraction.',
});

const OVERSIZE_FILE_REGISTRY = Object.freeze([
  { path: 'docs/api/attestor-action-authorization.openapi.json', maxLines: 1978, reason: REASONS.generatedOpenApi },
  { path: 'fixtures/crypto-execution-admission/conformance-fixtures.v1.json', maxLines: 1692, reason: REASONS.conformanceFixture },
  { path: 'docs/research/attestor-research-provenance-ledger.md', maxLines: 1525, reason: REASONS.researchLedger },
  { path: 'docs/02-architecture/consequence-runtime-assurance-overview.md', maxLines: 1255, reason: REASONS.largeDocument },
]);

function normalizePath(path) {
  return path.replaceAll('\\', '/');
}

function trackedFiles() {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split(/\r?\n/u)
    .map(normalizePath)
    .filter(Boolean);
}

function hasTextExtension(path) {
  return TEXT_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function isExcludedPath(path) {
  return EXCLUDED_PATHS.has(path) || EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isScannedPath(path) {
  return !isExcludedPath(path)
    && SCANNED_ROOTS.some((root) => path.startsWith(root))
    && hasTextExtension(path);
}

function countLines(path) {
  const material = readFileSync(path, 'utf8')
    .replace(/\r\n/gu, '\n')
    .replace(/\r/gu, '\n');
  if (material.length === 0) return 0;
  const withoutFinalTerminator = material.endsWith('\n') ? material.slice(0, -1) : material;
  if (withoutFinalTerminator.length === 0) return 1;
  return withoutFinalTerminator.split('\n').length;
}

function duplicateRegistryPaths(registry) {
  const seen = new Set();
  const duplicates = [];
  for (const entry of registry) {
    if (seen.has(entry.path)) duplicates.push(entry.path);
    seen.add(entry.path);
  }
  return duplicates;
}

const files = trackedFiles()
  .filter(isScannedPath)
  .map((file) => ({ file, lines: countLines(file) }))
  .sort((left, right) => right.lines - left.lines || left.file.localeCompare(right.file));

const filesByPath = new Map(files.map((file) => [file.file, file]));
const registryByPath = new Map(OVERSIZE_FILE_REGISTRY.map((entry) => [entry.path, entry]));
const duplicateRegistry = duplicateRegistryPaths(OVERSIZE_FILE_REGISTRY);
const staleRegistry = OVERSIZE_FILE_REGISTRY
  .filter((entry) => {
    const file = filesByPath.get(entry.path);
    return !file || file.lines <= TARGET_LINES;
  })
  .map((entry) => entry.path);

const overTarget = files.filter((file) => file.lines > TARGET_LINES);
const overHardLimit = files.filter((file) => file.lines > HARD_LIMIT_LINES);
const unregisteredTargetFiles = overTarget.filter((file) => !registryByPath.has(file.file));
const grownRegisteredFiles = overTarget.filter((file) => {
  const entry = registryByPath.get(file.file);
  return entry && file.lines > entry.maxLines;
});

const failures = [];
if (duplicateRegistry.length > 0) {
  failures.push('Duplicate large-file registry entries:');
  failures.push(...duplicateRegistry.map((path) => `- ${path}`));
}
if (staleRegistry.length > 0) {
  failures.push(`Stale registry entries at or below ${TARGET_LINES} lines:`);
  failures.push(...staleRegistry.map((path) => `- ${path}`));
}
if (unregisteredTargetFiles.length > 0) {
  failures.push(`Files above ${TARGET_LINES} lines without a registry entry:`);
  failures.push(...unregisteredTargetFiles.map((file) => `- ${file.file} (${file.lines})`));
}
if (grownRegisteredFiles.length > 0) {
  failures.push('Registered oversized files grew past their locked maxLines:');
  failures.push(...grownRegisteredFiles.map((file) => {
    const entry = registryByPath.get(file.file);
    return `- ${file.file} (${file.lines} > ${entry.maxLines})`;
  }));
}

if (failures.length > 0) {
  console.error('Large-file budget check failed.');
  console.error(failures.join('\n'));
  console.error(`\nTarget: <= ${TARGET_LINES} lines. Exceptions above target must be registered and must not grow.`);
  process.exit(1);
}

console.log(`Large-file budget: ${files.length} files scanned.`);
console.log(`Large-file budget: ${overTarget.length} registered files above target (${TARGET_LINES} lines).`);
console.log(`Large-file budget: ${overHardLimit.length} registered files above hard limit (${HARD_LIMIT_LINES} lines).`);
console.log('Large-file budget: 0 unregistered over-target files, 0 registered growth violations.');
console.log('Largest files:');
for (const file of files.slice(0, 10)) {
  console.log(`- ${file.file}: ${file.lines}`);
}
