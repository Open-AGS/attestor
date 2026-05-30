# Repository Map

Use this when you are ready to change code and need the owning directory,
nearest test surface, or public package boundary.

This is a map, not an authority surface. It does not prove production
readiness, hosted enforcement, or live customer non-bypassability.

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

Keep this split:

```text
code map = where to change code
package map = what import path means
audit baseline = what is proven
live proof register = what still needs deployment evidence
```
