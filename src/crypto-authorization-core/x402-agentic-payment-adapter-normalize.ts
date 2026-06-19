import type {
  CreateX402AgenticPaymentPreflightInput,
  X402AgentBudgetEvidence,
  X402ExactAuthorizationEvidence,
  X402FacilitatorEvidence,
  X402NetworkNamespace,
  X402PaymentPayloadEvidence,
  X402PaymentRequirementsEvidence,
  X402PrivacyMetadataEvidence,
  X402ResourceEvidence,
  X402ServiceTrustEvidence,
} from './x402-agentic-payment-adapter-types.js';
import {
  X402_NETWORK_NAMESPACES,
  X402_TRANSPORTS,
} from './x402-agentic-payment-adapter-types.js';

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) {
    throw new Error(`x402 agentic payment adapter ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

export function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeIdentifier(value, fieldName);
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`x402 agentic payment adapter ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeUrl(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  try {
    const url = new URL(normalized);
    return url.toString();
  } catch {
    throw new Error(`x402 agentic payment adapter ${fieldName} must be a URL.`);
  }
}

function normalizeHttpsUrl(value: string, fieldName: string): string {
  const normalized = normalizeUrl(value, fieldName);
  if (!normalized.startsWith('https://')) {
    throw new Error(`x402 agentic payment adapter ${fieldName} must use https.`);
  }
  return normalized;
}

function normalizeMethod(value: string): string {
  const normalized = normalizeIdentifier(value, 'method').toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) {
    throw new Error('x402 agentic payment adapter method must be an HTTP token.');
  }
  return normalized;
}

function normalizeHash(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error(`x402 agentic payment adapter ${fieldName} must be a 32-byte hex value.`);
  }
  return normalized.toLowerCase();
}

function normalizeOptionalHash(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeHash(value, fieldName);
}

function normalizeSignature(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^0x[a-fA-F0-9]+$/.test(normalized) || normalized.length < 132) {
    throw new Error(`x402 agentic payment adapter ${fieldName} must be a hex signature.`);
  }
  return normalized.toLowerCase();
}

function normalizeEvmAddress(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
    throw new Error(`x402 agentic payment adapter ${fieldName} must be an EVM address.`);
  }
  return normalized.toLowerCase();
}

function normalizeSolanaAddress(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(normalized)) {
    throw new Error(`x402 agentic payment adapter ${fieldName} must be a Solana base58 address.`);
  }
  return normalized;
}

export function namespaceForNetwork(network: string): X402NetworkNamespace | null {
  const [namespace] = network.split(':', 1);
  return X402_NETWORK_NAMESPACES.includes(namespace as X402NetworkNamespace)
    ? namespace as X402NetworkNamespace
    : null;
}

function normalizeCaip2Network(value: string): string {
  const normalized = normalizeIdentifier(value, 'network');
  if (!/^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/.test(normalized)) {
    throw new Error('x402 agentic payment adapter network must be CAIP-2.');
  }
  if (!namespaceForNetwork(normalized)) {
    throw new Error('x402 agentic payment adapter network namespace is unsupported.');
  }
  return normalized;
}

function normalizePaymentAddress(value: string, network: string, fieldName: string): string {
  const namespace = namespaceForNetwork(network);
  if (namespace === 'eip155') {
    return normalizeEvmAddress(value, fieldName);
  }
  if (namespace === 'solana') {
    return normalizeSolanaAddress(value, fieldName);
  }
  return normalizeIdentifier(value, fieldName);
}

function normalizeAtomicUnits(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^(?:0|[1-9]\d*)$/.test(normalized)) {
    throw new Error(`x402 agentic payment adapter ${fieldName} must be atomic integer units.`);
  }
  return normalized;
}

export function parseAtomicUnits(value: string, fieldName: string): bigint {
  return BigInt(normalizeAtomicUnits(value, fieldName));
}

function normalizeEpochSeconds(value: string, fieldName: string): string {
  const normalized = normalizeAtomicUnits(value, fieldName);
  const parsed = BigInt(normalized);
  if (parsed <= 0n) {
    throw new Error(`x402 agentic payment adapter ${fieldName} must be positive.`);
  }
  return normalized;
}

function normalizeNonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`x402 agentic payment adapter ${fieldName} must be a non-negative safe integer.`);
  }
  return value;
}

function normalizePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`x402 agentic payment adapter ${fieldName} must be a positive safe integer.`);
  }
  return value;
}

function normalizeStringList(
  values: readonly string[] | null | undefined,
): readonly string[] {
  if (!values) {
    return Object.freeze([]);
  }
  return Object.freeze(
    Array.from(new Set(values.map((entry) => normalizeIdentifier(entry, 'string list entry')))),
  );
}

export function includesValue<T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
}

export function normalizeResource(input: X402ResourceEvidence): X402ResourceEvidence {
  const transport = normalizeIdentifier(input.transport, 'resource.transport');
  if (!includesValue(X402_TRANSPORTS, transport)) {
    throw new Error('x402 agentic payment adapter currently supports HTTP transport only.');
  }
  return Object.freeze({
    transport,
    observedAt: normalizeIsoTimestamp(input.observedAt, 'resource.observedAt'),
    method: normalizeMethod(input.method),
    resourceUrl: normalizeHttpsUrl(input.resourceUrl, 'resource.resourceUrl'),
    statusCode: normalizeNonNegativeInteger(input.statusCode, 'resource.statusCode'),
    paymentRequiredHeaderPresent: Boolean(input.paymentRequiredHeaderPresent),
    paymentRequiredHeaderDecoded: Boolean(input.paymentRequiredHeaderDecoded),
    responseBodyMatchesHeader: Boolean(input.responseBodyMatchesHeader),
    description: normalizeOptionalIdentifier(input.description, 'resource.description'),
    mimeType: normalizeOptionalIdentifier(input.mimeType, 'resource.mimeType'),
    routeId: normalizeOptionalIdentifier(input.routeId, 'resource.routeId'),
  });
}

export function normalizeRequirements(
  input: X402PaymentRequirementsEvidence,
): X402PaymentRequirementsEvidence {
  const network = normalizeCaip2Network(input.network);
  return Object.freeze({
    x402Version: normalizePositiveInteger(input.x402Version, 'requirements.x402Version'),
    acceptsCount: normalizePositiveInteger(input.acceptsCount, 'requirements.acceptsCount'),
    selectedAcceptIndex: normalizeNonNegativeInteger(
      input.selectedAcceptIndex,
      'requirements.selectedAcceptIndex',
    ),
    scheme: normalizeIdentifier(input.scheme, 'requirements.scheme'),
    network,
    amount: normalizeAtomicUnits(input.amount, 'requirements.amount'),
    asset: normalizeIdentifier(input.asset, 'requirements.asset'),
    payTo: normalizePaymentAddress(input.payTo, network, 'requirements.payTo'),
    maxTimeoutSeconds: normalizePositiveInteger(
      input.maxTimeoutSeconds,
      'requirements.maxTimeoutSeconds',
    ),
    extraName: normalizeOptionalIdentifier(input.extraName, 'requirements.extraName'),
    extraVersion: normalizeOptionalIdentifier(input.extraVersion, 'requirements.extraVersion'),
    requirementsHash: normalizeOptionalHash(input.requirementsHash, 'requirements.requirementsHash'),
    extensionsAdvertised: normalizeStringList(input.extensionsAdvertised),
  });
}

function normalizeAuthorization(
  input: X402ExactAuthorizationEvidence,
  network: string,
): X402ExactAuthorizationEvidence {
  return Object.freeze({
    mode: normalizeIdentifier(input.mode, 'authorization.mode'),
    from: normalizePaymentAddress(input.from, network, 'authorization.from'),
    to: normalizePaymentAddress(input.to, network, 'authorization.to'),
    value: normalizeAtomicUnits(input.value, 'authorization.value'),
    validAfterEpochSeconds: normalizeEpochSeconds(
      input.validAfterEpochSeconds,
      'authorization.validAfterEpochSeconds',
    ),
    validBeforeEpochSeconds: normalizeEpochSeconds(
      input.validBeforeEpochSeconds,
      'authorization.validBeforeEpochSeconds',
    ),
    nonce: normalizeHash(input.nonce, 'authorization.nonce'),
    signature: normalizeSignature(input.signature, 'authorization.signature'),
    signatureValid: Boolean(input.signatureValid),
    domainName: normalizeOptionalIdentifier(input.domainName, 'authorization.domainName'),
    domainVersion: normalizeOptionalIdentifier(input.domainVersion, 'authorization.domainVersion'),
    domainChainId: normalizeOptionalIdentifier(input.domainChainId, 'authorization.domainChainId'),
    verifyingContract: namespaceForNetwork(network) === 'eip155'
      ? normalizeOptionalIdentifier(input.verifyingContract, 'authorization.verifyingContract')
      : normalizeOptionalIdentifier(input.verifyingContract, 'authorization.verifyingContract'),
    nonceUnused: Boolean(input.nonceUnused),
    balanceSufficient: Boolean(input.balanceSufficient),
    transferSimulationSucceeded: Boolean(input.transferSimulationSucceeded),
  });
}

export function normalizePayload(
  input: X402PaymentPayloadEvidence,
  requirements: X402PaymentRequirementsEvidence,
): X402PaymentPayloadEvidence {
  const network = normalizeCaip2Network(input.network);
  const authorization = normalizeAuthorization(input.authorization, network);
  return Object.freeze({
    x402Version: normalizePositiveInteger(input.x402Version, 'payload.x402Version'),
    paymentSignatureHeaderPresent: Boolean(input.paymentSignatureHeaderPresent),
    payloadHash: normalizeOptionalHash(input.payloadHash, 'payload.payloadHash'),
    resourceMatchesRequirements: Boolean(input.resourceMatchesRequirements),
    acceptedMatchesRequirements: Boolean(input.acceptedMatchesRequirements),
    payer: normalizePaymentAddress(input.payer, network, 'payload.payer'),
    scheme: normalizeIdentifier(input.scheme, 'payload.scheme'),
    network,
    amount: normalizeAtomicUnits(input.amount, 'payload.amount'),
    asset: normalizeIdentifier(input.asset, 'payload.asset'),
    payTo: normalizePaymentAddress(input.payTo, network, 'payload.payTo'),
    authorization,
    extensionsEchoed:
      normalizeStringList(requirements.extensionsAdvertised).length === 0 ||
      Boolean(input.extensionsEchoed),
  });
}

export function normalizeFacilitator(input: X402FacilitatorEvidence): X402FacilitatorEvidence {
  return Object.freeze({
    path: normalizeIdentifier(input.path, 'facilitator.path'),
    facilitatorUrl: normalizeHttpsUrl(input.facilitatorUrl, 'facilitator.facilitatorUrl'),
    supportedChecked: Boolean(input.supportedChecked),
    supportedKindAdvertised: Boolean(input.supportedKindAdvertised),
    signerTrusted: Boolean(input.signerTrusted),
    verifyRequested: Boolean(input.verifyRequested),
    verifyResponseValid: Boolean(input.verifyResponseValid),
    verifyInvalidReason: normalizeOptionalIdentifier(
      input.verifyInvalidReason,
      'facilitator.verifyInvalidReason',
    ),
    verifyPayer: normalizeOptionalIdentifier(input.verifyPayer, 'facilitator.verifyPayer'),
    settleRequested: Boolean(input.settleRequested),
    settleResponseSuccess:
      input.settleResponseSuccess === null ? null : Boolean(input.settleResponseSuccess),
    settlementTransaction: normalizeOptionalIdentifier(
      input.settlementTransaction,
      'facilitator.settlementTransaction',
    ),
    settlementNetwork: input.settlementNetwork
      ? normalizeCaip2Network(input.settlementNetwork)
      : null,
    settlementPayer: normalizeOptionalIdentifier(
      input.settlementPayer,
      'facilitator.settlementPayer',
    ),
    settlementAmount: input.settlementAmount
      ? normalizeAtomicUnits(input.settlementAmount, 'facilitator.settlementAmount')
      : null,
    paymentResponseHeaderPresent: Boolean(input.paymentResponseHeaderPresent),
  });
}

export function normalizeBudget(input: X402AgentBudgetEvidence): X402AgentBudgetEvidence {
  return Object.freeze({
    agentId: normalizeIdentifier(input.agentId, 'budget.agentId'),
    budgetId: normalizeIdentifier(input.budgetId, 'budget.budgetId'),
    spendLimitAtomic: normalizeAtomicUnits(input.spendLimitAtomic, 'budget.spendLimitAtomic'),
    spendUsedAtomic: normalizeAtomicUnits(input.spendUsedAtomic, 'budget.spendUsedAtomic'),
    proposedSpendAtomic: normalizeAtomicUnits(
      input.proposedSpendAtomic,
      'budget.proposedSpendAtomic',
    ),
    cadence: normalizeIdentifier(input.cadence, 'budget.cadence'),
    requestsUsedInWindow: normalizeNonNegativeInteger(
      input.requestsUsedInWindow,
      'budget.requestsUsedInWindow',
    ),
    maxRequestsInWindow: normalizePositiveInteger(
      input.maxRequestsInWindow,
      'budget.maxRequestsInWindow',
    ),
    idempotencyKey: normalizeIdentifier(input.idempotencyKey, 'budget.idempotencyKey'),
    idempotencyFresh: Boolean(input.idempotencyFresh),
    duplicatePaymentDetected: Boolean(input.duplicatePaymentDetected),
    correlationId: normalizeOptionalIdentifier(input.correlationId, 'budget.correlationId'),
  });
}

export function normalizeServiceTrust(input: X402ServiceTrustEvidence): X402ServiceTrustEvidence {
  return Object.freeze({
    merchantId: normalizeIdentifier(input.merchantId, 'serviceTrust.merchantId'),
    serviceDiscoveryRef: normalizeOptionalIdentifier(
      input.serviceDiscoveryRef,
      'serviceTrust.serviceDiscoveryRef',
    ),
    resourceOriginAllowlisted: Boolean(input.resourceOriginAllowlisted),
    payToAllowlisted: Boolean(input.payToAllowlisted),
    assetAllowlisted: Boolean(input.assetAllowlisted),
    assetAllowlistEvidenceRef: normalizeOptionalIdentifier(
      input.assetAllowlistEvidenceRef,
      'serviceTrust.assetAllowlistEvidenceRef',
    ),
    networkAllowlisted: Boolean(input.networkAllowlisted),
    priceMatchesCatalog: Boolean(input.priceMatchesCatalog),
  });
}

export function normalizePrivacy(input: X402PrivacyMetadataEvidence): X402PrivacyMetadataEvidence {
  return Object.freeze({
    metadataScanned: Boolean(input.metadataScanned),
    piiDetected: Boolean(input.piiDetected),
    piiRedacted: Boolean(input.piiRedacted),
    sensitiveQueryDetected: Boolean(input.sensitiveQueryDetected),
    sensitiveQueryRedacted: Boolean(input.sensitiveQueryRedacted),
    metadataMinimized: Boolean(input.metadataMinimized),
    facilitatorDataMinimized: Boolean(input.facilitatorDataMinimized),
    reasonStringPiiDetected: input.reasonStringPiiDetected === true,
  });
}

export function assertAdapterConsistency(input: CreateX402AgenticPaymentPreflightInput): void {
  if (input.intent.executionAdapterKind !== 'x402-payment') {
    throw new Error('x402 agentic payment adapter requires intent execution adapter x402-payment.');
  }
  if (input.riskAssessment.consequenceKind !== input.intent.consequenceKind) {
    throw new Error('x402 agentic payment adapter risk consequence does not match intent.');
  }
  if (input.releaseBinding.cryptoDecisionId !== input.policyScopeBinding.cryptoDecisionId) {
    throw new Error('x402 agentic payment adapter policy binding does not match release binding.');
  }
  if (input.releaseBinding.cryptoDecisionId !== input.enforcementBinding.cryptoDecisionId) {
    throw new Error('x402 agentic payment adapter enforcement binding does not match release binding.');
  }
  if (input.enforcementBinding.adapterKind !== 'x402-payment') {
    throw new Error('x402 agentic payment adapter requires x402-payment enforcement binding.');
  }
  if (input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind !== 'action-dispatch') {
    throw new Error('x402 agentic payment adapter requires action-dispatch enforcement.');
  }
  if (!input.enforcementBinding.verificationProfile.failClosed) {
    throw new Error('x402 agentic payment adapter requires fail-closed enforcement verification.');
  }
}
