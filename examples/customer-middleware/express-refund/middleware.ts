import {
  decisionCanExecute,
  holdDecision,
  intentForExecution,
  type CustomerMiddlewareAdmissionClient,
} from '../shared/admission.js';

export interface RefundRequestBody {
  readonly customerRef: string;
  readonly orderRef: string;
  readonly paymentRef: string;
  readonly amountMinorUnits: number;
  readonly currency: 'USD';
  readonly evidenceRefs: readonly string[];
  readonly managerApprovalRef?: string;
}

export interface RefundAdmissionIntent {
  readonly mode: 'observe' | 'warn' | 'review' | 'enforce';
  readonly actor: string;
  readonly action: 'issue_refund';
  readonly domain: 'money-movement';
  readonly downstreamSystem: 'refund-service';
  readonly requestedAt: string;
  readonly policyRef: string;
  readonly amount: {
    readonly value: number;
    readonly currency: 'USD';
  };
  readonly recipient: string;
  readonly evidenceRefs: readonly string[];
  readonly authorityMode?: 'manager-approval';
  readonly nativeInputRefs: readonly string[];
  readonly summary: string;
}

export interface ExpressLikeRequest {
  readonly body: RefundRequestBody;
}

export interface ExpressLikeResponse {
  status(code: number): ExpressLikeResponse;
  json(body: unknown): void;
}

export interface RefundService {
  issueRefund(input: {
    readonly customerRef: string;
    readonly orderRef: string;
    readonly paymentRef: string;
    readonly amountMinorUnits: number;
    readonly currency: 'USD';
  }): Promise<{ readonly refundRef: string; readonly amountMinorUnits: number }>;
}

export interface ExpressRefundHandlerDeps {
  readonly attestor: CustomerMiddlewareAdmissionClient<RefundAdmissionIntent>;
  readonly refundService: RefundService;
  readonly now: () => string;
}

export function buildRefundAdmissionIntent(
  body: RefundRequestBody,
  requestedAt: string,
): RefundAdmissionIntent {
  return {
    mode: 'observe',
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt,
    policyRef: 'policy:refunds:v1',
    amount: {
      value: body.amountMinorUnits,
      currency: body.currency,
    },
    recipient: body.customerRef,
    evidenceRefs: body.evidenceRefs,
    authorityMode: body.managerApprovalRef ? 'manager-approval' : undefined,
    nativeInputRefs: [body.orderRef, body.paymentRef],
    summary: 'Support AI requested a refund before the refund service call.',
  };
}

function refundCommandFor(
  body: RefundRequestBody,
  boundedIntent: RefundAdmissionIntent,
): Parameters<RefundService['issueRefund']>[0] {
  return {
    customerRef: boundedIntent.recipient,
    orderRef: body.orderRef,
    paymentRef: body.paymentRef,
    amountMinorUnits: boundedIntent.amount.value,
    currency: boundedIntent.amount.currency,
  };
}

export function createExpressRefundHandler(deps: ExpressRefundHandlerDeps) {
  return async function refundHandler(
    req: ExpressLikeRequest,
    res: ExpressLikeResponse,
  ): Promise<void> {
    const proposedIntent = buildRefundAdmissionIntent(req.body, deps.now());
    const decision = await deps.attestor.admit(proposedIntent);

    if (!decisionCanExecute(decision)) {
      const held = holdDecision(decision);
      res.status(held.status).json(held.body);
      return;
    }

    const boundedIntent = intentForExecution(proposedIntent, decision);
    const refund = await deps.refundService.issueRefund(
      refundCommandFor(req.body, boundedIntent),
    );

    res.status(200).json({
      refund,
      attestor: {
        outcome: decision.outcome,
        reasonCodes: decision.reasonCodes,
        proofRefs: decision.proofRefs,
      },
    });
  };
}
