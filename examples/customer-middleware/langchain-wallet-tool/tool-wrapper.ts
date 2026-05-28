import {
  decisionCanExecute,
  holdDecision,
  intentForExecution,
  type CustomerMiddlewareAdmissionClient,
} from '../shared/admission.js';

export interface WalletToolInput {
  readonly actor: string;
  readonly walletRef: string;
  readonly targetRef: string;
  readonly amountAtomic: string;
  readonly asset: string;
  readonly chain: string;
  readonly evidenceRefs: readonly string[];
}

export interface WalletAdmissionIntent {
  readonly mode: 'observe' | 'warn' | 'review' | 'enforce';
  readonly actor: string;
  readonly action: 'wallet_payment';
  readonly domain: 'programmable-money';
  readonly downstreamSystem: 'wallet-tool';
  readonly policyRef: string;
  readonly amount: {
    readonly value: string;
    readonly asset: string;
    readonly chain: string;
  };
  readonly recipient: string;
  readonly evidenceRefs: readonly string[];
  readonly nativeInputRefs: readonly string[];
  readonly summary: string;
}

export interface ToolLike<TInput, TResult> {
  invoke(input: TInput): Promise<TResult>;
}

export type WalletToolResult =
  | {
      readonly held: true;
      readonly outcome: 'review' | 'block';
      readonly reasonCodes: readonly string[];
      readonly proofRefs: readonly string[];
    }
  | {
      readonly held: false;
      readonly outcome: 'admit' | 'narrow';
      readonly proofRefs: readonly string[];
      readonly result: unknown;
    };

export interface WalletToolWrapperDeps<TResult> {
  readonly attestor: CustomerMiddlewareAdmissionClient<WalletAdmissionIntent>;
  readonly tool: ToolLike<WalletToolInput, TResult>;
}

export function buildWalletAdmissionIntent(
  input: WalletToolInput,
): WalletAdmissionIntent {
  return {
    mode: 'observe',
    actor: input.actor,
    action: 'wallet_payment',
    domain: 'programmable-money',
    downstreamSystem: 'wallet-tool',
    policyRef: 'policy:wallet-payment:v1',
    amount: {
      value: input.amountAtomic,
      asset: input.asset,
      chain: input.chain,
    },
    recipient: input.targetRef,
    evidenceRefs: input.evidenceRefs,
    nativeInputRefs: [input.walletRef, input.targetRef],
    summary: 'Agent tool requested a wallet-facing payment before tool execution.',
  };
}

function toolInputFor(
  originalInput: WalletToolInput,
  boundedIntent: WalletAdmissionIntent,
): WalletToolInput {
  return {
    ...originalInput,
    targetRef: boundedIntent.recipient,
    amountAtomic: boundedIntent.amount.value,
    asset: boundedIntent.amount.asset,
    chain: boundedIntent.amount.chain,
  };
}

export function wrapWalletToolWithAttestor<TResult>(
  deps: WalletToolWrapperDeps<TResult>,
) {
  return async function admittedWalletTool(
    input: WalletToolInput,
  ): Promise<WalletToolResult> {
    const proposedIntent = buildWalletAdmissionIntent(input);
    const decision = await deps.attestor.admit(proposedIntent);

    if (!decisionCanExecute(decision)) {
      const held = holdDecision(decision);
      return {
        held: true,
        outcome: held.body.outcome,
        reasonCodes: held.body.reasonCodes,
        proofRefs: held.body.proofRefs,
      };
    }

    const boundedIntent = intentForExecution(proposedIntent, decision);
    const result = await deps.tool.invoke(toolInputFor(input, boundedIntent));

    return {
      held: false,
      outcome: decision.outcome,
      proofRefs: decision.proofRefs,
      result,
    };
  };
}
