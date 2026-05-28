import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  STRIPE_SUPPORTED_WEBHOOK_EVENTS,
  STRIPE_WEBHOOK_ROUTE,
} from '../src/service/billing/stripe/stripe-webhook-events.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function main(): void {
  const run = spawnSync(
    process.execPath,
    [
      resolve('node_modules/tsx/dist/cli.mjs'),
      'scripts/probe/probe-stripe-webhook-config.ts',
      '--print-required-events',
    ],
    {
      cwd: resolve('.'),
      encoding: 'utf8',
      env: {
        ...process.env,
        STRIPE_API_KEY: '',
        ATTESTOR_PUBLIC_HOSTNAME: 'api.attestor.example.invalid',
      },
    },
  );

  ok(run.status === 0, 'Stripe webhook probe: required-event manifest prints without Stripe API key');
  const manifest = JSON.parse(run.stdout) as {
    route: string;
    expectedUrl: string;
    requiredEvents: string[];
    note: string;
  };
  ok(manifest.route === STRIPE_WEBHOOK_ROUTE, 'Stripe webhook probe: manifest uses canonical route');
  ok(manifest.expectedUrl === `https://api.attestor.example.invalid${STRIPE_WEBHOOK_ROUTE}`, 'Stripe webhook probe: manifest derives hosted URL');
  ok(
    JSON.stringify(manifest.requiredEvents) === JSON.stringify([...STRIPE_SUPPORTED_WEBHOOK_EVENTS]),
    'Stripe webhook probe: manifest uses canonical event list',
  );
  ok(manifest.note.includes('run this probe without --print-required-events'), 'Stripe webhook probe: manifest includes follow-up verification instruction');

  console.log(`\nStripe webhook config probe tests: ${passed} passed, 0 failed`);
}

try {
  main();
} catch (error) {
  console.error('\nStripe webhook config probe tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
}
