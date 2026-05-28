import { pathToFileURL } from 'node:url';

import {
  DEFAULT_OPENAI_LIVE_SMOKE_MAX_OUTPUT_TOKENS,
  DEFAULT_OPENAI_LIVE_SMOKE_PROOF_MAX_AGE_MINUTES,
  OPENAI_LIVE_SMOKE_EXPECTED_OUTPUT,
  OPENAI_LIVE_SMOKE_PROOF_ENV,
  OPENAI_LIVE_SMOKE_PROOF_VERSION,
  runOpenAiLiveSmokeProof,
} from '../../src/api/openai.js';
import {
  safeErrorMessage,
  stringifySecretSafe,
} from '../secret-safe-output.ts';

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function requiredOpenAiLiveSmokeManifest() {
  return Object.freeze({
    version: OPENAI_LIVE_SMOKE_PROOF_VERSION,
    requiredCredentialEnv: 'OPENAI_API_KEY',
    probeCommand: 'npm run probe:openai-live-smoke',
    runtimeGateEnv: OPENAI_LIVE_SMOKE_PROOF_ENV,
    defaultMaxAgeMinutes: DEFAULT_OPENAI_LIVE_SMOKE_PROOF_MAX_AGE_MINUTES,
    requestContract: Object.freeze({
      expectedOutput: OPENAI_LIVE_SMOKE_EXPECTED_OUTPUT,
      maxOutputTokens: DEFAULT_OPENAI_LIVE_SMOKE_MAX_OUTPUT_TOKENS,
      responseStore: false,
      sdkMaxRetries: 0,
      rawPromptStored: false,
      rawProviderBodyStored: false,
    }),
    note: 'Run the probe in an explicit live environment, then copy the printed runtimeGateValues into that deployment environment if production-like OpenAI calls should be allowed.',
  });
}

async function main(): Promise<void> {
  if (flag('print-required-env')) {
    console.log(JSON.stringify(requiredOpenAiLiveSmokeManifest(), null, 2));
    return;
  }

  const proof = await runOpenAiLiveSmokeProof();
  console.log(stringifySecretSafe({
    ...proof,
    runtimeGateValues: {
      [OPENAI_LIVE_SMOKE_PROOF_ENV.digest]: proof.proofDigest,
      [OPENAI_LIVE_SMOKE_PROOF_ENV.checkedAt]: proof.checkedAt,
      [OPENAI_LIVE_SMOKE_PROOF_ENV.model]: proof.configuredModel,
      [OPENAI_LIVE_SMOKE_PROOF_ENV.purpose]: proof.purpose,
    },
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  });
}
