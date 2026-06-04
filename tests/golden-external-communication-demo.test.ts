import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenExternalCommunicationDemoSummary,
  renderGoldenExternalCommunicationDemoJson,
  renderGoldenExternalCommunicationDemoMarkdown,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

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

function testSummaryComposesGoldenPath(): void {
  const summary = createGoldenExternalCommunicationDemoSummary();

  equal(summary.version, 'attestor.golden-external-communication-demo.v1', 'E04 summary: version is explicit');
  equal(summary.step, 'E04', 'E04 summary: step is explicit');
  equal(summary.actionSurface, 'external_communication.customer_message', 'E04 summary: action surface is external communication');
  equal(summary.domain, 'external-communication', 'E04 summary: domain is external communication');
  equal(summary.scenarioCount, 8, 'E04 summary: scenario count is fixed');
  equal(summary.candidateMode, 'review', 'E04 summary: candidate mode is review');
  equal(summary.namedGaps.length, 7, 'E04 summary: seven named gaps are shown');
  equal(summary.readinessVerdict, 'ready-for-shadow-pilot', 'E04 summary: readiness verdict is shadow-pilot ready');
  equal(summary.readinessBlockers.length, 0, 'E04 summary: readiness blockers are empty');
  equal(summary.markdownPrimary, true, 'E04 summary: markdown is primary');
  equal(summary.jsonSecondary, true, 'E04 summary: JSON is secondary');
  equal(summary.shadowOnly, true, 'E04 summary: shadow-only is true');
  equal(summary.fixtureOnly, true, 'E04 summary: fixture-only is true');
  equal(summary.previewOnly, true, 'E04 summary: preview-only is true');
  equal(summary.noTargetSystemCall, true, 'E04 summary: no target-system call');
  equal(summary.noMessageDelivery, true, 'E04 summary: no message delivery');
  equal(summary.noProviderCall, true, 'E04 summary: no provider call');
  equal(summary.noCrmOrTicketingCall, true, 'E04 summary: no CRM/ticketing call');
  equal(summary.noAuditWrite, true, 'E04 summary: no audit write');
  equal(summary.noPolicyActivation, true, 'E04 summary: no policy activation');
  equal(summary.canAdmit, false, 'E04 summary: cannot admit');
  equal(summary.productionReady, false, 'E04 summary: production readiness is false');
  ok(/^sha256:[a-f0-9]{64}$/u.test(summary.digest), 'E04 summary: digest is canonical');
}

function testMarkdownAndJsonRenderers(): void {
  const summary = createGoldenExternalCommunicationDemoSummary();
  const markdown = renderGoldenExternalCommunicationDemoMarkdown(summary);
  const json = renderGoldenExternalCommunicationDemoJson(summary);
  const parsed = JSON.parse(json) as { readonly version: string; readonly digest: string };

  for (const expected of [
    '# Golden Path: External Communication',
    'Verdict: ready-for-shadow-pilot',
    '## Business Contrast',
    'Without Attestor in this repo path:',
    'With Attestor in this repo path:',
    '0 message deliveries',
    '0 provider calls',
    'external_communication.customer_message',
    'outbound-promise-needs-authority',
    'legal-claim-without-authority',
    'recipient-tenant-mismatch',
    'public-claim-overclaim',
    'commercial-email-control-gap',
    'instruction-like-ticket-review',
    'duplicate-send-replay',
    'It does not send email',
  ]) {
    includes(markdown, expected, `E04 markdown: records ${expected}`);
  }

  equal(parsed.version, 'attestor.golden-external-communication-demo.v1', 'E04 JSON: version is explicit');
  equal(parsed.digest, summary.digest, 'E04 JSON: digest matches summary');
  excludes(markdown, /@[a-z0-9.-]+\.[a-z]{2,}/iu, 'E04 markdown: no raw email address is rendered');
  excludes(json, /"providerBody"\s*:|"crmPayload"\s*:|"ticketBody"\s*:|"messageBody"\s*:/iu, 'E04 JSON: no raw provider/message material fields are rendered');
  excludes(json, /"rawRecipient"\s*:|"rawCustomer"\s*:|"emailAddress"\s*:|"phoneNumber"\s*:|"customerName"\s*:/iu, 'E04 JSON: no raw recipient/customer fields are rendered');
}

function testPackageScriptRunsMarkdownAndJson(): void {
  const markdown = spawnSync(
    'npm',
    ['run', 'demo:golden-external-communication'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  const json = spawnSync(
    'npm',
    ['run', 'demo:golden-external-communication', '--', '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  equal(markdown.status, 0, 'E04 package script: markdown command exits cleanly');
  equal(json.status, 0, 'E04 package script: JSON command exits cleanly');
  includes(markdown.stdout, '# Golden Path: External Communication', 'E04 package script: markdown is default');
  includes(markdown.stdout, 'Verdict: ready-for-shadow-pilot', 'E04 package script: markdown includes verdict');
  includes(json.stdout, '"version": "attestor.golden-external-communication-demo.v1"', 'E04 package script: JSON flag emits JSON');
  includes(json.stdout, '"readinessVerdict": "ready-for-shadow-pilot"', 'E04 package script: JSON includes verdict');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-external-communication-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const readme = readProjectFile('README.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Status: complete. E01-E04 are repository-side only.',
    'Progress after E04 lands: 4/4 complete. 0 steps remain.',
    '| E04 | complete once merged | Demo CLI and reviewer sandbox |',
    'npm run demo:golden-external-communication',
    'Markdown-first local demo',
    'JSON as secondary machine output',
  ]) {
    includes(doc, expected, `E04 doc: records ${expected}`);
  }

  includes(
    ledger,
    'External Communication Golden Path E04',
    'E04 ledger: records demo CLI and reviewer sandbox',
  );
  includes(
    readme,
    '[Run the local evaluation path](docs/01-overview/demo-guide.md)',
    'E04 README: links the local evaluation guide',
  );
  equal(
    packageJson.scripts['demo:golden-external-communication'],
    'tsx scripts/demo/demo-golden-external-communication.ts',
    'E04 package script: demo command is registered',
  );
  equal(
    packageJson.scripts['test:golden-external-communication-demo'],
    'tsx tests/golden-external-communication-demo.test.ts',
    'E04 package script: targeted demo test is registered',
  );
}

testSummaryComposesGoldenPath();
testMarkdownAndJsonRenderers();
testPackageScriptRunsMarkdownAndJson();
testDocsAndScriptsStayAligned();

console.log(`golden-external-communication-demo: ${passed} assertions passed`);
