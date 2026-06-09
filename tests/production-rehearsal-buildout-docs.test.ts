import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
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

function testTrackerIsLinkedFromCurrentTruthSources(): void {
  const readme = readProjectFile('README.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const productionReadiness = readProjectFile('docs', '08-deployment', 'production-readiness.md');

  includes(
    readme,
    '[Repository navigator](docs/01-overview/repository-navigator.md)',
    'Production rehearsal docs: README links the repository navigator',
  );
  includes(
    systemOverview,
    '[Production rehearsal buildout](production-rehearsal-buildout.md)',
    'Production rehearsal docs: system overview names the active rehearsal track',
  );
  includes(
    productionReadiness,
    '../02-architecture/production-rehearsal-buildout.md',
    'Production rehearsal docs: production readiness guide links the new tracker',
  );
}

function testTrackerFreezesTheProductionRehearsalScope(): void {
  const tracker = readProjectFile(
    'docs',
    '02-architecture',
    'production-rehearsal-buildout.md',
  );

  includes(
    tracker,
    'not to add a new product, a new crypto branch, or another architecture story',
    'Production rehearsal docs: tracker blocks scope widening',
  );
  includes(
    tracker,
    'Keep Attestor as one product with one platform core and modular packs.',
    'Production rehearsal docs: tracker preserves one-product framing',
  );
  includes(
    tracker,
    'Do not add a new hosted crypto route as part of production rehearsal work.',
    'Production rehearsal docs: tracker blocks hosted crypto route widening',
  );
  includes(
    tracker,
    'Treat `v0.2.0-evaluation` as an attested evaluation baseline, not a production launch.',
    'Production rehearsal docs: tracker preserves evaluation release truth',
  );
  includes(
    tracker,
    'repo-proven embedded PostgreSQL behavior is not the same as external customer-operated production readiness',
    'Production rehearsal docs: tracker distinguishes repo proof from external production proof',
  );
  includes(
    tracker,
    '| Total frozen steps | 10 |',
    'Production rehearsal docs: tracker freezes the 10-step count',
  );
  includes(
    tracker,
    '| Completed | 10 |',
    'Production rehearsal docs: tracker marks Steps 01 through 10 complete',
  );
  includes(
    tracker,
    '| Not started | 0 |',
    'Production rehearsal docs: tracker has no remaining frozen steps',
  );
}

function testFrozenStepsStayOrderedAndHonest(): void {
  const tracker = readProjectFile(
    'docs',
    '02-architecture',
    'production-rehearsal-buildout.md',
  );

  const steps = [
    '| 01 | complete | Define the production rehearsal scope, success rubric, and non-claims |',
    '| 02 | complete | Define the rehearsal manifest and evidence schema |',
    '| 03 | complete | Add the one-command rehearsal planner |',
    '| 04 | complete | Bind rehearsal to a concrete target environment profile |',
    '| 05 | complete | Prove external substrate readiness |',
    '| 06 | complete | Rehearse core fail-closed consequence behavior |',
    '| 07 | complete | Rehearse queue, worker, and async recovery |',
    '| 08 | complete | Rehearse backup, restore, and DR |',
    '| 09 | complete | Rehearse observability, alerting, and operator runbooks |',
    '| 10 | complete | Package the v0.2 production-promotion candidate evidence bundle |',
  ];

  for (const step of steps) {
    includes(
      tracker,
      step,
      `Production rehearsal docs: frozen step is present: ${step}`,
    );
  }

  includes(
    tracker,
    'The production rehearsal buildout is complete at the repository level.',
    'Production rehearsal docs: immediate next step moves to target-run execution',
  );
  excludes(
    tracker,
    /hosted public SaaS launch is ready|external customer-operated production is ready|market validation is complete/i,
    'Production rehearsal docs: tracker avoids production and market overclaims',
  );
}

function testExistingProductionDocsRemainTruthful(): void {
  const productionReadiness = readProjectFile('docs', '08-deployment', 'production-readiness.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');

  includes(
    productionReadiness,
    'The current repository proves `single-node-durable` restart recovery and proves `production-shared` shared authority behavior under embedded PostgreSQL',
    'Production rehearsal docs: production readiness keeps repo-proof boundary explicit',
  );
  includes(
    productionReadiness,
    'It does not claim your external PostgreSQL, Redis, Kubernetes, secret, DNS, TLS, observability, or billing environment is production-ready',
    'Production rehearsal docs: production readiness keeps external environment boundary explicit',
  );
  includes(
    systemOverview,
    'real-environment evidence, not just repo-embedded PostgreSQL proof',
    'Production rehearsal docs: system overview names the real-environment evidence goal',
  );
}

testTrackerIsLinkedFromCurrentTruthSources();
testTrackerFreezesTheProductionRehearsalScope();
testFrozenStepsStayOrderedAndHonest();
testExistingProductionDocsRemainTruthful();

console.log(`production-rehearsal-buildout-docs.test.ts: ${passed} assertions passed`);
