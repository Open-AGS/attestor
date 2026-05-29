# Repository Navigator

Use this when the repository feels large and you want the shortest path to the
right place.

This is a map, not a new authority surface. It does not replace the README,
the audit baseline, or the live proof register.

## Pick One Door

Do not read everything.

Pick the first line that matches what you are trying to do. Follow that link,
do the next action there, and come back only if you still need more context.

| If you are thinking... | Go here | Stop when... |
|---|---|---|
| "Show me what this does." | [Try Attestor first](try-attestor-first.md) | the refund demo runs and you can explain why it held or blocked. |
| "Where do I put this in my app?" | [Customer middleware examples](../../examples/customer-middleware/README.md) | you can point to the line before the downstream action executes. |
| "What JSON do I send?" | [Shadow event payload examples](shadow-event-payload-examples.md) | you have copied the closest payload shape for your action class. |
| "Why did it review or block?" | [Reason codes](../05-proof/reason-codes.md) | you understand the reason code and the next safe step. |
| "Is this production-ready?" | [Current repository truth](../../README.md#current-repository-truth) | you can separate repo-side evidence from live proof. |
| "What still needs real deployment evidence?" | [Live proof register](../audit/live-proof-register.md) | you know which proof is live/customer/operator-only. |
| "How is this engine actually built?" | [Internal machine map](../02-architecture/attestor-internal-machine-map.md) | you can name the route, decision plane, package surface, and proof loop. |
| "I need to change code safely." | [Code map](#code-map) | you know the owning directory and the nearest test surface. |
| "I need to reorganize hosted runtime files." | [Service organization plan](../02-architecture/service-organization-plan.md) | you know the slice order, move rules, and no-claims. |
| "I need to split a large file." | [Large file budget](../02-architecture/large-file-budget.md) | you know the 800-line target, 1200-line exception rule, and next split order. |
| "What is the active large-file refactor wave?" | [Final Large File Refactor Plan](../02-architecture/final-large-file-refactor-plan.md) | you know the 16 rounds, targets, exceptions, and no-claims. |
| "Which test proves this?" | [Test system map](../02-architecture/test-system-map.md) | you know the nearest hermetic gate, snapshot/golden gate, or live-proof-only boundary. |

## Start By Intent

| I want to... | Start here | Then go to |
|---|---|---|
| Understand Attestor in one minute | [README](../../README.md) | [Try Attestor first](try-attestor-first.md) |
| Run the refund workflow | [Try Attestor first](try-attestor-first.md) | [Golden Path: Refund](../02-architecture/golden-refund-shadow-pilot.md) |
| Send shadow events | [Shadow event payload examples](shadow-event-payload-examples.md) | [Customer middleware examples](../../examples/customer-middleware/README.md) |
| Wire a customer app | [Customer middleware examples](../../examples/customer-middleware/README.md) | [Customer integration recipes](customer-integration-recipes.md) |
| Make the first hosted API call | [First hosted API call](hosted-first-api-call.md) | [Hosted action authorization API](hosted-action-authorization-api.md) |
| Understand `admit`, `narrow`, `review`, and `block` | [Consequence admission quickstart](consequence-admission-quickstart.md) | [Reason codes](../05-proof/reason-codes.md) |
| Decode Attestor terms | [Glossary](../02-architecture/glossary.md) | [Attestor language contract](../02-architecture/attestor-language-contract.md) |
| Explain a review or block reason | [Reason codes](../05-proof/reason-codes.md) | [Failure modes and controls](../05-proof/failure-modes-and-controls.md) |
| Check what is real today | [Current repository truth](../../README.md#current-repository-truth) | [Current posture baseline](../audit/current-posture-baseline.md) |
| Check what still needs live proof | [Live proof register](../audit/live-proof-register.md) | [Production readiness](../08-deployment/production-readiness.md) |
| Understand the whole machine | [AI Action Control Plane architecture](../02-architecture/ai-action-control-plane-architecture.md) | [Internal machine map](../02-architecture/attestor-internal-machine-map.md) |
| Understand one-engine domain packs | [Domain pack boundary](../02-architecture/domain-pack-boundary.md) | [Finance and crypto first integrations](finance-and-crypto-first-integrations.md) |
| Review audit state | [Audit evidence system](../audit/README.md) | [Finding index](../audit/finding-index.md) |
| Review public package boundaries | [Consequence admission public surface](../02-architecture/consequence-admission-public-surface.md) | [Release layer platform surface](../02-architecture/release-layer-platform-surface.md) |
| Find the right maintainer script | [Scripts inventory](../02-architecture/scripts-inventory.md) | `npm run test:package-script-runner` |
| Find the right test gate | [Test system map](../02-architecture/test-system-map.md) | `npm run test:test-system-map` |
| Plan a hosted runtime refactor | [Service organization plan](../02-architecture/service-organization-plan.md) | `npm run test:service-organization-plan-docs` |
| Reduce oversized files | [Large file budget](../02-architecture/large-file-budget.md) | [Final Large File Refactor Plan](../02-architecture/final-large-file-refactor-plan.md); `npm run test:large-file-budget` |

## Start By Role

| Role | Read first | Why |
|---|---|---|
| First-time evaluator | [README](../../README.md) | Product shape, concrete refund story, current repository truth. |
| Customer engineer | [Customer middleware examples](../../examples/customer-middleware/README.md) | Copy-paste integration shape before any SDK abstraction. |
| API integrator | [First hosted API call](hosted-first-api-call.md) | Tenant key, first request, and decision handling. |
| Reviewer or auditor | [Audit evidence system](../audit/README.md) | Current baseline, finding state, live-proof separation. |
| Maintainer | [Internal machine map](../02-architecture/attestor-internal-machine-map.md) | Where the decision planes, routes, stores, packs, and proof loops live. |
| Product or docs editor | [Attestor language contract](../02-architecture/attestor-language-contract.md) | Public wording, no-claims, and one-engine terminology. |
| Term lookup | [Glossary](../02-architecture/glossary.md) | Short definitions for terms that otherwise sound too similar. |

## Code Map

| Area | What lives there | Use it when |
|---|---|---|
| `src/consequence-admission/` | Shared admission contracts, decisions, guards, shadow, Policy Foundry, domain projections. | You are changing `admit` / `narrow` / `review` / `block` behavior or proof-shaped admission output. |
| `src/service/` | Hosted runtime and cross-cutting service support. Root files are for shared runtime concerns only. | You are changing deployment-facing runtime behavior that spans more than one service family. |
| `src/service/` reorg plan | [Service organization plan](../02-architecture/service-organization-plan.md) | You are planning to move hosted runtime files without changing behavior, or a service map drift-lock test failed. |
| `src/service/account/` | Hosted account stores, sessions, MFA, SSO, passkeys, password policy, auth-abuse guard, and account route support. | You are changing hosted account, login, signup, SSO, MFA, passkey, or account-user behavior. |
| `src/service/api-types/` | Service API request, response, context, and route constant type families. | You are changing hosted API contract shapes while keeping `src/service/api-types.ts` as the compatibility barrel. |
| `src/service/billing/` | Billing entitlements, event ledger, export/reconciliation, billing feature service, and Stripe support under `billing/stripe/`. | You are changing hosted billing, Stripe webhook support, commercial config, or usage exports. |
| `src/service/async/` | Async pipeline, worker, tenant execution, weighted dispatch, dead-letter handling, and email delivery events. | You are changing queued execution, worker recovery, replay/idempotency support, or async email delivery. |
| `src/service/pipeline/` | Pipeline idempotency store and pipeline route support. | You are changing pipeline run idempotency, replay, or route support helpers. |
| `src/service/release/` | Release authority stores, decision log, evidence pack, reviewer queue, degraded-mode grant store, review site, and token introspection. | You are changing hosted release authority, review queue, token/evidence storage, or release route support. |
| `src/service/hosted/` | Hosted product-flow contracts, generic admission proof bridges, LLM/tool boundary, runtime health, observability/privacy, release provenance, and hosted abuse/reconciliation guards. | You are changing hosted product assurance or hosted admission proof plumbing. |
| `src/service/policy-foundry/` | Policy Foundry billing entitlement enforcement, hosted UI flow, and hosted wizard state. | You are changing hosted Policy Foundry onboarding or UI state. |
| `src/service/shadow/` | Shadow persistence store. | You are changing shadow event persistence or shadow route backing storage. |
| `src/service/http/routes/` | Hono route handlers. | You need request/response behavior for `/api/v1/*`. |
| `src/service/bootstrap/` | Runtime assembly and dependency wiring. | You need to see how routes and stores are composed. |
| `src/service/application/` | Route-facing application services and use-case ports. | You are changing route orchestration without changing the lower-level stores directly. |
| `src/release-kernel/` | Release decisions, evidence packs, tokens, canonicalization, reviewer queue primitives. | You are changing release authority or proof material before enforcement. |
| `src/release-policy-control-plane/` | Policy bundles, activation, simulation, publication, and lifecycle controls. | You are changing policy lifecycle or activation semantics. |
| `src/release-enforcement-plane/` | Customer PEP / verifier / middleware primitives. | You are changing downstream enforcement presentation or verification. |
| `src/crypto-authorization-core/` | Crypto authorization primitives and adapter risk checks. | You are changing programmable-money authorization logic. |
| `src/crypto-execution-admission/` | Crypto execution plan admission handoff. | You are changing package-boundary crypto execution planning. |
| `src/signing/` | Ed25519, PKI, canonicalization, keyless signer, certificates. | You are changing proof signing or verification primitives. |
| `src/financial/` | Finance proof wedge, pipeline, fixtures, and operator CLI. | You are changing the financial proof path or local operator demos. |
| `src/financial/cli/` | Financial CLI command families behind the small `src/financial/cli.ts` entrypoint. | You are changing one CLI command without widening the operator entrypoint. |
| `examples/customer-middleware/` | Express, FastAPI, Next.js, and LangChain integration examples. | You want to see where a customer would insert Attestor. |
| `docs/audit/` | Current posture, finding state, control map, and live proof register. | You need to know whether a claim is repo-proven, live-proof-only, or not proven. |
| `docs/research/` | Source-backed research notes and provenance ledger. | You need the external source trail behind a design direction. |
| `scripts/` | Local, CI, probe, render, demo, rehearsal, validation, and operator helper scripts. | You need to run or change a package script without breaking PR or CI gates. |
| `tests/` | Regression, contract, docs, route, package-surface, and proof discipline tests. | You need to lock behavior or prove a public claim did not drift. |
| `tests/README.md` | Short test navigator for the current repo-side gate families. | You need to route a change to the nearest test without reading every script. |

## Package Surface Map

| Public import path | Purpose | Boundary doc |
|---|---|---|
| `attestor` | Main consequence admission package surface. | [Consequence admission public surface](../02-architecture/consequence-admission-public-surface.md) |
| `attestor/consequence-admission` | Compatibility package subpath for the same shared admission surface. | [Consequence admission public surface](../02-architecture/consequence-admission-public-surface.md) |
| `attestor/release-layer` | Release-layer contracts over release-kernel primitives. | [Release layer platform surface](../02-architecture/release-layer-platform-surface.md) |
| `attestor/release-layer/finance` | Finance release wedge helpers. | [Finance and crypto first integrations](finance-and-crypto-first-integrations.md) |
| `attestor/release-policy-control-plane` | Policy lifecycle package boundary. | [Release policy control plane platform surface](../02-architecture/release-policy-control-plane-platform-surface.md) |
| `attestor/release-enforcement-plane` | Customer PEP and verifier primitives. | [Release enforcement plane platform surface](../02-architecture/release-enforcement-plane-platform-surface.md) |
| `attestor/crypto-authorization-core` | Crypto authorization core package boundary. | [Crypto authorization core platform surface](../02-architecture/crypto-authorization-core-platform-surface.md) |
| `attestor/crypto-execution-admission` | Crypto execution admission planner boundary. | [Crypto execution admission platform surface](../02-architecture/crypto-execution-admission-platform-surface.md) |
| `attestor/crypto-intelligence` | Crypto posture and dashboard summary helpers. | [Crypto intelligence platform surface](../02-architecture/crypto-intelligence-platform-surface.md) |

## If You Are Lost

1. Want to see value fast? Run [Try Attestor first](try-attestor-first.md).
2. Want to wire something? Open [Customer middleware examples](../../examples/customer-middleware/README.md).
3. Want to explain a decision? Open [Reason codes](../05-proof/reason-codes.md).
4. Want to verify a claim? Open [Audit evidence system](../audit/README.md).
5. Want to change internals? Open [Internal machine map](../02-architecture/attestor-internal-machine-map.md).

Keep the distinction clean:

```text
repo-side evidence is not live production proof
package boundary is not hosted enforcement
admission decision is not downstream execution
customer PEP / gate is where non-bypassability must be proven
```
