# Golden Path: Programmable Money

Status: complete. P01-P04 are repository-side only. This is
not a wallet, custody platform, signer, bundler, broadcaster, x402 facilitator,
Safe guard deployment, intent solver, customer PEP proof, chain settlement
proof, production readiness, or enterprise readiness.

## Decision

Programmable Money is the next pack after Operational Execution. It keeps the
same Attestor consequence grammar, but moves the example into wallet calls,
Safe transactions, account-abstraction flows, custody callbacks, HTTP-native
agent payments, and intent settlement:

```text
AI-prepared programmable-money intent
  -> synthetic canonical shadow events
  -> digest-only wallet, policy, adapter, approval, replay, simulation, and receipt refs
  -> admit / narrow / review / block shadow decisions
  -> review-only Policy Foundry projection
  -> R02-R07 shadow runtime smoke chain
  -> shadow-pilot readiness probe
  -> local demo output and reviewer sandbox
```

Non-split boundary:

```text
Not a wallet.
Not a custodian.
Not a signer.
Not a bundler.
Not a broadcaster.
Not an x402 facilitator.
Not a Safe guard deployment.
Not an intent solver.
Not a new Attestor mode.
```

The programmable-money domain supplies the example surface; it does not get
independent authority. Every scenario remains shadow-only and review material
until a later customer-controlled PEP/gate consumes an Attestor decision.

## Repository Evidence

| Area | Evidence | State |
|---|---|---|
| Programmable Money taxonomy | `README.md` lists Programmable Money as wallet calls, Safe transactions, account-abstraction flows, custody callbacks, payment middleware, and intent settlement, and says the pack list is taxonomy, not an equal-maturity claim. | repo-proven |
| Canonical consequence class | `src/consequence-admission/canonical-shadow-event-schema.ts` includes `programmable-money` as a canonical shadow-event consequence class. | repo-proven |
| Crypto authorization core | `src/crypto-authorization-core/**` defines adapter-neutral consequence kinds, account kinds, policy dimensions, risk mapping, replay/freshness, release/policy/enforcement binding, Safe, ERC-4337, EIP-7702, x402, custody, and intent-settlement adapters. | repo-proven |
| Crypto execution admission | `src/crypto-execution-admission/**` turns crypto authorization simulations into execution-admission plans and adapter handoff contracts without becoming a wallet, custody platform, bundler, facilitator, or solver. | repo-proven |
| P01 fixture contract | `src/consequence-admission/golden-programmable-money-shadow-fixtures.ts` emits eight synthetic digest-only canonical shadow events for programmable-money scenarios. | repo-proven |
| P01 tests | `tests/golden-programmable-money-shadow-fixtures.test.ts` locks the suite shape, digest-only canonical events, scenario semantics, no-wallet/no-signing/no-broadcast flags, no raw wallet material, no raw transaction payload, docs, ledger, and package script alignment. | repo-proven |
| P02 projection contract | `src/consequence-admission/golden-programmable-money-policy-foundry-projection.ts` projects the P01 fixtures into a review-only Policy Foundry candidate, named gaps, decision counts, gap counts, and Policy Twin summary. | repo-proven |
| P02 tests | `tests/golden-programmable-money-policy-foundry-projection.test.ts` locks the review-only candidate, named gap kinds, decision counts, gap counts, no-enforcement flags, no raw wallet material, no raw transaction payload, docs, ledger, README, and package script alignment. | repo-proven |
| P03 runtime smoke | `src/consequence-admission/golden-programmable-money-runtime-smoke.ts` runs every P01 fixture through the existing R02-R07 shadow runtime smoke chain and binds envelope, assurance-packet, assurance-case, and lineage digests without wallet, signing, broadcast, custody, bundler, facilitator, solver, provider, audit-write, policy-activation, learning, or training side effects. | repo-proven |
| P03 readiness probe | `src/consequence-admission/golden-programmable-money-pilot-readiness-probe.ts` wraps the runtime smoke in a digest-bound pilot readiness packet and emits only `ready-for-shadow-pilot` or `not-ready`; `ready-for-scoped-pilot` is deliberately excluded. | repo-proven |
| P03 tests | `tests/golden-programmable-money-runtime-smoke.test.ts` and `tests/golden-programmable-money-pilot-readiness-probe.test.ts` lock deterministic replay, side-effect bans, no raw wallet/customer material, docs, ledger, package script, and fail-closed tamper behavior. | repo-proven |
| P04 demo CLI | `src/consequence-admission/golden-programmable-money-demo.ts` and `scripts/demo-golden-programmable-money.ts` compose P01-P03 evidence into Markdown-first local demo output and JSON as secondary machine output. | repo-proven once merged |
| P04 reviewer sandbox | `src/consequence-admission/golden-programmable-money-reviewer-sandbox.ts` and `fixtures/golden-programmable-money-reviewer-sandbox.example.json` accept strict JSON allowlisted reviewer input, reject raw-like unknown fields, constrain scenario paths to `fixtures/`, and run accepted programmable-money facts through the shadow-only runtime smoke chain. | repo-proven once merged |
| P04 tests | `tests/golden-programmable-money-demo.test.ts` and `tests/golden-programmable-money-reviewer-sandbox.test.ts` lock demo output, JSON output, strict input handling, scenario path boundaries, no-wallet/no-signing/no-broadcast flags, docs, ledger, README, and package script alignment. | repo-proven once merged |

## Research Anchors

EIP-712 anchors typed structured-data domain separation. ERC-4337 anchors the
UserOperation / EntryPoint / bundler execution surface. Safe guards anchor the
smart-account pre/post execution hook boundary. x402 anchors HTTP-native
payment challenge, payment signature, facilitator verification/settlement, and
payment response framing. Fireblocks API co-signers anchor custody callback
decision boundaries. ERC-7683 anchors intent-based settlement route evidence.

These are engineering anchors only. They do not prove live wallet, Safe,
custody, x402, bundler, chain, solver, customer PEP, or production readiness.

- [EIP-712](https://eips.ethereum.org/EIPS/eip-712)
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)
- [Safe smart account guards](https://docs.safe.global/advanced/smart-account-guards)
- [x402 specification](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md)
- [Fireblocks API co-signer architecture](https://developers.fireblocks.com/docs/cosigner-architecture-overview)
- [ERC-7683](https://eips.ethereum.org/EIPS/eip-7683)

## P-Series Tracker

Progress after P04 lands: 4/4 complete. 0 steps remain.

| Step | Status | Slice | Evidence target |
|---|---|---|---|
| P01 | complete | Programmable Money shadow fixture contract | Synthetic digest-only canonical shadow events for Safe transfer, unlimited approval, ERC-4337 paymaster evidence, EIP-7702 stale delegation, x402 settlement proof, custody quorum, intent-solver route, and wallet-memo prompt-injection scenarios. |
| P02 | complete | Policy Foundry programmable-money projection | Review-only candidate, named gaps, decision counts, and Policy Twin summary over P01 fixtures. |
| P03 | complete | Runtime smoke and pilot readiness | Run the existing R02-R07 shadow runtime smoke chain over P01/P02 material and emit only `ready-for-shadow-pilot` or `not-ready`. |
| P04 | complete once merged | Demo CLI and reviewer sandbox | Markdown-first local demo plus strict local JSON reviewer input, with no wallet call, signing, broadcast, custody callback, facilitator call, bundler call, or solver call. |

## P01 Scenario Contract

P01 covers eight fixture-only cases:

```text
safe-transfer-allowlisted-recipient
unlimited-approval-review
erc4337-user-operation-paymaster-missing
delegated-eoa-stale-authorization
x402-agent-payment-settlement-missing
custody-withdrawal-quorum-pending
intent-solver-deadline-slippage-review
prompt-injection-in-wallet-memo
```

Every fixture records:

```text
tenantRefDigest
actorRefDigest
targetAccountRefDigest
adapter kind
consequence kind
account kind
asset kind
chain namespace
value risk
counterparty posture
approval posture
policy scope status
replay freshness
adapter preflight status
settlement / receipt status
instruction-like evidence posture
evidence refs
approval refs
simulation refs
receipt refs
policy refs
replay / idempotency / trace refs
```

Every fixture forbids:

```text
wallet calls
signing
broadcasting
custody callbacks
bundler calls
facilitator calls
solver calls
raw transaction payloads
raw wallet material
raw customer identifiers
target-system calls
auto enforcement
production readiness claims
```

P01 intentionally stops at structured shadow evidence. It gives reviewers a
concrete way to inspect how Attestor treats programmable-money intent before a
downstream wallet, Safe, custody engine, x402 server, bundler, or solver is
allowed to act.

## P02 Policy Foundry Projection

P02 consumes the P01 fixtures and emits a review-only candidate for `programmable_money.transaction_intent`.
It records decision counts, named gaps, backtest material, and a Policy Twin
summary while keeping `autoEnforce=false`, `activatesEnforcement=false`, and
`productionReady=false`.

The named gap set covers allowance, paymaster, stale delegation, x402 settlement, custody quorum, intent-route, and wallet-memo gaps:

```text
allowance-scope-overbroad
account-abstraction-preflight-missing
delegated-eoa-authority-stale
x402-settlement-proof-missing
custody-quorum-pending
intent-route-slippage-review
wallet-memo-instruction-review
```

The projection is reviewer material. It can recommend review mode and name
missing controls; it cannot sign, broadcast, settle, call adapters, grant
authority, reduce review requirements, or activate enforcement.

## P03 Runtime Smoke And Readiness

P03 takes the P01 fixture suite and P02 review-only projection through the
existing R02-R07 shadow runtime smoke chain. For each programmable-money
scenario, it binds the fixture digest, source event digest, runtime smoke
digest, envelope digest, assurance packet digest, final assurance-case digest,
and final lineage-graph digest.

The smoke contract is intentionally side-effect free:

```text
shadow-only
fixture-only
deterministic replay
no target-system call
no wallet call, no signing, no broadcast, no custody callback
no bundler call, no facilitator call, no solver call
no provider call, no audit write
no external event bus, trace export, or lineage export
no policy activation, learning activation, or training activation
cannot grant authority
cannot admit
cannot activate enforcement
not production-ready
```

The pilot readiness probe then wraps that smoke output in a digest-bound
readiness packet. The only allowed verdicts are:

```text
ready-for-shadow-pilot
not-ready
```

`ready-for-scoped-pilot` is deliberately excluded. A shadow-pilot verdict means
only that the local synthetic fixture path is ready to be reviewed as shadow
evidence. It does not mean any wallet, Safe, custody engine, x402 facilitator,
bundler, solver, target system, customer PEP, chain, or payment rail can act.

## P04 Demo CLI And Reviewer Sandbox

P04 makes the Programmable Money path reviewer-runnable:

```bash
npm run demo:golden-programmable-money
npm run demo:golden-programmable-money -- --json
npm run demo:golden-programmable-money -- --scenario fixtures/golden-programmable-money-reviewer-sandbox.example.json
```

The default CLI output is Markdown-first local demo material for screenshots,
reviews, and walkthroughs. JSON as secondary machine output is available with
`--json`; it is not the primary reviewer experience.

The reviewer sandbox accepts one strict JSON allowlist only:

```text
version
actionSurface
adapterKind
consequenceKind
accountKind
assetKind
chainNamespace
valueRisk
counterpartyPosture
approvalPosture
policyScopeStatus
replayFreshness
adapterPreflightStatus
settlementOrReceiptStatus
instructionLikeEvidence
externalSideEffect
duplicateIntentAttempt
```

Unknown raw-like fields are rejected before the engine runs. Scenario files are
bounded to `fixtures/` by default. Accepted inputs are converted into a
digest-only canonical shadow event, replayed through the same shadow runtime
fixture smoke chain, and returned as review material with issue codes, gate
order, decision summary, digests, and explicit no-claims.

P04 keeps the research anchors visible in the local contract: EIP-712 typed
data domain separation, ERC-4337 UserOperation / EntryPoint / bundler boundary,
Safe pre/post guard hooks, x402 verify/settle response boundary, Fireblocks
co-signer callback approval boundary, and ERC-7683 intent-order resolution.
These anchors shape the reviewer sandbox; they do not prove a live wallet,
Safe, custody, x402, bundler, solver, chain, or customer PEP deployment.

## P01 No-Claims

P01 does not:

- sign or verify a live user transaction;
- submit a Safe transaction;
- submit an ERC-4337 UserOperation;
- call a wallet RPC;
- call a custody provider or co-signer;
- call an x402 facilitator;
- open, fill, submit, or settle an intent route;
- prove chain settlement or payment finality;
- prove customer PEP no-bypass;
- prove production or enterprise readiness.

P02 adds no live authority. It does not:

- activate the Policy Foundry candidate;
- convert review-only output into enforcement;
- call a wallet, Safe, bundler, custody co-signer, x402 facilitator, or solver;
- prove chain settlement or payment finality;
- reduce review, authority, evidence, replay, or customer PEP requirements.

P03 adds no live authority. It does not:

- call a wallet, Safe, bundler, custody co-signer, x402 facilitator, or solver;
- sign, broadcast, submit, settle, or verify a live programmable-money action;
- write audit logs or emit external traces/events/lineage artifacts;
- activate policy, learning, training, enforcement, or auto-enforcement;
- grant authority or admit a real action;
- prove live replay/idempotency store behavior;
- prove customer PEP no-bypass;
- prove production or enterprise readiness.

P04 adds no live authority. It does not:

- call a wallet, Safe, bundler, custody co-signer, x402 facilitator, or solver;
- sign, broadcast, submit, settle, or verify a live programmable-money action;
- accept raw transaction payloads, raw wallet material, or raw customer identifiers;
- write audit logs or emit external traces/events/lineage artifacts;
- activate policy, learning, training, enforcement, or auto-enforcement;
- grant authority or admit a real action;
- prove live replay/idempotency store behavior;
- prove customer PEP no-bypass;
- prove chain settlement, payment finality, production readiness, or enterprise readiness.
