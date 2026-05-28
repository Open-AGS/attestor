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
| `src/service/` | Hosted runtime, route support, stores, account/billing/webhook/runtime services. | You are changing an HTTP route, hosted account flow, billing, webhook, persistence, or deployment-facing runtime behavior. |
| `src/service/http/routes/` | Hono route handlers. | You need request/response behavior for `/api/v1/*`. |
| `src/service/bootstrap/` | Runtime assembly and dependency wiring. | You need to see how routes and stores are composed. |
| `src/release-kernel/` | Release decisions, evidence packs, tokens, canonicalization, reviewer queue primitives. | You are changing release authority or proof material before enforcement. |
| `src/release-policy-control-plane/` | Policy bundles, activation, simulation, publication, and lifecycle controls. | You are changing policy lifecycle or activation semantics. |
| `src/release-enforcement-plane/` | Customer PEP / verifier / middleware primitives. | You are changing downstream enforcement presentation or verification. |
| `src/crypto-authorization-core/` | Crypto authorization primitives and adapter risk checks. | You are changing programmable-money authorization logic. |
| `src/crypto-execution-admission/` | Crypto execution plan admission handoff. | You are changing package-boundary crypto execution planning. |
| `src/signing/` | Ed25519, PKI, canonicalization, keyless signer, certificates. | You are changing proof signing or verification primitives. |
| `examples/customer-middleware/` | Express, FastAPI, Next.js, and LangChain integration examples. | You want to see where a customer would insert Attestor. |
| `docs/audit/` | Current posture, finding state, control map, and live proof register. | You need to know whether a claim is repo-proven, live-proof-only, or not proven. |
| `docs/research/` | Source-backed research notes and provenance ledger. | You need the external source trail behind a design direction. |
| `tests/` | Regression, contract, docs, route, package-surface, and proof discipline tests. | You need to lock behavior or prove a public claim did not drift. |

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
