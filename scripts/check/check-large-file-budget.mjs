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
]);

const CODE_EXTENSIONS = Object.freeze([
  '.cjs',
  '.js',
  '.mjs',
  '.ts',
  '.tsx',
]);

const HARD_LIMIT_REGISTRY = Object.freeze([
  { path: 'src/service/control-plane-store.ts', maxLines: 3415, reason: 'P2 store-family split in progress; schema, PG helpers, mapper helpers, pipeline idempotency, and admin state extracted; compatibility facade must keep shrinking.' },
  { path: 'tests/live-api.test.ts', maxLines: 3408, reason: 'P2 live API test matrix; split by live surface after route/runtime priorities are stable.' },
  { path: 'src/service/http/routes/shadow-routes.ts', maxLines: 2504, reason: 'P2 route-family split in progress; summary/dashboard/audit and simulation/history routes extracted while route ordering and shadow mutation behavior remain under dedicated coverage.' },
  { path: 'src/service/http/routes/account-routes.ts', maxLines: 2588, reason: 'P2 route-family split planned; account auth/session/MFA/user flows require route-matrix coverage.' },
  { path: 'tests/generic-admission-mode-ladder.test.ts', maxLines: 1861, reason: 'P2 admission-mode matrix; split only after guard route matrix stays stable.' },
  { path: 'src/crypto-authorization-core/modular-account-adapters.ts', maxLines: 1836, reason: 'P4 protocol adapter exception; split only by coherent adapter helper boundaries.' },
  { path: 'src/crypto-authorization-core/x402-agentic-payment-adapter.ts', maxLines: 1796, reason: 'P4 protocol adapter exception; x402 behavior is trust-sensitive and should split only with focused tests.' },
  { path: 'src/service/http/routes/release-policy-control-routes.ts', maxLines: 1679, reason: 'P2 route-family split planned after shadow/account route splits prove the route split pattern.' },
  { path: 'tests/financial.test.ts', maxLines: 1674, reason: 'P2 financial test matrix; split by pipeline/filing/reporting scenarios when finance work resumes.' },
  { path: 'src/crypto-authorization-core/erc4337-user-operation-adapter.ts', maxLines: 1664, reason: 'P4 protocol adapter exception; ERC-4337 behavior should split only along canonical adapter checks.' },
  { path: 'src/crypto-authorization-core/custody-cosigner-policy-adapter.ts', maxLines: 1635, reason: 'P4 protocol adapter exception; custody policy behavior should split only with adapter-negative tests.' },
  { path: 'src/crypto-authorization-core/eip7702-delegation-adapter.ts', maxLines: 1634, reason: 'P4 protocol adapter exception; EIP-7702 delegated-scope work should be a focused PR.' },
  { path: 'src/crypto-authorization-core/policy-gap-narrowing.ts', maxLines: 1624, reason: 'P4 crypto policy helper exception; split only when the policy-gap contract is otherwise changing.' },
  { path: 'src/release-enforcement-plane/envoy-ext-authz.ts', maxLines: 1598, reason: 'P4 enforcement adapter exception; Envoy bridge behavior is route-risk-class sensitive.' },
  { path: 'src/crypto-authorization-core/intelligence-dashboard-summary.ts', maxLines: 1583, reason: 'P4 crypto intelligence summary exception; split only with dashboard-summary golden coverage.' },
  { path: 'src/service/http/routes/admin-routes.ts', maxLines: 1579, reason: 'P2 route-family split planned after route split pattern is proven; admin auth remains high authority.' },
  { path: 'src/crypto-execution-admission/delegated-eoa.ts', maxLines: 1445, reason: 'P4 crypto execution adapter exception; delegated EOA semantics are trust-sensitive.' },
  { path: 'src/crypto-execution-admission/adapter-readiness-manifest.ts', maxLines: 1375, reason: 'P4 crypto execution manifest exception; split only with platform-surface tests.' },
  { path: 'src/financial/types.ts', maxLines: 1372, reason: 'P1/P2 type split candidate; financial type groups should split when finance pipeline work resumes.' },
  { path: 'src/service/application/stripe-webhook-billing-processor.ts', maxLines: 1352, reason: 'P2 billing processor split candidate; Stripe billing behavior requires provider-specific tests.' },
  { path: 'src/crypto-execution-admission/conformance-fixtures.ts', maxLines: 1336, reason: 'P4 conformance fixture registry exception; split only if fixture families move with tests.' },
  { path: 'src/release-kernel/release-evidence-pack.ts', maxLines: 1322, reason: 'P4 release evidence pack exception; proof material split needs canonicalization and DSSE tests.' },
  { path: 'src/release-enforcement-plane/async-envelope.ts', maxLines: 1305, reason: 'P4 enforcement-envelope exception; split only with async envelope verifier coverage.' },
  { path: 'tests/generic-admission-routes.test.ts', maxLines: 1298, reason: 'P2 route test matrix; split after generic admission route fixture helpers are stable.' },
  { path: 'src/crypto-authorization-core/approval-allowance-consequence.ts', maxLines: 1292, reason: 'P4 crypto authorization exception; split only with allowance/consequence behavioral coverage.' },
  { path: 'src/service/bootstrap/release-runtime.ts', maxLines: 1288, reason: 'P2 bootstrap split candidate; release runtime wiring needs production-shared tests before moving.' },
  { path: 'src/crypto-execution-admission/intent-solver.ts', maxLines: 1258, reason: 'P4 crypto execution adapter exception; intent solver route binding is trust-sensitive.' },
  { path: 'src/service/billing/billing-event-ledger.ts', maxLines: 1242, reason: 'P2 billing ledger split candidate; ledger behavior needs billing-event tests before moving.' },
  { path: 'src/service/shadow/shadow-persistence-store.ts', maxLines: 1241, reason: 'P2 shadow store split candidate; persistence behavior needs route/store tests before moving.' },
  { path: 'src/service/bootstrap/release-tenant-signer-boundary.ts', maxLines: 1217, reason: 'P2 bootstrap split candidate; tenant signer boundary needs release signing tests before moving.' },
  { path: 'src/consequence-admission/general-crypto-transaction-gate.ts', maxLines: 1211, reason: 'P4 crypto gate exception; general crypto gate should split only with crypto gate golden tests.' },
  { path: 'src/crypto-authorization-core/intelligence-risk-signals.ts', maxLines: 1208, reason: 'P4 crypto intelligence exception; risk signal split needs dashboard/risk-signal tests.' },
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

function hasCodeExtension(path) {
  return CODE_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function isScannedPath(path) {
  return SCANNED_ROOTS.some((root) => path.startsWith(root)) && hasCodeExtension(path);
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

const registryByPath = new Map(HARD_LIMIT_REGISTRY.map((entry) => [entry.path, entry]));
const duplicateRegistry = duplicateRegistryPaths(HARD_LIMIT_REGISTRY);
const staleRegistry = HARD_LIMIT_REGISTRY
  .filter((entry) => !files.some((file) => file.file === entry.path))
  .map((entry) => entry.path);

const overTarget = files.filter((file) => file.lines > TARGET_LINES);
const overHardLimit = files.filter((file) => file.lines > HARD_LIMIT_LINES);
const unregisteredHardLimitFiles = overHardLimit.filter((file) => !registryByPath.has(file.file));
const grownRegisteredFiles = overHardLimit.filter((file) => {
  const entry = registryByPath.get(file.file);
  return entry && file.lines > entry.maxLines;
});

const failures = [];
if (duplicateRegistry.length > 0) {
  failures.push('Duplicate large-file registry entries:');
  failures.push(...duplicateRegistry.map((path) => `- ${path}`));
}
if (staleRegistry.length > 0) {
  failures.push('Stale large-file registry entries:');
  failures.push(...staleRegistry.map((path) => `- ${path}`));
}
if (unregisteredHardLimitFiles.length > 0) {
  failures.push(`Files above ${HARD_LIMIT_LINES} lines without a registry entry:`);
  failures.push(...unregisteredHardLimitFiles.map((file) => `- ${file.file} (${file.lines})`));
}
if (grownRegisteredFiles.length > 0) {
  failures.push('Registered large files grew past their locked maxLines:');
  failures.push(...grownRegisteredFiles.map((file) => {
    const entry = registryByPath.get(file.file);
    return `- ${file.file} (${file.lines} > ${entry.maxLines})`;
  }));
}

if (failures.length > 0) {
  console.error('Large-file budget check failed.');
  console.error(failures.join('\n'));
  console.error(`\nTarget: <= ${TARGET_LINES} lines. Hard limit: ${HARD_LIMIT_LINES} lines unless explicitly registered.`);
  process.exit(1);
}

console.log(`Large-file budget: ${files.length} files scanned.`);
console.log(`Large-file budget: ${overTarget.length} files above target (${TARGET_LINES} lines).`);
console.log(`Large-file budget: ${overHardLimit.length} registered files above hard limit (${HARD_LIMIT_LINES} lines).`);
console.log('Large-file budget: 0 unregistered hard-limit files, 0 registered growth violations.');
console.log('Largest files:');
for (const file of files.slice(0, 10)) {
  console.log(`- ${file.file}: ${file.lines}`);
}
