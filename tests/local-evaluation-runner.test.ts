import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LOCAL_EVALUATION_RUNNER_VERSION,
  runLocalEvaluation,
} from '../scripts/demo/evaluate-local.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function readArtifact(root: string, name: string): string {
  return readFileSync(join(root, name), 'utf8');
}

function withTempOutput<T>(fn: (outputDir: string) => T): T {
  const outputDir = mkdtempSync(join(tmpdir(), 'attestor-local-evaluation-'));
  try {
    return fn(outputDir);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

function testRunnerWritesExpectedArtifacts(): void {
  withTempOutput((outputDir) => {
    const result = runLocalEvaluation({ outputDir });

    equal(result.version, LOCAL_EVALUATION_RUNNER_VERSION, 'Local evaluation: version is explicit');
    equal(result.command, 'npm run evaluate:local', 'Local evaluation: command is stable');
    equal(result.artifactRoot, '[custom-output-dir]', 'Local evaluation: custom output path is not exposed');
    equal(result.artifacts.length, 5, 'Local evaluation: five artifacts are written');
    equal(result.localOnly, true, 'Local evaluation: local-only boundary is explicit');
    equal(result.repoSideOnly, true, 'Local evaluation: repo-side-only boundary is explicit');
    equal(result.shadowOnly, true, 'Local evaluation: shadow-only boundary is explicit');
    equal(result.fixtureOnly, true, 'Local evaluation: fixture-only boundary is explicit');
    equal(result.noTargetSystemCalls, true, 'Local evaluation: target-system calls are excluded');
    equal(result.productionReady, false, 'Local evaluation: production readiness stays false');
    equal(result.enterpriseReady, false, 'Local evaluation: enterprise readiness stays false');

    for (const expected of [
      'summary.md',
      'decision-trail.json',
      'refund-golden-path.md',
      'refund-golden-path.json',
      'boundary.md',
    ]) {
      ok(
        result.artifacts.some((artifact) => artifact.name === expected),
        `Local evaluation: artifact is present: ${expected}`,
      );
      includes(
        readArtifact(outputDir, expected),
        expected.endsWith('.json') ? '"version"' : '#',
        `Local evaluation: artifact has content: ${expected}`,
      );
    }
  });
}

function testArtifactsStayUsefulAndNoClaimed(): void {
  withTempOutput((outputDir) => {
    runLocalEvaluation({ outputDir });

    const summary = readArtifact(outputDir, 'summary.md');
    const decisionTrail = readArtifact(outputDir, 'decision-trail.json');
    const boundary = readArtifact(outputDir, 'boundary.md');
    const trail = JSON.parse(decisionTrail) as {
      readonly version: string;
      readonly productionReady: boolean;
      readonly enterpriseReady: boolean;
      readonly goldenPaths: {
        readonly pathCount: number;
        readonly readyPathCount: number;
      };
      readonly firstPath: {
        readonly actionSurface: string;
        readonly readinessVerdict: string;
      };
    };

    includes(summary, '# Attestor Local Evaluation', 'Local evaluation summary: has clear title');
    includes(summary, 'proposed action', 'Local evaluation summary: explains proposed action');
    includes(summary, 'Attestor checks', 'Local evaluation summary: explains checks');
    includes(summary, 'reason codes', 'Local evaluation summary: explains reason-code output');
    includes(summary, 'digest-bound proof references', 'Local evaluation summary: explains proof refs');
    includes(summary, '# Attestor Golden Paths Evaluator', 'Local evaluation summary: embeds aggregate evaluator');
    includes(boundary, 'review material only', 'Local evaluation boundary: review-only wording is explicit');
    includes(boundary, 'It does not call Stripe, Shopify', 'Local evaluation boundary: no provider call wording is explicit');
    includes(boundary, 'no customer PEP no-bypass proof', 'Local evaluation boundary: no customer PEP proof claim');
    includes(boundary, 'no production readiness claim', 'Local evaluation boundary: no production claim');
    equal(trail.version, LOCAL_EVALUATION_RUNNER_VERSION, 'Local evaluation trail: version is explicit');
    equal(trail.productionReady, false, 'Local evaluation trail: production readiness is false');
    equal(trail.enterpriseReady, false, 'Local evaluation trail: enterprise readiness is false');
    equal(trail.goldenPaths.pathCount, 6, 'Local evaluation trail: indexes all six golden paths');
    equal(trail.goldenPaths.readyPathCount, 6, 'Local evaluation trail: records local review readiness');
    equal(trail.firstPath.actionSurface, 'refund_service.issue_refund', 'Local evaluation trail: first path is refund');
    equal(trail.firstPath.readinessVerdict, 'ready-for-shadow-pilot', 'Local evaluation trail: first path verdict is visible');
    excludes(summary, /\bproduction ready\b|\benterprise ready\b/iu, 'Local evaluation summary: does not use ready overclaim wording');
    excludes(decisionTrail, /"rawPayload"\s*:|"providerBody"\s*:|"walletMaterial"\s*:|"customerEmail"\s*:|"paymentIntentId"\s*:|"stripeChargeId"\s*:/iu, 'Local evaluation trail: no raw sensitive fields');
  });
}

function testPackageScriptRunsAndRegisters(): void {
  withTempOutput((outputDir) => {
    const markdown = spawnSync(
      'npm',
      ['run', 'evaluate:local', '--', '--output-dir', outputDir],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: process.platform === 'win32',
      },
    );
    const json = spawnSync(
      'npm',
      ['run', 'evaluate:local', '--', '--json', '--output-dir', outputDir],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: process.platform === 'win32',
      },
    );
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      readonly scripts: Readonly<Record<string, string>>;
    };

    equal(markdown.status, 0, 'Local evaluation package script: markdown command exits cleanly');
    equal(json.status, 0, 'Local evaluation package script: JSON command exits cleanly');
    includes(markdown.stdout, '# Attestor Local Evaluation', 'Local evaluation package script: markdown has title');
    includes(markdown.stdout, 'Wrote 5 local evaluation artifacts', 'Local evaluation package script: markdown reports artifacts');
    includes(json.stdout, `"version": "${LOCAL_EVALUATION_RUNNER_VERSION}"`, 'Local evaluation package script: JSON has version');
    includes(json.stdout, '"productionReady": false', 'Local evaluation package script: JSON keeps production false');
    equal(
      packageJson.scripts['evaluate:local'],
      'tsx scripts/demo/evaluate-local.ts',
      'Local evaluation package script: command is registered',
    );
    equal(
      packageJson.scripts['test:local-evaluation-runner'],
      'tsx tests/local-evaluation-runner.test.ts',
      'Local evaluation package script: test is registered',
    );
  });
}

testRunnerWritesExpectedArtifacts();
testArtifactsStayUsefulAndNoClaimed();
testPackageScriptRunsAndRegisters();

console.log(`local-evaluation-runner: ${passed} assertions passed`);
