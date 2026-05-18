import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';

export const ASSURANCE_CASE_CONTRACT_VERSION =
  'attestor.assurance-case-contract.v1';

export const ASSURANCE_CASE_SOURCE_STANDARDS = [
  'gsn-v3-render-view',
  'sacm-2.3-aligned-substrate',
  'eliminative-argumentation',
  'assurance-2.0-defeasibility',
  'living-assurance-case',
  'amlas-ml-assurance-pattern',
] as const;
export type AssuranceCaseSourceStandard =
  typeof ASSURANCE_CASE_SOURCE_STANDARDS[number];

export const ASSURANCE_CASE_NODE_KINDS = [
  'claim',
  'strategy',
  'evidence',
  'context',
  'assumption',
  'justification',
  'module',
  'away-claim',
] as const;
export type AssuranceCaseNodeKind = typeof ASSURANCE_CASE_NODE_KINDS[number];

export const ASSURANCE_CASE_LINK_KINDS = [
  'supported-by',
  'in-context-of',
  'assumes',
  'justified-by',
  'defeated-by',
  'closed-by',
  'references-away-claim',
  'contains',
] as const;
export type AssuranceCaseLinkKind = typeof ASSURANCE_CASE_LINK_KINDS[number];

export const ASSURANCE_CASE_DEFEATER_KINDS = [
  'rebutting',
  'undermining',
  'undercutting',
] as const;
export type AssuranceCaseDefeaterKind =
  typeof ASSURANCE_CASE_DEFEATER_KINDS[number];

export const ASSURANCE_CASE_DEFEATER_STATES = [
  'open',
  'closed-by-evidence',
  'closed-by-scope',
  'residual-accepted',
] as const;
export type AssuranceCaseDefeaterState =
  typeof ASSURANCE_CASE_DEFEATER_STATES[number];

export const ASSURANCE_CASE_TRANSITION_KINDS = [
  'create-node',
  'open-defeater',
  'close-defeater-by-evidence',
  'close-defeater-by-scope',
  'accept-residual-defeater',
  'reopen-defeater-by-new-evidence',
] as const;
export type AssuranceCaseTransitionKind =
  typeof ASSURANCE_CASE_TRANSITION_KINDS[number];

export const ASSURANCE_CASE_SCOPE_CHANGE_POSTURES = [
  'same-scope',
  'narrows-scope',
  'broadens-scope',
] as const;
export type AssuranceCaseScopeChangePosture =
  typeof ASSURANCE_CASE_SCOPE_CHANGE_POSTURES[number];

export const ASSURANCE_CASE_SCOPE_CHANGE_OUTCOMES = [
  'accepted-same-scope',
  'accepted-narrowing',
  'rejected-in-place-scope-broadening',
] as const;
export type AssuranceCaseScopeChangeOutcome =
  typeof ASSURANCE_CASE_SCOPE_CHANGE_OUTCOMES[number];

export interface CreateAssuranceCaseNodeInput {
  readonly nodeId: string;
  readonly kind: AssuranceCaseNodeKind;
  readonly title: string;
  readonly bodyDigest: string;
  readonly tenantRefDigest: string;
  readonly scopeDigest: string;
  readonly createdByRefDigest: string;
  readonly createdAt: string;
  readonly sourceStandards?: readonly AssuranceCaseSourceStandard[] | null;
}

export interface AssuranceCaseNode {
  readonly version: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly nodeId: string;
  readonly kind: AssuranceCaseNodeKind;
  readonly title: string;
  readonly bodyDigest: string;
  readonly tenantRefDigest: string;
  readonly scopeDigest: string;
  readonly createdByRefDigest: string;
  readonly createdAt: string;
  readonly sourceStandards: readonly AssuranceCaseSourceStandard[];
  readonly rawPayloadStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateAssuranceCaseDefeaterInput {
  readonly defeaterId: string;
  readonly kind: AssuranceCaseDefeaterKind;
  readonly state: AssuranceCaseDefeaterState;
  readonly attacksNodeId: string;
  readonly reasonDigest: string;
  readonly tenantRefDigest: string;
  readonly openedByRefDigest: string;
  readonly openedAt: string;
  readonly closedByEvidenceDigest?: string | null;
  readonly closedByRefDigest?: string | null;
  readonly closedAt?: string | null;
  readonly residualAcceptedByRefDigest?: string | null;
  readonly residualAcceptedAt?: string | null;
  readonly residualReasonDigest?: string | null;
}

export interface AssuranceCaseDefeater {
  readonly version: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly defeaterId: string;
  readonly kind: AssuranceCaseDefeaterKind;
  readonly state: AssuranceCaseDefeaterState;
  readonly attacksNodeId: string;
  readonly reasonDigest: string;
  readonly tenantRefDigest: string;
  readonly openedByRefDigest: string;
  readonly openedAt: string;
  readonly closedByEvidenceDigest: string | null;
  readonly closedByRefDigest: string | null;
  readonly closedAt: string | null;
  readonly residualAcceptedByRefDigest: string | null;
  readonly residualAcceptedAt: string | null;
  readonly residualReasonDigest: string | null;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateAssuranceCaseTransitionInput {
  readonly transitionId: string;
  readonly transitionKind: AssuranceCaseTransitionKind;
  readonly actorRefDigest: string;
  readonly occurredAt: string;
  readonly reasonDigest: string;
  readonly nodeId?: string | null;
  readonly defeaterId?: string | null;
  readonly fromState?: AssuranceCaseDefeaterState | null;
  readonly toState?: AssuranceCaseDefeaterState | null;
  readonly evidenceRefDigest?: string | null;
}

export interface AssuranceCaseTransition {
  readonly version: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly transitionId: string;
  readonly transitionKind: AssuranceCaseTransitionKind;
  readonly actorRefDigest: string;
  readonly occurredAt: string;
  readonly reasonDigest: string;
  readonly nodeId: string | null;
  readonly defeaterId: string | null;
  readonly fromState: AssuranceCaseDefeaterState | null;
  readonly toState: AssuranceCaseDefeaterState | null;
  readonly evidenceRefDigest: string | null;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateAssuranceCaseContractInput {
  readonly caseId: string;
  readonly tenantRefDigest: string;
  readonly rootClaimId: string;
  readonly createdAt: string;
  readonly lastReviewedAt: string;
  readonly nodes: readonly AssuranceCaseNode[];
  readonly defeaters: readonly AssuranceCaseDefeater[];
  readonly transitions: readonly AssuranceCaseTransition[];
  readonly moduleRefDigests?: readonly string[] | null;
}

export interface AssuranceCaseIndefeasibilityCheck {
  readonly allDefeatersClosed: boolean;
  readonly residualDefeatersAccepted: readonly string[];
  readonly noNewlyOpenedDefeatersSinceReview: boolean;
  readonly openDefeaterCount: number;
  readonly residualDefeaterCount: number;
  readonly closedDefeaterCount: number;
  readonly indefeasible: boolean;
}

export interface AssuranceCaseContract {
  readonly version: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly caseId: string;
  readonly caseRefDigest: string;
  readonly tenantRefDigest: string;
  readonly rootClaimId: string;
  readonly createdAt: string;
  readonly lastReviewedAt: string;
  readonly nodeCount: number;
  readonly defeaterCount: number;
  readonly transitionCount: number;
  readonly moduleRefDigests: readonly string[];
  readonly nodes: readonly AssuranceCaseNode[];
  readonly defeaters: readonly AssuranceCaseDefeater[];
  readonly transitions: readonly AssuranceCaseTransition[];
  readonly allDefeatersClosed: boolean;
  readonly noNewlyOpenedDefeatersSinceReview: boolean;
  readonly residualDefeatersAccepted: readonly string[];
  readonly openDefeaterCount: number;
  readonly residualDefeaterCount: number;
  readonly closedDefeaterCount: number;
  readonly indefeasible: boolean;
  readonly pureValueContract: true;
  readonly strengthensOnly: true;
  readonly noRawPayloadStorage: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface AssuranceCaseModuleSummary {
  readonly moduleRefDigest: string;
  readonly indefeasible: boolean;
  readonly openDefeaterCount: number;
}

export interface AssuranceCaseModuleCompositionInput {
  readonly modules: readonly AssuranceCaseModuleSummary[];
  readonly crossModuleDefeaters: readonly AssuranceCaseDefeater[];
}

export interface AssuranceCaseModuleCompositionResult {
  readonly moduleCount: number;
  readonly crossModuleDefeaterCount: number;
  readonly openCrossModuleDefeaterCount: number;
  readonly modulesIndefeasible: boolean;
  readonly crossModuleDefeatersClosed: boolean;
  readonly indefeasible: boolean;
  readonly canonical: string;
  readonly digest: string;
}

export interface AssuranceCaseScopeChangeInput {
  readonly previousClaimId: string;
  readonly nextClaimId: string;
  readonly posture: AssuranceCaseScopeChangePosture;
}

export interface AssuranceCaseScopeChangeEvaluation {
  readonly previousClaimId: string;
  readonly nextClaimId: string;
  readonly posture: AssuranceCaseScopeChangePosture;
  readonly claimIdReused: boolean;
  readonly outcome: AssuranceCaseScopeChangeOutcome;
  readonly accepted: boolean;
  readonly requiresNewClaimId: boolean;
  readonly reasonCode: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface AssuranceCaseContractDescriptor {
  readonly version: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly sourceStandards: readonly AssuranceCaseSourceStandard[];
  readonly nodeKinds: readonly AssuranceCaseNodeKind[];
  readonly linkKinds: readonly AssuranceCaseLinkKind[];
  readonly defeaterKinds: readonly AssuranceCaseDefeaterKind[];
  readonly defeaterStates: readonly AssuranceCaseDefeaterState[];
  readonly transitionKinds: readonly AssuranceCaseTransitionKind[];
  readonly scopeChangePostures: readonly AssuranceCaseScopeChangePosture[];
  readonly gsnRenderViewOnly: true;
  readonly sacmVersionTarget: 'SACM 2.3';
  readonly sacmAlignedNotConformant: true;
  readonly eliminativeArgumentation: true;
  readonly assurance2Defeasibility: true;
  readonly livingCaseTraceReady: false;
  readonly pureValueContract: true;
  readonly noRuntimeEngine: true;
  readonly noReviewerUi: true;
  readonly noLearning: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function normalizeIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string {
  if (typeof value !== 'string') {
    throw new Error(`Assurance case ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Assurance case ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Assurance case ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) return null;
  return normalizeDigest(value, fieldName);
}

function normalizeIsoTimestamp(value: string | null | undefined, fieldName: string): string {
  const timestamp = new Date(value ?? '');
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Assurance case ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeOptionalIsoTimestamp(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) return null;
  return normalizeIsoTimestamp(value, fieldName);
}

function normalizeEnum<T extends string>(
  value: T,
  allowed: readonly T[],
  fieldName: string,
): T {
  if (!allowed.includes(value)) {
    throw new Error(`Assurance case ${fieldName} is not recognized.`);
  }
  return value;
}

function normalizeSourceStandards(
  value: readonly AssuranceCaseSourceStandard[] | null | undefined,
): readonly AssuranceCaseSourceStandard[] {
  const standards = value ?? ASSURANCE_CASE_SOURCE_STANDARDS;
  if (standards.length === 0) {
    throw new Error('Assurance case sourceStandards must not be empty.');
  }
  const normalized = standards.map((standard) => normalizeEnum(
    standard,
    ASSURANCE_CASE_SOURCE_STANDARDS,
    'sourceStandards',
  ));
  return Object.freeze([...new Set(normalized)]);
}

function requireNull(value: unknown, fieldName: string, state: string): void {
  if (value !== null) {
    throw new Error(`Assurance case ${fieldName} must be null for ${state}.`);
  }
}

function requirePresent(value: string | null, fieldName: string, state: string): void {
  if (value === null) {
    throw new Error(`Assurance case ${fieldName} is required for ${state}.`);
  }
}

function digestValue(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({ kind, value }).digest;
}

export function createAssuranceCaseNode(
  input: CreateAssuranceCaseNodeInput,
): AssuranceCaseNode {
  const nodeId = normalizeIdentifier(input.nodeId, 'nodeId');
  const kind = normalizeEnum(input.kind, ASSURANCE_CASE_NODE_KINDS, 'node kind');
  const title = normalizeIdentifier(input.title, 'title');
  const node: Omit<AssuranceCaseNode, 'canonical' | 'digest'> = {
    version: ASSURANCE_CASE_CONTRACT_VERSION,
    nodeId,
    kind,
    title,
    bodyDigest: normalizeDigest(input.bodyDigest, 'bodyDigest'),
    tenantRefDigest: normalizeDigest(input.tenantRefDigest, 'tenantRefDigest'),
    scopeDigest: normalizeDigest(input.scopeDigest, 'scopeDigest'),
    createdByRefDigest: normalizeDigest(input.createdByRefDigest, 'createdByRefDigest'),
    createdAt: normalizeIsoTimestamp(input.createdAt, 'createdAt'),
    sourceStandards: normalizeSourceStandards(input.sourceStandards),
    rawPayloadStored: false,
  };
  const canonical = canonicalObject(node as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...node, ...canonical });
}

export function createAssuranceCaseDefeater(
  input: CreateAssuranceCaseDefeaterInput,
): AssuranceCaseDefeater {
  const state = normalizeEnum(
    input.state,
    ASSURANCE_CASE_DEFEATER_STATES,
    'defeater state',
  );
  const defeater: Omit<AssuranceCaseDefeater, 'canonical' | 'digest'> = {
    version: ASSURANCE_CASE_CONTRACT_VERSION,
    defeaterId: normalizeIdentifier(input.defeaterId, 'defeaterId'),
    kind: normalizeEnum(
      input.kind,
      ASSURANCE_CASE_DEFEATER_KINDS,
      'defeater kind',
    ),
    state,
    attacksNodeId: normalizeIdentifier(input.attacksNodeId, 'attacksNodeId'),
    reasonDigest: normalizeDigest(input.reasonDigest, 'reasonDigest'),
    tenantRefDigest: normalizeDigest(input.tenantRefDigest, 'tenantRefDigest'),
    openedByRefDigest: normalizeDigest(input.openedByRefDigest, 'openedByRefDigest'),
    openedAt: normalizeIsoTimestamp(input.openedAt, 'openedAt'),
    closedByEvidenceDigest: normalizeOptionalDigest(
      input.closedByEvidenceDigest,
      'closedByEvidenceDigest',
    ),
    closedByRefDigest: normalizeOptionalDigest(input.closedByRefDigest, 'closedByRefDigest'),
    closedAt: normalizeOptionalIsoTimestamp(input.closedAt, 'closedAt'),
    residualAcceptedByRefDigest: normalizeOptionalDigest(
      input.residualAcceptedByRefDigest,
      'residualAcceptedByRefDigest',
    ),
    residualAcceptedAt: normalizeOptionalIsoTimestamp(
      input.residualAcceptedAt,
      'residualAcceptedAt',
    ),
    residualReasonDigest: normalizeOptionalDigest(
      input.residualReasonDigest,
      'residualReasonDigest',
    ),
  };

  if (state === 'open') {
    requireNull(defeater.closedByEvidenceDigest, 'closedByEvidenceDigest', state);
    requireNull(defeater.closedByRefDigest, 'closedByRefDigest', state);
    requireNull(defeater.closedAt, 'closedAt', state);
    requireNull(defeater.residualAcceptedByRefDigest, 'residualAcceptedByRefDigest', state);
    requireNull(defeater.residualAcceptedAt, 'residualAcceptedAt', state);
    requireNull(defeater.residualReasonDigest, 'residualReasonDigest', state);
  } else if (state === 'closed-by-evidence') {
    requirePresent(defeater.closedByEvidenceDigest, 'closedByEvidenceDigest', state);
    requirePresent(defeater.closedByRefDigest, 'closedByRefDigest', state);
    requirePresent(defeater.closedAt, 'closedAt', state);
    requireNull(defeater.residualAcceptedByRefDigest, 'residualAcceptedByRefDigest', state);
    requireNull(defeater.residualAcceptedAt, 'residualAcceptedAt', state);
    requireNull(defeater.residualReasonDigest, 'residualReasonDigest', state);
  } else if (state === 'closed-by-scope') {
    requireNull(defeater.closedByEvidenceDigest, 'closedByEvidenceDigest', state);
    requirePresent(defeater.closedByRefDigest, 'closedByRefDigest', state);
    requirePresent(defeater.closedAt, 'closedAt', state);
    requirePresent(defeater.residualReasonDigest, 'residualReasonDigest', state);
    requireNull(defeater.residualAcceptedByRefDigest, 'residualAcceptedByRefDigest', state);
    requireNull(defeater.residualAcceptedAt, 'residualAcceptedAt', state);
  } else {
    requireNull(defeater.closedByEvidenceDigest, 'closedByEvidenceDigest', state);
    requireNull(defeater.closedByRefDigest, 'closedByRefDigest', state);
    requireNull(defeater.closedAt, 'closedAt', state);
    requirePresent(
      defeater.residualAcceptedByRefDigest,
      'residualAcceptedByRefDigest',
      state,
    );
    requirePresent(defeater.residualAcceptedAt, 'residualAcceptedAt', state);
    requirePresent(defeater.residualReasonDigest, 'residualReasonDigest', state);
  }

  const canonical = canonicalObject(defeater as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...defeater, ...canonical });
}

export function createAssuranceCaseTransition(
  input: CreateAssuranceCaseTransitionInput,
): AssuranceCaseTransition {
  const transition: Omit<AssuranceCaseTransition, 'canonical' | 'digest'> = {
    version: ASSURANCE_CASE_CONTRACT_VERSION,
    transitionId: normalizeIdentifier(input.transitionId, 'transitionId'),
    transitionKind: normalizeEnum(
      input.transitionKind,
      ASSURANCE_CASE_TRANSITION_KINDS,
      'transition kind',
    ),
    actorRefDigest: normalizeDigest(input.actorRefDigest, 'actorRefDigest'),
    occurredAt: normalizeIsoTimestamp(input.occurredAt, 'occurredAt'),
    reasonDigest: normalizeDigest(input.reasonDigest, 'reasonDigest'),
    nodeId: input.nodeId === null || input.nodeId === undefined
      ? null
      : normalizeIdentifier(input.nodeId, 'nodeId'),
    defeaterId: input.defeaterId === null || input.defeaterId === undefined
      ? null
      : normalizeIdentifier(input.defeaterId, 'defeaterId'),
    fromState: input.fromState === null || input.fromState === undefined
      ? null
      : normalizeEnum(input.fromState, ASSURANCE_CASE_DEFEATER_STATES, 'fromState'),
    toState: input.toState === null || input.toState === undefined
      ? null
      : normalizeEnum(input.toState, ASSURANCE_CASE_DEFEATER_STATES, 'toState'),
    evidenceRefDigest: normalizeOptionalDigest(input.evidenceRefDigest, 'evidenceRefDigest'),
  };
  if (transition.transitionKind === 'create-node' && transition.nodeId === null) {
    throw new Error('Assurance case create-node transition requires nodeId.');
  }
  if (
    transition.transitionKind !== 'create-node' &&
    transition.defeaterId === null
  ) {
    throw new Error('Assurance case defeater transition requires defeaterId.');
  }
  const canonical = canonicalObject(transition as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...transition, ...canonical });
}

export function evaluateAssuranceCaseIndefeasibility(input: {
  readonly defeaters: readonly AssuranceCaseDefeater[];
  readonly lastReviewedAt: string;
}): AssuranceCaseIndefeasibilityCheck {
  const lastReviewedAt = normalizeIsoTimestamp(input.lastReviewedAt, 'lastReviewedAt');
  const openDefeaters = input.defeaters.filter((defeater) => defeater.state === 'open');
  const residualDefeaters = input.defeaters.filter(
    (defeater) => defeater.state === 'residual-accepted',
  );
  const closedDefeaters = input.defeaters.filter(
    (defeater) => defeater.state === 'closed-by-evidence' ||
      defeater.state === 'closed-by-scope',
  );
  const noNewlyOpenedDefeatersSinceReview = input.defeaters.every(
    (defeater) => new Date(defeater.openedAt).getTime() <=
      new Date(lastReviewedAt).getTime(),
  );
  const residualDefeatersAccepted = residualDefeaters.map(
    (defeater) => defeater.defeaterId,
  );
  const allDefeatersClosed = openDefeaters.length === 0;
  return Object.freeze({
    allDefeatersClosed,
    residualDefeatersAccepted: Object.freeze(residualDefeatersAccepted),
    noNewlyOpenedDefeatersSinceReview,
    openDefeaterCount: openDefeaters.length,
    residualDefeaterCount: residualDefeaters.length,
    closedDefeaterCount: closedDefeaters.length,
    indefeasible: allDefeatersClosed && noNewlyOpenedDefeatersSinceReview,
  });
}

export function createAssuranceCaseContract(
  input: CreateAssuranceCaseContractInput,
): AssuranceCaseContract {
  const caseId = normalizeIdentifier(input.caseId, 'caseId');
  const tenantRefDigest = normalizeDigest(input.tenantRefDigest, 'tenantRefDigest');
  const rootClaimId = normalizeIdentifier(input.rootClaimId, 'rootClaimId');
  const nodes = Object.freeze([...input.nodes]);
  const defeaters = Object.freeze([...input.defeaters]);
  const transitions = Object.freeze([...input.transitions]);
  const moduleRefDigests = Object.freeze(
    (input.moduleRefDigests ?? []).map((digest, index) =>
      normalizeDigest(digest, `moduleRefDigests[${index}]`)),
  );

  if (nodes.length === 0) {
    throw new Error('Assurance case requires at least one node.');
  }
  const rootClaim = nodes.find((node) => node.nodeId === rootClaimId);
  if (rootClaim?.kind !== 'claim') {
    throw new Error('Assurance case rootClaimId must reference a claim node.');
  }
  for (const node of nodes) {
    if (node.tenantRefDigest !== tenantRefDigest) {
      throw new Error('Assurance case node tenantRefDigest mismatch.');
    }
  }
  for (const defeater of defeaters) {
    if (defeater.tenantRefDigest !== tenantRefDigest) {
      throw new Error('Assurance case defeater tenantRefDigest mismatch.');
    }
    if (!nodes.some((node) => node.nodeId === defeater.attacksNodeId)) {
      throw new Error('Assurance case defeater attacks unknown node.');
    }
  }

  const lastReviewedAt = normalizeIsoTimestamp(input.lastReviewedAt, 'lastReviewedAt');
  const indefeasibility = evaluateAssuranceCaseIndefeasibility({
    defeaters,
    lastReviewedAt,
  });
  const createdAt = normalizeIsoTimestamp(input.createdAt, 'createdAt');
  const core: Omit<AssuranceCaseContract, 'caseRefDigest' | 'canonical' | 'digest'> = {
    version: ASSURANCE_CASE_CONTRACT_VERSION,
    caseId,
    tenantRefDigest,
    rootClaimId,
    createdAt,
    lastReviewedAt,
    nodeCount: nodes.length,
    defeaterCount: defeaters.length,
    transitionCount: transitions.length,
    moduleRefDigests,
    nodes,
    defeaters,
    transitions,
    allDefeatersClosed: indefeasibility.allDefeatersClosed,
    noNewlyOpenedDefeatersSinceReview:
      indefeasibility.noNewlyOpenedDefeatersSinceReview,
    residualDefeatersAccepted: indefeasibility.residualDefeatersAccepted,
    openDefeaterCount: indefeasibility.openDefeaterCount,
    residualDefeaterCount: indefeasibility.residualDefeaterCount,
    closedDefeaterCount: indefeasibility.closedDefeaterCount,
    indefeasible: indefeasibility.indefeasible,
    pureValueContract: true,
    strengthensOnly: true,
    noRawPayloadStorage: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };
  const caseRefDigest = digestValue('assurance-case-ref', {
    caseId: core.caseId,
    tenantRefDigest: core.tenantRefDigest,
    rootClaimId: core.rootClaimId,
    createdAt: core.createdAt,
  });
  const canonical = canonicalObject({
    ...core,
    caseRefDigest,
  } as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...core, caseRefDigest, ...canonical });
}

export function evaluateAssuranceCaseModuleComposition(
  input: AssuranceCaseModuleCompositionInput,
): AssuranceCaseModuleCompositionResult {
  const modules = Object.freeze(input.modules.map((module, index) => Object.freeze({
    moduleRefDigest: normalizeDigest(module.moduleRefDigest, `modules[${index}].moduleRefDigest`),
    indefeasible: module.indefeasible,
    openDefeaterCount: module.openDefeaterCount,
  })));
  const crossModuleDefeaters = Object.freeze([...input.crossModuleDefeaters]);
  const openCrossModuleDefeaterCount = crossModuleDefeaters.filter(
    (defeater) => defeater.state === 'open',
  ).length;
  const modulesIndefeasible = modules.every(
    (module) => module.indefeasible && module.openDefeaterCount === 0,
  );
  const crossModuleDefeatersClosed = openCrossModuleDefeaterCount === 0;
  const core = {
    moduleCount: modules.length,
    crossModuleDefeaterCount: crossModuleDefeaters.length,
    openCrossModuleDefeaterCount,
    modulesIndefeasible,
    crossModuleDefeatersClosed,
    indefeasible: modulesIndefeasible && crossModuleDefeatersClosed,
  };
  const canonical = canonicalObject(core);
  return Object.freeze({ ...core, ...canonical });
}

export function evaluateAssuranceCaseScopeChange(
  input: AssuranceCaseScopeChangeInput,
): AssuranceCaseScopeChangeEvaluation {
  const previousClaimId = normalizeIdentifier(input.previousClaimId, 'previousClaimId');
  const nextClaimId = normalizeIdentifier(input.nextClaimId, 'nextClaimId');
  const posture = normalizeEnum(
    input.posture,
    ASSURANCE_CASE_SCOPE_CHANGE_POSTURES,
    'scope change posture',
  );
  const claimIdReused = previousClaimId === nextClaimId;
  const broadeningRejected = posture === 'broadens-scope' && claimIdReused;
  const outcome: AssuranceCaseScopeChangeOutcome = broadeningRejected
    ? 'rejected-in-place-scope-broadening'
    : posture === 'narrows-scope'
      ? 'accepted-narrowing'
      : 'accepted-same-scope';
  const core = {
    previousClaimId,
    nextClaimId,
    posture,
    claimIdReused,
    outcome,
    accepted: !broadeningRejected,
    requiresNewClaimId: posture === 'broadens-scope',
    reasonCode: broadeningRejected
      ? 'scope-broadening-requires-new-claim'
      : 'scope-change-accepted',
  };
  const canonical = canonicalObject(core);
  return Object.freeze({ ...core, ...canonical });
}

export function assuranceCaseContractDescriptor(): AssuranceCaseContractDescriptor {
  return Object.freeze({
    version: ASSURANCE_CASE_CONTRACT_VERSION,
    sourceStandards: ASSURANCE_CASE_SOURCE_STANDARDS,
    nodeKinds: ASSURANCE_CASE_NODE_KINDS,
    linkKinds: ASSURANCE_CASE_LINK_KINDS,
    defeaterKinds: ASSURANCE_CASE_DEFEATER_KINDS,
    defeaterStates: ASSURANCE_CASE_DEFEATER_STATES,
    transitionKinds: ASSURANCE_CASE_TRANSITION_KINDS,
    scopeChangePostures: ASSURANCE_CASE_SCOPE_CHANGE_POSTURES,
    gsnRenderViewOnly: true,
    sacmVersionTarget: 'SACM 2.3',
    sacmAlignedNotConformant: true,
    eliminativeArgumentation: true,
    assurance2Defeasibility: true,
    livingCaseTraceReady: false,
    pureValueContract: true,
    noRuntimeEngine: true,
    noReviewerUi: true,
    noLearning: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-live-enforcement',
      'not-runtime-assurance-engine',
      'not-sacm-conformance-claim',
      'not-gsn-tooling',
      'not-formal-proof',
      'not-reviewer-ui',
      'not-learning-system',
      'not-policy-activation',
      'not-production-ready',
    ]),
  });
}
