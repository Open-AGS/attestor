import {
  decisionCanExecute,
  holdDecision,
  intentForExecution,
  type CustomerMiddlewareAdmissionClient,
} from '../shared/admission.js';

export interface PermissionChangeBody {
  readonly actor: string;
  readonly subjectRef: string;
  readonly requestedRole: string;
  readonly resourceRef: string;
  readonly approvalRef?: string;
  readonly evidenceRefs: readonly string[];
}

export interface PermissionAdmissionIntent {
  readonly mode: 'observe' | 'warn' | 'review' | 'enforce';
  readonly actor: string;
  readonly action: 'grant_role';
  readonly domain: 'authority-change';
  readonly downstreamSystem: 'identity-admin-service';
  readonly policyRef: string;
  readonly authorityMode?: 'approval-bound';
  readonly recipient: string;
  readonly evidenceRefs: readonly string[];
  readonly requestedScope: {
    readonly role: string;
    readonly resourceRef: string;
  };
  readonly nativeInputRefs: readonly string[];
  readonly summary: string;
}

export interface JsonRequest {
  json(): Promise<PermissionChangeBody>;
}

export interface JsonResult {
  readonly status: number;
  readonly body: unknown;
}

export interface IdentityAdminService {
  grantRole(input: {
    readonly subjectRef: string;
    readonly role: string;
    readonly resourceRef: string;
  }): Promise<{ readonly grantRef: string }>;
}

export interface NextPermissionRouteDeps {
  readonly attestor: CustomerMiddlewareAdmissionClient<PermissionAdmissionIntent>;
  readonly identityAdmin: IdentityAdminService;
}

export function buildPermissionAdmissionIntent(
  body: PermissionChangeBody,
): PermissionAdmissionIntent {
  return {
    mode: 'observe',
    actor: body.actor,
    action: 'grant_role',
    domain: 'authority-change',
    downstreamSystem: 'identity-admin-service',
    policyRef: 'policy:access-change:v1',
    authorityMode: body.approvalRef ? 'approval-bound' : undefined,
    recipient: body.subjectRef,
    evidenceRefs: body.evidenceRefs,
    requestedScope: {
      role: body.requestedRole,
      resourceRef: body.resourceRef,
    },
    nativeInputRefs: [body.resourceRef, body.approvalRef ?? 'approval:missing'],
    summary: 'AI requested a role grant before identity-admin execution.',
  };
}

export async function handlePermissionChange(
  request: JsonRequest,
  deps: NextPermissionRouteDeps,
): Promise<JsonResult> {
  const body = await request.json();
  const proposedIntent = buildPermissionAdmissionIntent(body);
  const decision = await deps.attestor.admit(proposedIntent);

  if (!decisionCanExecute(decision)) {
    const held = holdDecision(decision);
    return held;
  }

  const boundedIntent = intentForExecution(proposedIntent, decision);
  const grant = await deps.identityAdmin.grantRole({
    subjectRef: boundedIntent.recipient,
    role: boundedIntent.requestedScope.role,
    resourceRef: boundedIntent.requestedScope.resourceRef,
  });

  return {
    status: 200,
    body: {
      grant,
      attestor: {
        outcome: decision.outcome,
        reasonCodes: decision.reasonCodes,
        proofRefs: decision.proofRefs,
      },
    },
  };
}
