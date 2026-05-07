import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const failures = [];

function readText(...segments) {
  return readFileSync(join(repoRoot, ...segments), 'utf8').replace(/\r\n/gu, '\n');
}

function readJson(...segments) {
  return JSON.parse(readText(...segments));
}

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function packageNameFromLockPath(lockPath) {
  const marker = 'node_modules/';
  const index = lockPath.lastIndexOf(marker);
  if (index < 0) {
    return lockPath;
  }
  const tail = lockPath.slice(index + marker.length);
  const parts = tail.split('/');
  if (tail.startsWith('@')) {
    return `${parts[0]}/${parts[1] ?? ''}`;
  }
  return parts[0] ?? tail;
}

function stableJson(value) {
  if (!value || typeof value !== 'object') {
    return JSON.stringify(value ?? {});
  }
  return JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))),
  );
}

const packageJson = readJson('package.json');
const lock = readJson('package-lock.json');
const rootLockPackage = lock.packages?.[''];

assert(lock.lockfileVersion === 3, 'package-lock.json must remain lockfileVersion 3.');
assert(lock.name === packageJson.name, 'package-lock.json name must match package.json.');
assert(lock.version === packageJson.version, 'package-lock.json version must match package.json.');
assert(rootLockPackage?.version === packageJson.version, 'package-lock root package version must match package.json.');
assert(
  stableJson(rootLockPackage?.dependencies) === stableJson(packageJson.dependencies),
  'package-lock root dependencies must match package.json dependencies.',
);
assert(
  stableJson(rootLockPackage?.devDependencies) === stableJson(packageJson.devDependencies),
  'package-lock root devDependencies must match package.json devDependencies.',
);
assert(
  typeof packageJson.scripts?.['sbom:cyclonedx'] === 'string' &&
    packageJson.scripts['sbom:cyclonedx'].includes('npm sbom'),
  'package.json must expose a CycloneDX SBOM generation script.',
);

const allowedInstallScriptPackages = new Set([
  'esbuild',
  'fsevents',
  'msgpackr-extract',
  'protobufjs',
  'redis-memory-server',
]);

for (const [lockPath, entry] of Object.entries(lock.packages ?? {})) {
  if (!lockPath || !entry || typeof entry !== 'object') {
    continue;
  }

  if (entry.resolved) {
    assert(
      String(entry.resolved).startsWith('https://registry.npmjs.org/'),
      `Non-registry dependency resolution is not allowed in package-lock.json: ${lockPath}`,
    );
    assert(
      typeof entry.integrity === 'string' && entry.integrity.startsWith('sha512-'),
      `Registry dependency must carry sha512 integrity metadata: ${lockPath}`,
    );
  }

  if (entry.hasInstallScript) {
    const packageName = packageNameFromLockPath(lockPath);
    const allowed =
      packageName.startsWith('@embedded-postgres/') ||
      allowedInstallScriptPackages.has(packageName);

    assert(
      allowed,
      `Unexpected dependency install script. Review before allowing: ${lockPath}`,
    );
  }
}

const workflowDir = join(repoRoot, '.github', 'workflows');
const workflowFiles = readdirSync(workflowDir).filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'));

for (const workflowFile of workflowFiles) {
  const workflow = readText('.github', 'workflows', workflowFile);
  assert(!/\bpull_request_target\s*:/u.test(workflow), `${workflowFile} must not use pull_request_target.`);
  assert(/\npermissions:\n/u.test(`\n${workflow}`), `${workflowFile} must declare workflow or job permissions explicitly.`);
  assert(/\bcontents:\s*read\b/u.test(workflow), `${workflowFile} must keep repository contents permission read-only.`);
  assert(!/\bcontents:\s*write\b/u.test(workflow), `${workflowFile} must not request contents: write.`);

  if (/\battestations:\s*write\b/u.test(workflow) || /\bid-token:\s*write\b/u.test(workflow)) {
    assert(
      workflowFile === 'release-provenance.yml',
      `${workflowFile} must not request attestation or OIDC write permissions.`,
    );
  }

  if (/\bsecurity-events:\s*write\b/u.test(workflow)) {
    assert(workflowFile === 'codeql.yml', `${workflowFile} must not request security-events: write.`);
  }

  if (workflowFile === 'release-provenance.yml') {
    assert(
      workflow.includes('npm run sbom:cyclonedx') && workflow.includes('sbom.cyclonedx.json'),
      'release-provenance.yml must generate and package a CycloneDX SBOM.',
    );
  }

  const actionRefs = workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gmu);
  for (const match of actionRefs) {
    const actionRef = match[1] ?? '';
    if (actionRef.startsWith('./') || actionRef.startsWith('docker://')) {
      continue;
    }
    assert(
      /@[0-9a-f]{40}$/u.test(actionRef),
      `${workflowFile} must pin GitHub Actions by full commit SHA: ${actionRef}`,
    );
  }
}

if (failures.length > 0) {
  console.error('Supply-chain baseline failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Supply-chain baseline passed for ${Object.keys(lock.packages ?? {}).length} lockfile entries and ${workflowFiles.length} workflows.`);
