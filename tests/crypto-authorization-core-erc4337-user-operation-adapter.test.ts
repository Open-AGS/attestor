import {
  ERC4337_USER_OPERATION_ADAPTER_SPEC_VERSION,
  ERC4337_USER_OPERATION_CHECKS,
  ERC4337_USER_OPERATION_ENTRYPOINT_VERSIONS,
  ERC4337_USER_OPERATION_OUTCOMES,
  createErc4337UserOperationPreflight,
  erc4337UserOperationAdapterDescriptor,
  erc4337UserOperationPreflightLabel,
  simulateErc4337UserOperationAuthorization,
} from '../src/crypto-authorization-core/erc4337-user-operation-adapter.js';
import {
  ACCOUNT_ADDRESS,
  ENTRYPOINT_ADDRESS,
  FACTORY_ADDRESS,
  OTHER_ADDRESS,
  STALE_USER_OP_HASH,
  bundlerValidation,
  deepEqual,
  equal,
  fixtureSuite,
  ok,
  passedCount,
  throws,
  userOperation,
} from './crypto-authorization-core-erc4337-user-operation-adapter-fixtures.js';

function testDescriptor(): void {
  const descriptor = erc4337UserOperationAdapterDescriptor();

  equal(
    descriptor.version,
    ERC4337_USER_OPERATION_ADAPTER_SPEC_VERSION,
    'ERC-4337 UserOperation adapter: descriptor exposes version',
  );
  deepEqual(
    descriptor.entryPointVersions,
    ERC4337_USER_OPERATION_ENTRYPOINT_VERSIONS,
    'ERC-4337 UserOperation adapter: descriptor exposes EntryPoint versions',
  );
  deepEqual(
    descriptor.outcomes,
    ERC4337_USER_OPERATION_OUTCOMES,
    'ERC-4337 UserOperation adapter: descriptor exposes outcomes',
  );
  deepEqual(
    descriptor.checks,
    ERC4337_USER_OPERATION_CHECKS,
    'ERC-4337 UserOperation adapter: descriptor exposes checks',
  );
  ok(
    descriptor.standards.includes('ERC-4337'),
    'ERC-4337 UserOperation adapter: descriptor names ERC-4337',
  );
  ok(
    descriptor.standards.includes('ERC-7562'),
    'ERC-4337 UserOperation adapter: descriptor names ERC-7562',
  );
  ok(
    descriptor.standards.includes('Paymaster'),
    'ERC-4337 UserOperation adapter: descriptor names Paymaster readiness',
  );
  ok(
    descriptor.standards.includes('EntryPoint'),
    'ERC-4337 UserOperation adapter: descriptor names EntryPoint binding',
  );
}

function testCreatesAllowPreflight(): void {
  const suite = fixtureSuite();
  const operation = userOperation();
  const preflight = createErc4337UserOperationPreflight({
    ...suite,
    userOperation: operation,
    bundlerValidation: bundlerValidation(),
  });
  const second = createErc4337UserOperationPreflight({
    ...suite,
    userOperation: operation,
    bundlerValidation: bundlerValidation(),
  });

  equal(
    preflight.version,
    ERC4337_USER_OPERATION_ADAPTER_SPEC_VERSION,
    'ERC-4337 UserOperation adapter: preflight carries version',
  );
  equal(
    preflight.outcome,
    'allow',
    'ERC-4337 UserOperation adapter: complete UserOperation preflight allows',
  );
  deepEqual(
    preflight.signals.map((signal) => signal.source),
    ['erc-4337-validation', 'erc-7562-validation-scope'],
    'ERC-4337 UserOperation adapter: emits required validation sources',
  );
  ok(
    preflight.signals.every((signal) => signal.status === 'pass'),
    'ERC-4337 UserOperation adapter: allow preflight emits pass signals',
  );
  equal(
    preflight.userOpHash,
    operation.userOpHash,
    'ERC-4337 UserOperation adapter: carries recomputed userOpHash',
  );
  equal(
    preflight.entryPoint,
    ENTRYPOINT_ADDRESS,
    'ERC-4337 UserOperation adapter: binds EntryPoint address',
  );
  equal(
    preflight.sender,
    ACCOUNT_ADDRESS,
    'ERC-4337 UserOperation adapter: binds sender account',
  );
  equal(
    preflight.digest,
    second.digest,
    'ERC-4337 UserOperation adapter: preflight digest is deterministic',
  );
  ok(
    preflight.observations.every((entry) => entry.status === 'pass'),
    'ERC-4337 UserOperation adapter: all allow observations pass',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'erc4337-userop-hash-verified'),
    'ERC-4337 UserOperation adapter: UserOperation hash is independently verified',
  );
  ok(
    preflight.observations.some(
      (entry) =>
        entry.check === 'erc4337-bundler-simulation-passed' &&
        entry.evidence.validationEvidenceSource === 'customer-bundler-validation',
    ),
    'ERC-4337 UserOperation adapter: bundler simulation evidence declares customer-bound source',
  );
  ok(
    preflight.observations.some(
      (entry) =>
        entry.check === 'erc4337-erc7562-scope-passed' &&
        entry.evidence.validationEvidenceSource === 'customer-bundler-validation',
    ),
    'ERC-4337 UserOperation adapter: ERC-7562 evidence declares customer-bound source',
  );
  ok(
    erc4337UserOperationPreflightLabel(preflight).includes('outcome:allow'),
    'ERC-4337 UserOperation adapter: label includes outcome',
  );
}

function testUserOperationHashMismatchBlocks(): void {
  const suite = fixtureSuite();
  const preflight = createErc4337UserOperationPreflight({
    ...suite,
    userOperation: userOperation({ userOpHash: STALE_USER_OP_HASH }),
    bundlerValidation: bundlerValidation(),
  });

  equal(
    preflight.outcome,
    'block',
    'ERC-4337 UserOperation adapter: stale bundler-supplied UserOperation hash blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'erc4337-userop-hash-mismatch'),
    'ERC-4337 UserOperation adapter: userOpHash mismatch reason is present',
  );
}

function testSimulationAllowsBoundUserOperation(): void {
  const suite = fixtureSuite();
  const result = simulateErc4337UserOperationAuthorization({
    ...suite,
    userOperation: userOperation(),
    bundlerValidation: bundlerValidation(),
  });

  equal(
    result.preflight.outcome,
    'allow',
    'ERC-4337 UserOperation adapter: simulation wrapper carries allow preflight',
  );
  equal(
    result.simulation.outcome,
    'allow-preview',
    'ERC-4337 UserOperation adapter: bound UserOperation allows simulation preview',
  );
  equal(
    result.simulation.readiness.adapterPreflight,
    'ready',
    'ERC-4337 UserOperation adapter: simulation adapter preflight is ready',
  );
  ok(
    result.simulation.requiredPreflightSources.includes('erc-4337-validation'),
    'ERC-4337 UserOperation adapter: simulation requires ERC-4337 validation',
  );
  ok(
    result.simulation.requiredPreflightSources.includes('erc-7562-validation-scope'),
    'ERC-4337 UserOperation adapter: simulation requires ERC-7562 scope',
  );
  deepEqual(
    result.simulation.requiredNextArtifacts,
    [],
    'ERC-4337 UserOperation adapter: allow simulation has no required next artifacts',
  );
}

function testBundlerSimulationFailureBlocks(): void {
  const suite = fixtureSuite();
  const result = simulateErc4337UserOperationAuthorization({
    ...suite,
    userOperation: userOperation(),
    bundlerValidation: bundlerValidation({ simulateValidationStatus: 'failed' }),
  });

  equal(
    result.preflight.outcome,
    'block',
    'ERC-4337 UserOperation adapter: failed simulateValidation blocks',
  );
  ok(
    result.preflight.observations.some((entry) => entry.code === 'erc4337-simulate-validation-failed'),
    'ERC-4337 UserOperation adapter: failed simulateValidation reason is present',
  );
  equal(
    result.simulation.outcome,
    'deny-preview',
    'ERC-4337 UserOperation adapter: failed simulateValidation denies simulation preview',
  );
}

function testErc7562ViolationBlocks(): void {
  const suite = fixtureSuite();
  const preflight = createErc4337UserOperationPreflight({
    ...suite,
    userOperation: userOperation(),
    bundlerValidation: bundlerValidation({
      bannedOpcodeDetected: true,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'ERC-4337 UserOperation adapter: ERC-7562 violation blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'erc4337-erc7562-banned-opcode'),
    'ERC-4337 UserOperation adapter: ERC-7562 banned opcode reason is present',
  );
}

function testPaymasterNotReadyBlocks(): void {
  const suite = fixtureSuite();
  const preflight = createErc4337UserOperationPreflight({
    ...suite,
    userOperation: userOperation(),
    bundlerValidation: bundlerValidation({
      paymasterStakeReady: false,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'ERC-4337 UserOperation adapter: paymaster stake failure blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'erc4337-paymaster-stake-not-ready'),
    'ERC-4337 UserOperation adapter: paymaster stake reason is present',
  );
}

function testGasPolicyBlocks(): void {
  const suite = fixtureSuite();
  const preflight = createErc4337UserOperationPreflight({
    ...suite,
    userOperation: userOperation({
      maxFeePerGas: '100',
      maxPriorityFeePerGas: '200',
    }),
    bundlerValidation: bundlerValidation(),
  });

  equal(
    preflight.outcome,
    'block',
    'ERC-4337 UserOperation adapter: priority fee above max fee blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'erc4337-priority-fee-exceeds-max-fee'),
    'ERC-4337 UserOperation adapter: gas policy reason is present',
  );
}

function testNonceAndTargetMismatchBlocks(): void {
  const suite = fixtureSuite();
  const nonceMismatch = createErc4337UserOperationPreflight({
    ...suite,
    userOperation: userOperation({ nonce: '43' }),
    bundlerValidation: bundlerValidation(),
  });
  const targetMismatch = createErc4337UserOperationPreflight({
    ...suite,
    userOperation: userOperation({ callTarget: OTHER_ADDRESS }),
    bundlerValidation: bundlerValidation(),
  });

  equal(
    nonceMismatch.outcome,
    'block',
    'ERC-4337 UserOperation adapter: nonce mismatch blocks',
  );
  ok(
    nonceMismatch.observations.some((entry) => entry.code === 'erc4337-nonce-mismatch'),
    'ERC-4337 UserOperation adapter: nonce mismatch reason is present',
  );
  equal(
    targetMismatch.outcome,
    'block',
    'ERC-4337 UserOperation adapter: target mismatch blocks',
  );
  ok(
    targetMismatch.observations.some((entry) => entry.code === 'erc4337-call-target-mismatch'),
    'ERC-4337 UserOperation adapter: target mismatch reason is present',
  );
}

function testFactoryPathRequiresReadiness(): void {
  const suite = fixtureSuite();
  const blocked = createErc4337UserOperationPreflight({
    ...suite,
    userOperation: userOperation({
      factory: FACTORY_ADDRESS,
      factoryData: null,
      paymaster: null,
      paymasterVerificationGasLimit: null,
      paymasterPostOpGasLimit: null,
      paymasterData: null,
    }),
    bundlerValidation: bundlerValidation({
      senderAlreadyDeployed: false,
      factoryStatus: 'not-ready',
      paymasterStatus: 'not-used',
      paymasterStakeReady: null,
      paymasterDepositReady: null,
      paymasterValidation: null,
    }),
  });
  const allowed = createErc4337UserOperationPreflight({
    ...suite,
    userOperation: userOperation({
      factory: FACTORY_ADDRESS,
      factoryData: '0xabcdef',
      paymaster: null,
      paymasterVerificationGasLimit: null,
      paymasterPostOpGasLimit: null,
      paymasterData: null,
    }),
    bundlerValidation: bundlerValidation({
      senderAlreadyDeployed: false,
      factoryStatus: 'ready',
      paymasterStatus: 'not-used',
      paymasterStakeReady: null,
      paymasterDepositReady: null,
      paymasterValidation: null,
    }),
  });

  equal(
    blocked.outcome,
    'block',
    'ERC-4337 UserOperation adapter: missing factory readiness blocks counterfactual sender',
  );
  ok(
    blocked.observations.some((entry) => entry.code === 'erc4337-factory-not-ready'),
    'ERC-4337 UserOperation adapter: factory readiness reason is present',
  );
  equal(
    allowed.outcome,
    'allow',
    'ERC-4337 UserOperation adapter: ready factory path allows counterfactual sender',
  );
}

function testValidationWindowMustStayInsideIntent(): void {
  const suite = fixtureSuite();
  const preflight = createErc4337UserOperationPreflight({
    ...suite,
    userOperation: userOperation(),
    bundlerValidation: bundlerValidation({
      accountValidation: {
        validAfter: '2026-04-21T08:59:00.000Z',
        validUntil: '2026-04-21T09:06:00.000Z',
      },
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'ERC-4337 UserOperation adapter: widened account validation window blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'erc4337-account-validation-window-outside-intent'),
    'ERC-4337 UserOperation adapter: validation window reason is present',
  );
}

function testRejectsWrongAdapterIntent(): void {
  const suite = fixtureSuite('safe-guard');

  throws(
    () =>
      createErc4337UserOperationPreflight({
        ...suite,
        userOperation: userOperation(),
        bundlerValidation: bundlerValidation(),
    }),
    /erc-4337-user-operation/i,
  );
}

function main(): void {
  testDescriptor();
  testCreatesAllowPreflight();
  testUserOperationHashMismatchBlocks();
  testSimulationAllowsBoundUserOperation();
  testBundlerSimulationFailureBlocks();
  testErc7562ViolationBlocks();
  testPaymasterNotReadyBlocks();
  testGasPolicyBlocks();
  testNonceAndTargetMismatchBlocks();
  testFactoryPathRequiresReadiness();
  testValidationWindowMustStayInsideIntent();
  testRejectsWrongAdapterIntent();
  console.log(`crypto authorization core ERC-4337 UserOperation adapter tests passed (${passedCount()} assertions)`);
}

main();
