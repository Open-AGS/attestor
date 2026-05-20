import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function includes(haystack: string, needle: string, message: string): void {
  assert.ok(haystack.includes(needle), message);
  passed += 1;
}

function excludes(haystack: string, pattern: RegExp, message: string): void {
  assert.ok(!pattern.test(haystack), message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function run(): void {
  const registry = readProjectFile('docs', 'audit', 'audit-id-alias-registry.md');
  const lifecycle = readProjectFile('docs', 'audit', 'finding-lifecycle-and-evidence-ledger.md');
  const userStoreRecord = readProjectFile('docs', 'audit', 'AUD-2026-SVC-USERSTORE-001.md');
  const approvalStoreRecord = readProjectFile('docs', 'audit', 'AUD-2026-POL-APPROVALSTORE-001.md');
  const digestRemediation = readProjectFile('docs', 'audit', 'REM-2026-POL-DIGEST-001.md');
  const deployment = readProjectFile('docs', '08-deployment', 'deployment.md');

  includes(
    registry,
    'AUD-2026-SVC-OIDC-001',
    'Audit alias registry: hosted OIDC finding has canonical ID',
  );
  includes(
    registry,
    'AUD-2026-SVC-USERSTORE-001',
    'Audit alias registry: account user store limitation has canonical ID',
  );
  includes(
    registry,
    'AUD-2026-POL-BUNDLESIGN-001',
    'Audit alias registry: policy bundle signer limitation has canonical ID',
  );
  includes(
    registry,
    'AUD-2026-POL-APPROVALSTORE-001',
    'Audit alias registry: policy approval store limitation has canonical ID',
  );
  includes(
    registry,
    'AUD-2026-POL-APPROVALTTL-001',
    'Audit alias registry: policy approval TTL finding has canonical ID',
  );
  includes(
    registry,
    'AUD-2026-POL-DIGEST-001',
    'Audit alias registry: policy digest finding has canonical ID',
  );
  includes(
    registry,
    'Do not include auditor or model names in PR titles or bodies.',
    'Audit alias registry: PR naming excludes auditor/model names',
  );
  includes(
    lifecycle,
    'audit-id-alias-registry.md',
    'Audit lifecycle: canonical alias registry is linked',
  );
  includes(
    userStoreRecord,
    'Lifecycle state: accepted-limitation',
    'Account user store limitation: status is accepted-limitation',
  );
  includes(
    userStoreRecord,
    'ATTESTOR_CONTROL_PLANE_PG_URL',
    'Account user store limitation: shared control-plane requirement is documented',
  );
  includes(
    approvalStoreRecord,
    'Lifecycle state: accepted-limitation',
    'Policy approval store limitation: status is accepted-limitation',
  );
  includes(
    digestRemediation,
    'localeCompare',
    'Policy digest remediation: original locale-sensitive failure mode is documented',
  );
  includes(
    deployment,
    'Production-shared/public hosted deployments require the shared control-plane store',
    'Deployment docs: account user local JSON boundary is explicit',
  );
  excludes(
    registry,
    /\bOpus\b|\bClaude\b/iu,
    'Audit alias registry: auditor/model names are not used',
  );

  console.log(`Audit ID alias registry tests: ${passed} passed, 0 failed`);
}

run();
