import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8').replace(/\r\n/gu, '\n');
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

function matches(content: string, expected: RegExp, message: string): void {
  assert.match(content, expected, message);
  passed += 1;
}

function testSecurityPolicyExplainsEvaluationBoundary(): void {
  const security = readProjectFile('SECURITY.md');

  includes(security, '# Security Policy', 'Security baseline: policy title is stable');
  includes(security, 'v0.2.0-evaluation', 'Security baseline: current evaluation release is named');
  includes(security, 'evaluation pre-release', 'Security baseline: evaluation status is explicit');
  includes(security, 'not a production-use guarantee', 'Security baseline: production guarantee is not overstated');
  includes(security, 'release decisions, tokens, and enforcement behavior in this repository', 'Security baseline: in-scope surface is explicit');
  includes(security, 'hosted service availability or SLA claims', 'Security baseline: out-of-scope surface is explicit');
}

function testSecurityPolicyKeepsReportingPathHonest(): void {
  const security = readProjectFile('SECURITY.md');
  const securityTxt = readProjectFile('.well-known', 'security.txt');

  includes(security, 'Use GitHub private vulnerability reporting for this repository if it is enabled in repository settings.', 'Security baseline: preferred private reporting route is documented honestly');
  includes(security, 'The repository also publishes `/.well-known/security.txt`', 'Security baseline: security.txt entry point is documented');
  includes(security, 'Do not post exploit details, secrets, proof-of-concept payloads, or reproduction steps in a public GitHub issue.', 'Security baseline: public disclosure guard is explicit');
  includes(security, 'Open a minimal public issue only to request a private reporting path', 'Security baseline: fallback reporting path does not overclaim a private inbox');
  includes(security, 'acknowledge: 48 hours', 'Security baseline: vulnerability acknowledgement target is documented');
  includes(security, 'initial triage: 7 days', 'Security baseline: vulnerability triage target is documented');
  includes(security, 'high or critical repository-side fix target: 90 days', 'Security baseline: high/critical fix target is documented');
  includes(security, 'medium or low repository-side fix target: 180 days', 'Security baseline: medium/low fix target is documented');
  includes(security, 'not a cash-reward promise', 'Security baseline: no paid bounty overclaim is explicit');
  includes(securityTxt, 'Contact: https://github.com/AI-gateway-systems/attestor/security/advisories/new', 'Security baseline: security.txt contact points to private advisory flow');
  includes(securityTxt, 'Policy: https://github.com/AI-gateway-systems/attestor/blob/master/SECURITY.md', 'Security baseline: security.txt points to SECURITY.md');
  includes(securityTxt, 'Preferred-Languages: en, hu', 'Security baseline: security.txt language preference is explicit');
  matches(securityTxt, /^Expires: 2027-05-15T00:00:00Z$/mu, 'Security baseline: security.txt expiry is explicit');
}

function testReadmePinsReviewerAndSecurityEntry(): void {
  const readme = readProjectFile('README.md');

  includes(readme, 'Start review with:', 'Security baseline: README pins reviewer entry near the top');
  includes(readme, '[Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md)', 'Security baseline: README links the evaluation packet near the top');
  includes(readme, '[Security Policy](SECURITY.md)', 'Security baseline: README links the security policy');
  includes(readme, '[Evaluation Smoke workflow](.github/workflows/evaluation-smoke.yml)', 'Security baseline: README links the current CI reviewer path');
  includes(readme, '[Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md)', 'Security baseline: README links the provenance plan');
}

function testCurrentReviewerWorkflowsStayReadOnly(): void {
  const smoke = readProjectFile('.github', 'workflows', 'evaluation-smoke.yml');
  const verify = readProjectFile('.github', 'workflows', 'full-verify.yml');
  const securityScan = readProjectFile('.github', 'workflows', 'security-scan.yml');
  const fSeries = readProjectFile('.github', 'workflows', 'f-series-continuous-validation.yml');

  includes(smoke, 'permissions:\n  contents: read', 'Security baseline: evaluation smoke stays read-only');
  includes(verify, 'permissions:\n  contents: read', 'Security baseline: full verify stays read-only');
  includes(securityScan, 'permissions:\n  contents: read', 'Security baseline: security scan stays read-only');
  includes(fSeries, 'permissions:\n  contents: read', 'Security baseline: F-series continuous validation stays read-only');
  includes(fSeries, 'npm run audit:f-series-continuous-validation', 'Security baseline: F-series continuous validation runs the secretless audit runner');
  excludes(smoke, /attestations:\s*write/iu, 'Security baseline: evaluation smoke must not yet request attestation write');
  excludes(smoke, /id-token:\s*write/iu, 'Security baseline: evaluation smoke must not yet request id-token write');
  excludes(verify, /attestations:\s*write/iu, 'Security baseline: full verify must not yet request attestation write');
  excludes(verify, /id-token:\s*write/iu, 'Security baseline: full verify must not yet request id-token write');
  excludes(securityScan, /attestations:\s*write/iu, 'Security baseline: security scan must not request attestation write');
  excludes(securityScan, /id-token:\s*write/iu, 'Security baseline: security scan must not request id-token write');
  excludes(securityScan, /pull-requests:\s*write/iu, 'Security baseline: dependency review must not write PR comments');
  excludes(fSeries, /attestations:\s*write/iu, 'Security baseline: F-series workflow must not request attestation write');
  excludes(fSeries, /id-token:\s*write/iu, 'Security baseline: F-series workflow must not request id-token write');
  excludes(fSeries, /contents:\s*write/iu, 'Security baseline: F-series workflow must not request contents write');
}

function testSupplyChainSecurityGatesStayPresent(): void {
  const security = readProjectFile('SECURITY.md');
  const securityScan = readProjectFile('.github', 'workflows', 'security-scan.yml');
  const codeql = readProjectFile('.github', 'workflows', 'codeql.yml');
  const dependabot = readProjectFile('.github', 'dependabot.yml');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly engines: Readonly<Record<string, string>>;
  };

  includes(security, 'Supply Chain Scanning', 'Security baseline: supply-chain scanning is documented');
  includes(security, 'npm run security:supply-chain-baseline', 'Security baseline: supply-chain baseline guard is documented');
  includes(security, 'blocks lockfile drift, non-registry dependency resolutions, missing registry integrity metadata, unexpected dependency install scripts, non-SHA-pinned GitHub Actions, missing release SBOM packaging, and workflow permission regressions', 'Security baseline: supply-chain guard scope is documented');
  includes(security, 'The install-script allowlist is intentionally narrow.', 'Security baseline: install-script allowlist is documented');
  includes(security, 'npm run security:audit-high', 'Security baseline: npm high/critical audit is documented');
  includes(security, 'SHA-pinned `actions/dependency-review-action`', 'Security baseline: dependency review action is documented as SHA-pinned');
  includes(security, 'CodeQL JavaScript/TypeScript analysis', 'Security baseline: CodeQL coverage is documented');
  includes(security, 'Release provenance artifacts include a CycloneDX SBOM', 'Security baseline: release provenance SBOM is documented');
  includes(security, 'The runtime and type baseline is Node 22', 'Security baseline: Node runtime/type baseline is documented');
  includes(security, '`@types/node` semver-major updates are ignored', 'Security baseline: Node type major guard is documented');
  includes(security, 'moderate `uuid` advisories', 'Security baseline: remaining moderate advisory is documented honestly');

  includes(securityScan, 'name: Security Scan', 'Security baseline: security scan workflow title is stable');
  includes(securityScan, 'supply-chain-baseline:', 'Security baseline: security scan runs the supply-chain baseline job');
  includes(securityScan, 'npm run security:supply-chain-baseline', 'Security baseline: security scan runs the supply-chain baseline guard');
  includes(securityScan, 'npm run security:audit-high', 'Security baseline: security scan runs npm audit gate');
  matches(securityScan, /uses: actions\/dependency-review-action@[0-9a-f]{40}/u, 'Security baseline: dependency review action is pinned by full SHA');
  includes(securityScan, 'fail-on-severity: high', 'Security baseline: dependency review blocks high and critical advisories');
  includes(securityScan, 'comment-summary-in-pr: never', 'Security baseline: dependency review avoids PR write permission');

  includes(codeql, 'name: CodeQL', 'Security baseline: CodeQL workflow title is stable');
  includes(codeql, 'security-events: write', 'Security baseline: CodeQL upload permission is explicit');
  matches(codeql, /uses: github\/codeql-action\/init@[0-9a-f]{40}/u, 'Security baseline: CodeQL init action is pinned by full SHA');
  includes(codeql, 'languages: javascript-typescript', 'Security baseline: CodeQL scans JavaScript and TypeScript');
  includes(codeql, 'queries: security-extended', 'Security baseline: CodeQL uses security-extended queries');

  includes(dependabot, 'version: 2', 'Security baseline: Dependabot config uses current syntax');
  includes(dependabot, 'package-ecosystem: "npm"', 'Security baseline: Dependabot tracks npm dependencies');
  includes(dependabot, 'package-ecosystem: "github-actions"', 'Security baseline: Dependabot tracks GitHub Actions dependencies');
  includes(dependabot, 'package-ecosystem: "docker"', 'Security baseline: Dependabot tracks Docker base image dependencies');
  includes(dependabot, 'timezone: "Europe/Budapest"', 'Security baseline: Dependabot schedule has explicit timezone');
  includes(dependabot, 'dependency-name: "@types/node"', 'Security baseline: Dependabot has an explicit Node types major guard');
  includes(dependabot, 'update-types:', 'Security baseline: Dependabot constrains update types where required');
  includes(dependabot, '"version-update:semver-major"', 'Security baseline: Dependabot ignores Node type semver-major updates');

  assert.equal(
    packageJson.engines.node,
    '>=22 <23',
    'Security baseline: package.json does not overclaim runtime major compatibility beyond Node 22',
  );
  passed += 1;
}

function testReleaseProvenanceWorkflowKeepsElevatedPermissionsScoped(): void {
  const workflow = readProjectFile('.github', 'workflows', 'release-provenance.yml');

  includes(workflow, 'name: Release Provenance', 'Security baseline: release provenance workflow title is stable');
  includes(workflow, 'workflow_dispatch:', 'Security baseline: release provenance supports manual dispatch');
  includes(workflow, 'tags:', 'Security baseline: release provenance is tag-triggered');
  includes(workflow, '- "v*-evaluation"', 'Security baseline: release provenance only targets evaluation tags');
  includes(workflow, 'contents: read', 'Security baseline: release provenance keeps contents read-only');
  includes(workflow, 'attestations: write', 'Security baseline: release provenance has attestation permission');
  includes(workflow, 'id-token: write', 'Security baseline: release provenance has OIDC permission');
  matches(workflow, /uses: actions\/attest@[0-9a-f]{40}/u, 'Security baseline: release provenance attest action is pinned by full SHA');
  includes(workflow, 'npm run proof:surface', 'Security baseline: release provenance renders proof surface');
  includes(workflow, 'npm run showcase:proof', 'Security baseline: release provenance renders the offline-capable proof showcase');
  includes(workflow, 'npm run sbom:cyclonedx', 'Security baseline: release provenance generates a CycloneDX SBOM');
  excludes(workflow, /showcase:proof:hybrid/iu, 'Security baseline: release provenance must not depend on live-upstream hybrid proof');
}

function testAttestationPlanKeepsPermissionsAndClaimsScoped(): void {
  const plan = readProjectFile('docs', '08-deployment', 'artifact-attestation-plan.md');

  includes(plan, '# Artifact Attestation Plan', 'Security baseline: attestation plan title is stable');
  includes(plan, 'Evaluation Smoke', 'Security baseline: plan names the current smoke workflow');
  includes(plan, 'Full Verify', 'Security baseline: plan names the current full verify workflow');
  includes(plan, 'Release Provenance', 'Security baseline: plan names the dedicated provenance workflow');
  includes(plan, 'permissions:\n  contents: read', 'Security baseline: plan captures the current read-only baseline');
  includes(plan, 'attestations: write', 'Security baseline: plan scopes future attestation permission');
  includes(plan, 'id-token: write', 'Security baseline: plan scopes future OIDC permission');
  includes(plan, 'release-provenance.yml', 'Security baseline: plan points at the concrete workflow file');
  includes(plan, 'gh attestation verify evaluation-artifacts.tar.gz -R AI-gateway-systems/attestor', 'Security baseline: plan documents reviewer verification');
  includes(plan, 'does not claim full production supply-chain provenance', 'Security baseline: plan stays honest about scope');
  excludes(plan, /\bfull production supply-chain provenance is complete\b/iu, 'Security baseline: plan must not overclaim provenance scope');
}

function testPackageExposesSecurityDocsGuard(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  assert.equal(
    packageJson.scripts['security:supply-chain-baseline'],
    'node scripts/check-supply-chain-baseline.mjs',
    'Security baseline: package.json exposes the supply-chain baseline guard',
  );
  passed += 1;

  assert.equal(
    packageJson.scripts['security:audit-high'],
    'npm audit --audit-level=high',
    'Security baseline: package.json exposes the high/critical npm audit gate',
  );
  passed += 1;

  assert.equal(
    packageJson.scripts['test:supply-chain-baseline'],
    'npm run security:supply-chain-baseline',
    'Security baseline: package.json exposes the supply-chain baseline test alias',
  );
  passed += 1;

  assert.equal(
    packageJson.scripts['test:security-baseline-docs'],
    'tsx tests/security-baseline-docs.test.ts',
    'Security baseline: package.json exposes the security docs guard',
  );
  passed += 1;
}

testSecurityPolicyExplainsEvaluationBoundary();
testSecurityPolicyKeepsReportingPathHonest();
testReadmePinsReviewerAndSecurityEntry();
testCurrentReviewerWorkflowsStayReadOnly();
testSupplyChainSecurityGatesStayPresent();
testReleaseProvenanceWorkflowKeepsElevatedPermissionsScoped();
testAttestationPlanKeepsPermissionsAndClaimsScoped();
testPackageExposesSecurityDocsGuard();

console.log(`Security baseline docs tests: ${passed} passed, 0 failed`);
