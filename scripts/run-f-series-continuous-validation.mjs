import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = join(fileURLToPath(new URL('..', import.meta.url)));

const SUPPORTING_SECURITY_AND_REPLAY_SCRIPTS = [
  'test:action-surface-onboarding-red-team-fixtures',
  'test:policy-foundry-red-team-replay',
  'test:policy-foundry-adversarial-replay-executor',
  'test:policy-foundry-live-downstream-replay',
  'test:failure-mode-registry',
  'test:failure-mode-guard-coverage',
  'test:failure-mode-replay-fixtures',
  'test:agentic-supply-chain-guard',
  'test:decision-context-drift-binding',
  'test:security-baseline-docs',
  'test:package-script-runner',
  'test:audit-remediation-tracker',
  'test:research-provenance-ledger',
];

function readPackageJson(root = rootDir) {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
}

function naturalCompare(left, right) {
  return left.localeCompare(right, 'en', { numeric: true });
}

function isFSeriesValidationScript(scriptName) {
  return /^test:f(?:\d|inal-)/u.test(scriptName);
}

export function resolveFSeriesContinuousValidationScripts(root = rootDir) {
  const packageJson = readPackageJson(root);
  const scriptNames = new Set(
    Object.keys(packageJson.scripts ?? {})
      .filter((scriptName) => isFSeriesValidationScript(scriptName)),
  );

  for (const scriptName of SUPPORTING_SECURITY_AND_REPLAY_SCRIPTS) {
    if (typeof packageJson.scripts?.[scriptName] !== 'string') {
      throw new Error(`Required continuous validation script is missing: ${scriptName}`);
    }
    scriptNames.add(scriptName);
  }

  return [...scriptNames]
    .sort(naturalCompare)
    .map((scriptName) => ({
      label: scriptName,
      command: `npm run ${scriptName}`,
    }));
}

export function runFSeriesContinuousValidation(root = rootDir) {
  const commands = resolveFSeriesContinuousValidationScripts(root);
  console.log(`[f-series-continuous-validation] ${commands.length} commands`);

  for (const [index, item] of commands.entries()) {
    const ordinal = `${index + 1}/${commands.length}`.padStart(7);
    console.log(`\n[f-series-continuous-validation] ${ordinal} ${item.label}`);
    const result = spawnSync(item.command, {
      cwd: root,
      shell: true,
      stdio: 'inherit',
      env: process.env,
    });

    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--list')) {
    for (const item of resolveFSeriesContinuousValidationScripts()) {
      console.log(item.label);
    }
  } else {
    runFSeriesContinuousValidation();
  }
}
