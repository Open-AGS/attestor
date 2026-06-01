import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGenericAdmissionEnvelope } from '../src/consequence-admission/index.js';
import {
  buildRefundAdmissionIntent,
  createExpressRefundHandler,
  type ExpressLikeResponse,
  type RefundRequestBody,
} from '../examples/customer-middleware/express-refund/middleware.js';
import {
  buildPermissionAdmissionIntent,
  handlePermissionChange,
  type PermissionChangeBody,
} from '../examples/customer-middleware/nextjs-permission-change/route.js';
import {
  buildWalletAdmissionIntent,
  wrapWalletToolWithAttestor,
  type WalletToolInput,
} from '../examples/customer-middleware/langchain-wallet-tool/tool-wrapper.js';
import type {
  CustomerMiddlewareDecision,
  CustomerMiddlewareProofRef,
} from '../examples/customer-middleware/shared/admission.js';

let passed = 0;

const DEMO_SHA256 = `sha256:${'a'.repeat(64)}`;

function releaseProofRef(id: string): CustomerMiddlewareProofRef {
  return {
    kind: 'release-token',
    id,
    digest: DEMO_SHA256,
    uri: null,
    verifyHint: 'Verify the release token at the customer-owned enforcement point.',
  };
}

function admissionReceiptRef(id: string): CustomerMiddlewareProofRef {
  return {
    kind: 'admission-receipt',
    id,
    digest: DEMO_SHA256,
    uri: null,
    verifyHint: 'Receipt only; not execution proof.',
  };
}

function middlewareDecision<TIntent>(
  overrides: Partial<CustomerMiddlewareDecision<TIntent>> = {},
): CustomerMiddlewareDecision<TIntent> {
  return {
    outcome: 'admit',
    mode: 'enforce',
    allowed: true,
    failClosed: false,
    proofSatisfied: true,
    requiredChecksSatisfied: true,
    reasonCodes: ['demo-admitted'],
    proofRefs: [releaseProofRef('proof:demo-execution')],
    ...overrides,
  };
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
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

function assertEnvelopeAccepts(payload: unknown, message: string): void {
  const envelope = createGenericAdmissionEnvelope(payload);
  assert.equal(envelope.admission.request.entryPoint.route, '/api/v1/admissions', message);
  assert.equal(envelope.admission.operationalContext?.nonEnforcingMode, true, message);
  passed += 2;
}

function refundBody(overrides: Partial<RefundRequestBody> = {}): RefundRequestBody {
  return {
    customerRef: 'customer:demo-refund',
    orderRef: 'order:demo-refund',
    paymentRef: 'payment:demo-refund',
    amountMinorUnits: 38000,
    currency: 'USD',
    evidenceRefs: ['ticket:demo-refund', 'receipt:demo-payment'],
    ...overrides,
  };
}

function responseRecorder(): ExpressLikeResponse & {
  readonly recorded: { status: number | null; body: unknown };
} {
  const recorded = { status: null as number | null, body: null as unknown };
  return {
    recorded,
    status(code: number) {
      recorded.status = code;
      return this;
    },
    json(body: unknown) {
      recorded.body = body;
    },
  };
}

async function testExpressRefundGate(): Promise<void> {
  const payload = buildRefundAdmissionIntent(refundBody(), '2026-05-28T08:00:00.000Z');
  assertEnvelopeAccepts(payload, 'Express refund payload compiles against generic admission');

  const refundCalls: unknown[] = [];
  const reviewHandler = createExpressRefundHandler({
    now: () => '2026-05-28T08:00:00.000Z',
    attestor: {
      admit: async () => middlewareDecision<ReturnType<typeof buildRefundAdmissionIntent>>({
        outcome: 'review',
        allowed: false,
        reasonCodes: ['approval-missing'],
        proofRefs: [releaseProofRef('proof:demo-refund-review')],
      }),
    },
    refundService: {
      issueRefund: async (input) => {
        refundCalls.push(input);
        return { refundRef: 'refund:demo', amountMinorUnits: input.amountMinorUnits };
      },
    },
  });
  const heldResponse = responseRecorder();
  await reviewHandler({ body: refundBody() }, heldResponse);
  assert.equal(heldResponse.recorded.status, 202, 'Review returns hold status');
  assert.deepEqual(refundCalls, [], 'Review does not call refund service');
  passed += 2;

  const observeAdmitHandler = createExpressRefundHandler({
    now: () => '2026-05-28T08:00:00.000Z',
    attestor: {
      admit: async () => middlewareDecision<ReturnType<typeof buildRefundAdmissionIntent>>({
        outcome: 'admit',
        mode: 'observe',
        reasonCodes: ['observe-effective-admit'],
        proofRefs: [releaseProofRef('proof:demo-refund-observe')],
      }),
    },
    refundService: {
      issueRefund: async (input) => {
        refundCalls.push(input);
        return { refundRef: 'refund:demo-observe', amountMinorUnits: input.amountMinorUnits };
      },
    },
  });
  const observeResponse = responseRecorder();
  await observeAdmitHandler({ body: refundBody() }, observeResponse);
  assert.equal(observeResponse.recorded.status, 202, 'Observe admit returns hold status');
  assert.deepEqual(refundCalls, [], 'Observe admit does not call refund service');
  passed += 2;

  const narrowHandler = createExpressRefundHandler({
    now: () => '2026-05-28T08:00:00.000Z',
    attestor: {
      admit: async (intent) => middlewareDecision<ReturnType<typeof buildRefundAdmissionIntent>>({
        outcome: 'narrow',
        reasonCodes: ['amount-capped'],
        proofRefs: [releaseProofRef('proof:demo-refund-narrow')],
        narrowedIntent: {
          ...intent,
          amount: { value: 10000, currency: 'USD' },
        },
      }),
    },
    refundService: {
      issueRefund: async (input) => {
        refundCalls.push(input);
        return { refundRef: 'refund:demo-narrow', amountMinorUnits: input.amountMinorUnits };
      },
    },
  });
  const okResponse = responseRecorder();
  await narrowHandler({ body: refundBody() }, okResponse);
  assert.equal(okResponse.recorded.status, 200, 'Narrow can proceed');
  assert.equal(
    (refundCalls.at(-1) as { amountMinorUnits: number }).amountMinorUnits,
    10000,
    'Narrow calls refund service with bounded amount',
  );
  passed += 2;

  const receiptOnlyHandler = createExpressRefundHandler({
    now: () => '2026-05-28T08:00:00.000Z',
    attestor: {
      admit: async () => middlewareDecision<ReturnType<typeof buildRefundAdmissionIntent>>({
        outcome: 'admit',
        reasonCodes: ['receipt-only'],
        proofRefs: [admissionReceiptRef('receipt:demo-refund')],
      }),
    },
    refundService: {
      issueRefund: async (input) => {
        refundCalls.push(input);
        return { refundRef: 'refund:demo-receipt', amountMinorUnits: input.amountMinorUnits };
      },
    },
  });
  const receiptOnlyResponse = responseRecorder();
  await receiptOnlyHandler({ body: refundBody() }, receiptOnlyResponse);
  assert.equal(receiptOnlyResponse.recorded.status, 202, 'Receipt-only admit returns hold status');
  assert.equal(refundCalls.length, 1, 'Receipt-only admit does not call refund service');
  passed += 2;
}

async function testNextPermissionGate(): Promise<void> {
  const body: PermissionChangeBody = {
    actor: 'admin-ai-agent',
    subjectRef: 'user:demo-access',
    requestedRole: 'billing-admin',
    resourceRef: 'workspace:demo',
    evidenceRefs: ['ticket:demo-access'],
  };
  assertEnvelopeAccepts(
    buildPermissionAdmissionIntent(body),
    'Next permission payload compiles against generic admission',
  );

  const grants: unknown[] = [];
  const blocked = await handlePermissionChange(
    { json: async () => body },
    {
      attestor: {
        admit: async () => middlewareDecision<ReturnType<typeof buildPermissionAdmissionIntent>>({
          outcome: 'block',
          allowed: false,
          failClosed: true,
          reasonCodes: ['approval-provenance-missing'],
          proofRefs: [releaseProofRef('proof:demo-access-block')],
        }),
      },
      identityAdmin: {
        grantRole: async (input) => {
          grants.push(input);
          return { grantRef: 'grant:demo' };
        },
      },
    },
  );
  assert.equal(blocked.status, 409, 'Block returns conflict status');
  assert.deepEqual(grants, [], 'Block does not call identity admin');
  passed += 2;

  const warnNarrow = await handlePermissionChange(
    { json: async () => body },
    {
      attestor: {
        admit: async (intent) => middlewareDecision<ReturnType<typeof buildPermissionAdmissionIntent>>({
          outcome: 'narrow',
          mode: 'warn',
          reasonCodes: ['warn-effective-narrow'],
          proofRefs: [releaseProofRef('proof:demo-access-warn')],
          narrowedIntent: {
            ...intent,
            requestedScope: {
              role: 'billing-viewer',
              resourceRef: 'workspace:demo',
            },
          },
        }),
      },
      identityAdmin: {
        grantRole: async (input) => {
          grants.push(input);
          return { grantRef: 'grant:demo-warn' };
        },
      },
    },
  );
  assert.equal(warnNarrow.status, 202, 'Warn narrow returns hold status');
  assert.deepEqual(grants, [], 'Warn narrow does not call identity admin');
  passed += 2;

  const narrowed = await handlePermissionChange(
    { json: async () => body },
    {
      attestor: {
        admit: async (intent) => middlewareDecision<ReturnType<typeof buildPermissionAdmissionIntent>>({
          outcome: 'narrow',
          reasonCodes: ['role-scope-reduced'],
          proofRefs: [releaseProofRef('proof:demo-access-narrow')],
          narrowedIntent: {
            ...intent,
            requestedScope: {
              role: 'billing-viewer',
              resourceRef: 'workspace:demo',
            },
          },
        }),
      },
      identityAdmin: {
        grantRole: async (input) => {
          grants.push(input);
          return { grantRef: 'grant:demo-narrow' };
        },
      },
    },
  );
  assert.equal(narrowed.status, 200, 'Narrow permission change proceeds');
  assert.equal(
    (grants.at(-1) as { role: string }).role,
    'billing-viewer',
    'Narrow calls identity admin with bounded role',
  );
  passed += 2;
}

async function testLangChainWalletGate(): Promise<void> {
  const input: WalletToolInput = {
    actor: 'wallet-ai-agent',
    walletRef: 'wallet:demo-ops',
    targetRef: 'counterparty:demo-vendor',
    amountAtomic: '2500000',
    asset: 'USDC',
    chain: 'eip155:8453',
    evidenceRefs: ['invoice:demo-vendor'],
  };
  assertEnvelopeAccepts(
    buildWalletAdmissionIntent(input),
    'LangChain wallet payload compiles against generic admission',
  );

  const toolCalls: WalletToolInput[] = [];
  const blockedWrapper = wrapWalletToolWithAttestor({
    attestor: {
      admit: async () => middlewareDecision<ReturnType<typeof buildWalletAdmissionIntent>>({
        outcome: 'block',
        allowed: false,
        failClosed: true,
        reasonCodes: ['wallet-policy-missing'],
        proofRefs: [releaseProofRef('proof:demo-wallet-block')],
      }),
    },
    tool: {
      invoke: async (toolInput: WalletToolInput) => {
        toolCalls.push(toolInput);
        return { txRef: 'tx:demo' };
      },
    },
  });
  const blocked = await blockedWrapper(input);
  assert.equal(blocked.held, true, 'Block returns a held tool result');
  assert.deepEqual(toolCalls, [], 'Block does not call wallet-facing tool');
  passed += 2;

  const missingProofWrapper = wrapWalletToolWithAttestor({
    attestor: {
      admit: async () => middlewareDecision<ReturnType<typeof buildWalletAdmissionIntent>>({
        outcome: 'admit',
        proofSatisfied: false,
        proofRefs: [],
        reasonCodes: ['proof-missing'],
      }),
    },
    tool: {
      invoke: async (toolInput: WalletToolInput) => {
        toolCalls.push(toolInput);
        return { txRef: 'tx:demo-missing-proof' };
      },
    },
  });
  const missingProof = await missingProofWrapper(input);
  assert.equal(missingProof.held, true, 'Missing proof returns a held tool result');
  if (missingProof.held) {
    assert.equal(missingProof.outcome, 'admit', 'Missing proof keeps the held admit outcome visible');
    assert.equal(missingProof.gateReason, 'execution-proof', 'Missing proof exposes the gate reason');
    assert.equal(missingProof.nextStep, 'add-execution-proof', 'Missing proof exposes the next safe step');
    passed += 3;
  }
  assert.deepEqual(toolCalls, [], 'Missing proof does not call wallet-facing tool');
  passed += 2;

  const warnNarrowWrapper = wrapWalletToolWithAttestor({
    attestor: {
      admit: async (intent) => middlewareDecision<ReturnType<typeof buildWalletAdmissionIntent>>({
        outcome: 'narrow',
        mode: 'warn',
        reasonCodes: ['warn-effective-narrow'],
        proofRefs: [releaseProofRef('proof:demo-wallet-warn-narrow')],
        narrowedIntent: {
          ...intent,
          amount: {
            ...intent.amount,
            value: '1000000',
          },
        },
      }),
    },
    tool: {
      invoke: async (toolInput: WalletToolInput) => {
        toolCalls.push(toolInput);
        return { txRef: 'tx:demo-warn-narrow' };
      },
    },
  });
  const warnNarrow = await warnNarrowWrapper(input);
  assert.equal(warnNarrow.held, true, 'Warn-mode narrow returns a held tool result');
  if (warnNarrow.held) {
    assert.equal(warnNarrow.outcome, 'narrow', 'Warn-mode narrow keeps the held narrow outcome visible');
    assert.equal(warnNarrow.mode, 'warn', 'Warn-mode narrow exposes non-enforcing mode');
    assert.equal(warnNarrow.gateReason, 'non-enforcing-mode', 'Warn-mode narrow exposes the gate reason');
    passed += 3;
  }
  assert.deepEqual(toolCalls, [], 'Warn-mode narrow does not call wallet-facing tool');
  passed += 2;

  const narrowedWrapper = wrapWalletToolWithAttestor({
    attestor: {
      admit: async (intent) => middlewareDecision<ReturnType<typeof buildWalletAdmissionIntent>>({
        outcome: 'narrow',
        reasonCodes: ['amount-capped'],
        proofRefs: [releaseProofRef('proof:demo-wallet-narrow')],
        narrowedIntent: {
          ...intent,
          amount: {
            ...intent.amount,
            value: '1000000',
          },
        },
      }),
    },
    tool: {
      invoke: async (toolInput: WalletToolInput) => {
        toolCalls.push(toolInput);
        return { txRef: 'tx:demo-narrow' };
      },
    },
  });
  const narrowed = await narrowedWrapper(input);
  assert.equal(narrowed.held, false, 'Narrow can call the wallet-facing tool');
  assert.equal(toolCalls.at(-1)?.amountAtomic, '1000000', 'Narrow uses bounded amount');
  passed += 2;
}

function testDocsAndScripts(): void {
  const rootReadme = readProjectFile('examples', 'customer-middleware', 'README.md');
  const expressReadme = readProjectFile(
    'examples',
    'customer-middleware',
    'express-refund',
    'README.md',
  );
  const fastapiReadme = readProjectFile(
    'examples',
    'customer-middleware',
    'fastapi-data-export',
    'README.md',
  );
  const nextReadme = readProjectFile(
    'examples',
    'customer-middleware',
    'nextjs-permission-change',
    'README.md',
  );
  const langchainReadme = readProjectFile(
    'examples',
    'customer-middleware',
    'langchain-wallet-tool',
    'README.md',
  );
  const fastapiTest = readProjectFile(
    'examples',
    'customer-middleware',
    'fastapi-data-export',
    'test_middleware.py',
  );
  const docsFrontDoor = readProjectFile('docs', 'README.md');
  const integrationHub = readProjectFile('docs', '01-overview', 'how-to-integrate-attestor.md');
  const recipes = readProjectFile('docs', '01-overview', 'customer-integration-recipes.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(rootReadme, 'They are not an SDK.', 'Root examples doc keeps SDK boundary');
  includes(rootReadme, 'immediately before a real side effect', 'Root examples doc places the gate');
  includes(rootReadme, 'does not prove live customer PEP', 'Root examples doc keeps live-proof no-claim');
  includes(expressReadme, 'https://expressjs.com/en/guide/using-middleware/', 'Express source anchor is present');
  includes(fastapiReadme, 'https://fastapi.tiangolo.com/tutorial/dependencies/', 'FastAPI dependency source anchor is present');
  includes(nextReadme, 'https://nextjs.org/docs/app/api-reference/file-conventions/route', 'Next route source anchor is present');
  includes(langchainReadme, 'https://docs.langchain.com/oss/javascript/langchain/tools', 'LangChain tool source anchor is present');
  includes(fastapiTest, 'test_review_holds_before_export_service', 'FastAPI example carries review regression test');
  includes(fastapiTest, 'test_observe_admit_holds_before_export_service', 'FastAPI example carries observe regression test');
  includes(fastapiTest, 'test_receipt_only_admit_holds_before_export_service', 'FastAPI example carries proof regression test');
  includes(fastapiTest, 'test_narrow_executes_bounded_export', 'FastAPI example carries narrow regression test');
  includes(rootReadme, 'not execution authority', 'Root examples doc holds observe/warn execution');
  includes(rootReadme, 'plain admission receipt', 'Root examples doc distinguishes receipt from execution proof');
  includes(docsFrontDoor, 'examples/customer-middleware/README.md', 'Docs front door links customer middleware examples');
  includes(integrationHub, 'examples/customer-middleware/README.md', 'Integration hub links customer middleware examples');
  includes(recipes, 'examples/customer-middleware/README.md', 'Integration recipes link customer middleware examples');
  assert.equal(
    packageJson.scripts['test:customer-middleware-examples'],
    'tsx tests/customer-middleware-examples.test.ts',
    'Package exposes customer middleware examples test',
  );
  passed += 1;

  for (const doc of [rootReadme, expressReadme, fastapiReadme, nextReadme, langchainReadme]) {
    includes(doc, 'synthetic references', 'Each example doc keeps synthetic-data boundary');
    excludes(doc, /\bsk_(live|test)_[A-Za-z0-9_]+/u, 'Examples do not expose Stripe secret keys');
    excludes(doc, /\bwhsec_[A-Za-z0-9_]+/u, 'Examples do not expose webhook secrets');
    excludes(doc, /0x[a-fA-F0-9]{40}/u, 'Examples do not expose raw wallet addresses');
    excludes(doc, /production-ready/iu, 'Examples avoid production-ready claim wording');
  }
}

await testExpressRefundGate();
await testNextPermissionGate();
await testLangChainWalletGate();
testDocsAndScripts();

console.log(`Customer middleware examples tests: ${passed} passed, 0 failed`);
