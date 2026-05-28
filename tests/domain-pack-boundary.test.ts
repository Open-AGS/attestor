import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_DOMAIN_PACK_ALLOWED_RESPONSIBILITIES,
  CONSEQUENCE_DOMAIN_PACK_BOUNDARY_PACK_FAMILIES,
  CONSEQUENCE_DOMAIN_PACK_BOUNDARY_SURFACE_KINDS,
  CONSEQUENCE_DOMAIN_PACK_BOUNDARY_VERSION,
  CONSEQUENCE_DOMAIN_PACK_FORBIDDEN_RESPONSIBILITIES,
  consequenceAdmissionDescriptor,
  consequenceDomainPackBoundaryDescriptor,
  type ConsequenceDomainPackBoundarySurfaceKind,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
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

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function surface(kind: ConsequenceDomainPackBoundarySurfaceKind) {
  const found = consequenceDomainPackBoundaryDescriptor().surfaces.find((item) =>
    item.kind === kind
  );
  assert.ok(found, `Missing domain pack boundary surface: ${kind}`);
  return found;
}

function testBoundaryShapeIsExplicitAndNonAuthorizing(): void {
  const boundary = consequenceDomainPackBoundaryDescriptor();
  const admission = consequenceAdmissionDescriptor();

  equal(
    boundary.version,
    CONSEQUENCE_DOMAIN_PACK_BOUNDARY_VERSION,
    'Domain pack boundary: version constant is used',
  );
  equal(
    boundary.version,
    'attestor.consequence-domain-pack-boundary.v1',
    'Domain pack boundary: version literal is stable',
  );
  equal(boundary.owningLayer, 'domain-extension-layer', 'Domain pack boundary: layer is domain extension');
  equal(boundary.primaryRole, 'pack', 'Domain pack boundary: pack role owns pack placement');
  ok(
    boundary.supportingRoles.includes('pdp'),
    'Domain pack boundary: PDP supports pack placement',
  );
  ok(
    boundary.supportingRoles.includes('replay'),
    'Domain pack boundary: replay supports pack placement',
  );
  ok(
    boundary.consumerRoles.includes('hosted-service'),
    'Domain pack boundary: hosted service consumes pack placement',
  );
  ok(
    boundary.nonOwningSharedControlRoles.includes('pack'),
    'Domain pack boundary: packs do not own shared control contracts',
  );
  equal(boundary.automaticPackDetection, false, 'Domain pack boundary: automatic pack detection is false');
  equal(boundary.separateProductIdentityAllowed, false, 'Domain pack boundary: separate product identity is false');
  equal(boundary.autoEnforce, false, 'Domain pack boundary: auto-enforce is false');
  equal(boundary.productionReady, false, 'Domain pack boundary: production readiness is false');
  equal(boundary.activatesEnforcement, false, 'Domain pack boundary: activation is false');
  includes(
    boundary.limitation,
    'does not activate enforcement',
    'Domain pack boundary: limitation prevents enforcement overclaim',
  );
  equal(
    admission.domainPackBoundaryVersion,
    CONSEQUENCE_DOMAIN_PACK_BOUNDARY_VERSION,
    'Domain pack boundary: admission descriptor exposes boundary version',
  );
  equal(
    admission.domainPackBoundary.primaryRole,
    'pack',
    'Domain pack boundary: admission descriptor exposes pack owner',
  );
}

function testPackFamiliesAndResponsibilitiesAreStable(): void {
  const boundary = consequenceDomainPackBoundaryDescriptor();

  deepEqual(
    boundary.packFamilies,
    CONSEQUENCE_DOMAIN_PACK_BOUNDARY_PACK_FAMILIES,
    'Domain pack boundary: pack families are exported in stable order',
  );
  deepEqual(
    boundary.surfaceKinds,
    CONSEQUENCE_DOMAIN_PACK_BOUNDARY_SURFACE_KINDS,
    'Domain pack boundary: surface kinds are exported in stable order',
  );
  deepEqual(
    boundary.allowedResponsibilities,
    CONSEQUENCE_DOMAIN_PACK_ALLOWED_RESPONSIBILITIES,
    'Domain pack boundary: allowed responsibilities are exported',
  );
  deepEqual(
    boundary.forbiddenResponsibilities,
    CONSEQUENCE_DOMAIN_PACK_FORBIDDEN_RESPONSIBILITIES,
    'Domain pack boundary: forbidden responsibilities are exported',
  );

  for (const required of [
    'attestor.consequence-admission-pack-decision-profile.v1',
    'attestor.consequence-failure-mode-registry-placement.v1',
    'attestor.consequence-replay-layer-placement.v1',
    'admit/narrow/review/block',
  ]) {
    ok(
      boundary.sharedContractsRequired.includes(required),
      `Domain pack boundary: shared contract is required: ${required}`,
    );
  }
}

function testCurrentPackSurfacesAreBounded(): void {
  const boundary = consequenceDomainPackBoundaryDescriptor();
  const kinds = boundary.surfaces.map((item) => item.kind);

  deepEqual(
    kinds,
    [
      'finance-admission-projection',
      'crypto-admission-projection',
      'generic-admission-projection',
      'domain-registry-pack',
      'filing-adapter-pack',
      'future-pack-extension',
    ],
    'Domain pack boundary: expected current pack surfaces are complete',
  );

  for (const item of boundary.surfaces) {
    ok(item.sourceFiles.length > 0, `Domain pack boundary: ${item.kind} names source files`);
    ok(item.allowedResponsibilities.length > 0, `Domain pack boundary: ${item.kind} has allowed responsibilities`);
    ok(item.forbiddenResponsibilities.includes('fork-failure-mode-registry'), `Domain pack boundary: ${item.kind} cannot fork registry`);
    equal(item.ownsDecisionVocabulary, false, `Domain pack boundary: ${item.kind} does not own vocabulary`);
    equal(item.ownsFailureRegistry, false, `Domain pack boundary: ${item.kind} does not own failure registry`);
    equal(item.ownsReplayLayer, false, `Domain pack boundary: ${item.kind} does not own replay layer`);
    equal(item.mayApproveActionByItself, false, `Domain pack boundary: ${item.kind} cannot approve by itself`);
    equal(item.productionReady, false, `Domain pack boundary: ${item.kind} is not production-ready proof`);
    ok(item.limitation.length > 0, `Domain pack boundary: ${item.kind} has explicit limitation`);
  }
}

function testFinanceCryptoAndFutureBoundariesAreSpecific(): void {
  const finance = surface('finance-admission-projection');
  const crypto = surface('crypto-admission-projection');
  const generic = surface('generic-admission-projection');
  const future = surface('future-pack-extension');

  equal(finance.packFamily, 'finance', 'Domain pack boundary: finance surface uses finance family');
  ok(
    finance.sourceFiles.includes('src/consequence-admission/finance.ts'),
    'Domain pack boundary: finance admission projection is named',
  );
  includes(
    finance.limitation,
    'does not become a separate finance product',
    'Domain pack boundary: finance product split is blocked',
  );
  equal(crypto.packFamily, 'crypto', 'Domain pack boundary: crypto surface uses crypto family');
  ok(
    crypto.sourceFiles.includes('src/crypto-execution-admission/index.ts'),
    'Domain pack boundary: crypto execution admission package is named',
  );
  includes(
    crypto.limitation,
    'without claiming a hosted crypto execution route',
    'Domain pack boundary: crypto hosted route overclaim is blocked',
  );
  includes(
    generic.limitation,
    'must not guess a stronger domain posture automatically',
    'Domain pack boundary: generic admission cannot auto-upgrade posture',
  );
  includes(
    future.limitation,
    'cannot become a new product identity',
    'Domain pack boundary: future packs cannot become products by default',
  );
}

function testDocsScriptsAndPackageSurfaceStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'domain-pack-boundary.md');
  const architecture = readProjectFile('docs', '02-architecture', 'ai-action-control-plane-architecture.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageProbe = readProjectFile('scripts', 'probe', 'probe-consequence-admission-package-surface.mjs');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(doc, 'attestor.consequence-domain-pack-boundary.v1', 'Domain pack docs: version is named');
  includes(doc, 'src/consequence-admission/domain-pack-boundary.ts', 'Domain pack docs: source file is named');
  includes(doc, 'finance-admission-projection', 'Domain pack docs: finance projection is named');
  includes(doc, 'crypto-admission-projection', 'Domain pack docs: crypto projection is named');
  includes(doc, 'does not activate enforcement', 'Domain pack docs: enforcement non-claim is present');
  includes(architecture, 'attestor.consequence-domain-pack-boundary.v1', 'Architecture docs: domain pack boundary contract is named');
  includes(systemOverview, '[Domain pack boundary](domain-pack-boundary.md)', 'System overview: domain pack boundary doc is linked');
  includes(packageProbe, 'consequenceDomainPackBoundaryDescriptor', 'Package probe: domain pack boundary descriptor is checked');
  equal(
    pkg.scripts['test:domain-pack-boundary'],
    'tsx tests/domain-pack-boundary.test.ts',
    'Package: domain pack boundary test is exposed',
  );
}

testBoundaryShapeIsExplicitAndNonAuthorizing();
testPackFamiliesAndResponsibilitiesAreStable();
testCurrentPackSurfacesAreBounded();
testFinanceCryptoAndFutureBoundariesAreSpecific();
testDocsScriptsAndPackageSurfaceStayAligned();

console.log(`Domain pack boundary tests: ${passed} passed, 0 failed`);
