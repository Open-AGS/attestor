# Golden Path: Programmable Money

Status: P01 complete once merged. P01 is repository-side only. This is not a
wallet, custody platform, signer, bundler, broadcaster, x402 facilitator, Safe
guard deployment, intent solver, customer PEP proof, chain settlement proof,
production readiness, or enterprise readiness.

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
  -> later Policy Foundry projection, runtime smoke, reviewer sandbox, and demo output
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
| P01 fixture contract | `src/consequence-admission/golden-programmable-money-shadow-fixtures.ts` emits eight synthetic digest-only canonical shadow events for programmable-money scenarios. | repo-proven once merged |
| P01 tests | `tests/golden-programmable-money-shadow-fixtures.test.ts` locks the suite shape, digest-only canonical events, scenario semantics, no-wallet/no-signing/no-broadcast flags, no raw wallet material, no raw transaction payload, docs, ledger, and package script alignment. | repo-proven once merged |

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

Progress after P01 lands: 1/4 complete. 3 steps remain.

| Step | Status | Slice | Evidence target |
|---|---|---|---|
| P01 | complete once merged | Programmable Money shadow fixture contract | Synthetic digest-only canonical shadow events for Safe transfer, unlimited approval, ERC-4337 paymaster evidence, EIP-7702 stale delegation, x402 settlement proof, custody quorum, intent-solver route, and wallet-memo prompt-injection scenarios. |
| P02 | planned | Policy Foundry programmable-money projection | Review-only candidate, named gaps, decision counts, and Policy Twin summary over P01 fixtures. |
| P03 | planned | Runtime smoke and pilot readiness | Run the existing shadow runtime chain over P01/P02 material and emit only `ready-for-shadow-pilot` or `not-ready`. |
| P04 | planned | Demo CLI and reviewer sandbox | Markdown-first local demo plus strict local JSON reviewer input, with no wallet call, signing, broadcast, custody callback, facilitator call, bundler call, or solver call. |

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
