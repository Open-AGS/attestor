import type { ShadowModeReleaseEvaluator } from '../../release-layer/index.js';
import type {
  RequestPathDegradedModeGrantStore,
  RequestPathPolicyActivationApprovalStore,
  RequestPathPolicyControlPlaneStore,
  RequestPathPolicyMutationAuditLogWriter,
  RequestPathReleaseDecisionEngine,
  RequestPathReleaseDecisionLogWriter,
  RequestPathReleaseEvidencePackStore,
  RequestPathReleaseReviewerQueueStore,
  RequestPathReleaseShadowEvaluator,
  RequestPathReleaseTokenIntrospectionStore,
} from '../release/release-authority-request-path.js';

function unavailableAuthorityError(component: string): Error {
  return new Error(
    `Production-shared release authority request path is fail-closed because ${component} is not wired to the shared authority store.`,
  );
}

export function unavailableDecisionLog(): RequestPathReleaseDecisionLogWriter {
  return {
    append: () => {
      throw unavailableAuthorityError('release decision log');
    },
    entries: () => {
      throw unavailableAuthorityError('release decision log');
    },
    latestEntryDigest: () => {
      throw unavailableAuthorityError('release decision log');
    },
    verify: () => {
      throw unavailableAuthorityError('release decision log');
    },
  };
}

export function unavailableReviewerQueue(): RequestPathReleaseReviewerQueueStore {
  return {
    upsert: () => {
      throw unavailableAuthorityError('release reviewer queue');
    },
    commitPendingTransition: () => {
      throw unavailableAuthorityError('release reviewer queue');
    },
    get: () => {
      throw unavailableAuthorityError('release reviewer queue');
    },
    getRecord: () => {
      throw unavailableAuthorityError('release reviewer queue');
    },
    listPending: () => {
      throw unavailableAuthorityError('release reviewer queue');
    },
  };
}

export function unavailableTokenIntrospection(): RequestPathReleaseTokenIntrospectionStore {
  return {
    registerIssuedToken: () => {
      throw unavailableAuthorityError('release token introspection store');
    },
    findToken: () => {
      throw unavailableAuthorityError('release token introspection store');
    },
    revokeToken: () => {
      throw unavailableAuthorityError('release token introspection store');
    },
    syncLifecycle: () => {
      throw unavailableAuthorityError('release token introspection store');
    },
    recordTokenUse: () => {
      throw unavailableAuthorityError('release token introspection store');
    },
  };
}

export function unavailableEvidencePackStore(): RequestPathReleaseEvidencePackStore {
  return {
    upsert: () => {
      throw unavailableAuthorityError('release evidence pack store');
    },
    get: () => {
      throw unavailableAuthorityError('release evidence pack store');
    },
  };
}

export function unavailableDegradedModeGrantStore(): RequestPathDegradedModeGrantStore {
  return {
    registerGrant: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
    findGrant: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
    listGrants: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
    revokeGrant: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
    consumeGrant: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
    listAuditRecords: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
    auditHead: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
  };
}

export function unavailablePolicyStore(): RequestPathPolicyControlPlaneStore {
  return {
    kind: 'postgres',
    getMetadata: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    setMetadata: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    upsertPack: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    getPack: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    listPacks: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    upsertBundle: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    getBundle: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    listBundleHistory: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    listBundles: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    upsertActivation: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    getActivation: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    listActivations: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    exportSnapshot: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
  };
}

export function unavailableApprovalStore(): RequestPathPolicyActivationApprovalStore {
  return {
    kind: 'postgres',
    upsert: () => {
      throw unavailableAuthorityError('policy activation approval store');
    },
    get: () => {
      throw unavailableAuthorityError('policy activation approval store');
    },
    list: () => {
      throw unavailableAuthorityError('policy activation approval store');
    },
    exportSnapshot: () => {
      throw unavailableAuthorityError('policy activation approval store');
    },
  };
}

export function unavailablePolicyAuditLog(): RequestPathPolicyMutationAuditLogWriter {
  return {
    kind: 'postgres',
    append: () => {
      throw unavailableAuthorityError('policy mutation audit log');
    },
    entries: () => {
      throw unavailableAuthorityError('policy mutation audit log');
    },
    latestEntryDigest: () => {
      throw unavailableAuthorityError('policy mutation audit log');
    },
    verify: () => {
      throw unavailableAuthorityError('policy mutation audit log');
    },
    exportSnapshot: () => {
      throw unavailableAuthorityError('policy mutation audit log');
    },
  };
}

export function unavailableReleaseDecisionEngine(): RequestPathReleaseDecisionEngine {
  return {
    evaluate: () => {
      throw unavailableAuthorityError('release decision engine');
    },
    evaluateWithDeterministicChecks: () => {
      throw unavailableAuthorityError('release decision engine');
    },
  };
}

export function unavailableShadowEvaluator(): RequestPathReleaseShadowEvaluator<
  ReturnType<ShadowModeReleaseEvaluator['evaluate']>
> {
  return {
    evaluate: () => {
      throw unavailableAuthorityError('release shadow evaluator');
    },
  };
}
