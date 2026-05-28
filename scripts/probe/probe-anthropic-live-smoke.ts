import { pathToFileURL } from 'node:url';

import {
  ANTHROPIC_LIVE_SMOKE_EXPECTED_OUTPUT,
  ANTHROPIC_LIVE_SMOKE_PROOF_ENV,
  ANTHROPIC_LIVE_SMOKE_PROOF_VERSION,
  DEFAULT_ANTHROPIC_LIVE_SMOKE_MAX_OUTPUT_TOKENS,
  DEFAULT_ANTHROPIC_LIVE_SMOKE_PROOF_MAX_AGE_MINUTES,
  runAnthropicLiveSmokeProof,
} from '../../src/api/anthropic.js';
import {
  safeErrorMessage,
  stringifySecretSafe,
} from '../secret-safe-output.ts';

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function requiredAnthropicLiveSmokeManifest() {
  return Object.freeze({
    version: ANTHROPIC_LIVE_SMOKE_PROOF_VERSION,
    requiredCredentialEnv: 'ANTHROPIC_API_KEY',
    probeCommand: 'npm run probe:anthropic-live-smoke',
    runtimeGateEnv: ANTHROPIC_LIVE_SMOKE_PROOF_ENV,
    defaultMaxAgeMinutes: DEFAULT_ANTHROPIC_LIVE_SMOKE_PROOF_MAX_AGE_MINUTES,
    requestContract: Object.freeze({
      expectedOutput: ANTHROPIC_LIVE_SMOKE_EXPECTED_OUTPUT,
      maxOutputTokens: DEFAULT_ANTHROPIC_LIVE_SMOKE_MAX_OUTPUT_TOKENS,
      apiVersion: '2023-06-01',
      transportMaxRetries: 0,
      rawPromptStored: false,
      rawProviderBodyStored: false,
    }),
    note: 'Run the probe in an explicit live environment, then copy the printed runtimeGateValues into that deployment environment if production-like Anthropic calls should be allowed.',
  });
}

async function main(): Promise<void> {
  if (flag('print-required-env')) {
    console.log(JSON.stringify(requiredAnthropicLiveSmokeManifest(), null, 2));
    return;
  }

  const proof = await runAnthropicLiveSmokeProof();
  console.log(stringifySecretSafe({
    ...proof,
    runtimeGateValues: {
      [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.digest]: proof.proofDigest,
      [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.checkedAt]: proof.checkedAt,
      [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.model]: proof.configuredModel,
      [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.purpose]: proof.purpose,
    },
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  });
}
