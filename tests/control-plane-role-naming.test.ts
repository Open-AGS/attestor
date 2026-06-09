import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ATTESTOR_CONTROL_PLANE_ROLES,
  ATTESTOR_CONTROL_PLANE_ROLE_VERSION,
  attestorControlPlaneRoleDescriptor,
  attestorControlPlaneRolesDescriptor,
  consequenceAdmissionDescriptor,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function testRoleRegistryIsExplicitAndNonAuthorizing(): void {
  deepEqual(
    ATTESTOR_CONTROL_PLANE_ROLES,
    [
      'pdp',
      'pep',
      'pip',
      'pap',
      'audit-proof',
      'replay',
      'pack',
      'hosted-service',
    ],
    'Control-plane role naming: role list stays explicit and ordered',
  );

  const descriptor = attestorControlPlaneRolesDescriptor();
  equal(
    descriptor.version,
    ATTESTOR_CONTROL_PLANE_ROLE_VERSION,
    'Control-plane role naming: descriptor exposes the role contract version',
  );
  equal(
    descriptor.descriptors.length,
    ATTESTOR_CONTROL_PLANE_ROLES.length,
    'Control-plane role naming: every role has a descriptor',
  );

  for (const role of ATTESTOR_CONTROL_PLANE_ROLES) {
    const roleDescriptor = attestorControlPlaneRoleDescriptor(role);
    equal(roleDescriptor.role, role, `Control-plane role naming: ${role} descriptor is addressable`);
    equal(
      roleDescriptor.mayApproveActionByItself,
      false,
      `Control-plane role naming: ${role} cannot approve an action by itself`,
    );
    ok(
      roleDescriptor.currentSurfaces.length > 0,
      `Control-plane role naming: ${role} has repository surface guidance`,
    );
    ok(
      roleDescriptor.mustNot.length > 0,
      `Control-plane role naming: ${role} has boundary prohibitions`,
    );
  }
}

function testCriticalRolesCarryTheRightBoundaries(): void {
  const pdp = attestorControlPlaneRoleDescriptor('pdp');
  includes(
    pdp.responsibility,
    'Produces admit, narrow, review, or block',
    'Control-plane role naming: PDP owns bounded decisions',
  );
  includes(
    pdp.mustNot.join('\n'),
    'call a concrete downstream executor',
    'Control-plane role naming: PDP cannot execute downstream effects',
  );

  const pep = attestorControlPlaneRoleDescriptor('pep');
  includes(
    pep.responsibility,
    'Catches an intended action before downstream execution',
    'Control-plane role naming: PEP sits before downstream execution',
  );
  includes(
    pep.mustNot.join('\n'),
    'treat review-required as allow',
    'Control-plane role naming: PEP blocks review auto-promotion',
  );

  const pip = attestorControlPlaneRoleDescriptor('pip');
  includes(
    pip.mustNot.join('\n'),
    'launder untrusted content into authority',
    'Control-plane role naming: PIP cannot launder untrusted authority',
  );

  const pap = attestorControlPlaneRoleDescriptor('pap');
  includes(
    pap.mustNot.join('\n'),
    'auto-enforce a policy candidate',
    'Control-plane role naming: PAP cannot auto-enforce candidates',
  );
}

function testAdmissionDescriptorExposesTheRoleContract(): void {
  const descriptor = consequenceAdmissionDescriptor();

  equal(
    descriptor.controlPlaneRoleVersion,
    ATTESTOR_CONTROL_PLANE_ROLE_VERSION,
    'Control-plane role naming: admission descriptor exposes role version',
  );
  deepEqual(
    descriptor.controlPlaneRoles,
    ATTESTOR_CONTROL_PLANE_ROLES,
    'Control-plane role naming: admission descriptor exposes role list',
  );
  equal(
    descriptor.controlPlaneRoleDescriptors.length,
    ATTESTOR_CONTROL_PLANE_ROLES.length,
    'Control-plane role naming: admission descriptor exposes all role descriptors',
  );
}

function testDocsPointAtTheMachineReadableContract(): void {
  const architecture = readProjectFile('docs', '02-architecture', 'ai-action-control-plane-architecture.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const docsFrontDoor = readProjectFile('docs', 'README.md');

  includes(
    architecture,
    '`src/consequence-admission/control-plane-roles.ts`',
    'Control-plane role naming: ADR points at the machine-readable role registry',
  );
  includes(
    systemOverview,
    'The machine-readable naming contract lives in `src/consequence-admission/control-plane-roles.ts`.',
    'Control-plane role naming: system overview points at the machine-readable role registry',
  );
  includes(
    docsFrontDoor,
    '[AI Action Control Plane architecture](02-architecture/ai-action-control-plane-architecture.md)',
    'Control-plane role naming: docs front door links the architecture contract',
  );
}

testRoleRegistryIsExplicitAndNonAuthorizing();
testCriticalRolesCarryTheRightBoundaries();
testAdmissionDescriptorExposesTheRoleContract();
testDocsPointAtTheMachineReadableContract();

console.log(`Control-plane role naming tests: ${passed} passed, 0 failed`);
