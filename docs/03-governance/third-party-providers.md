# Third-Party Provider Inventory And Risk Boundary

Status: provider inventory for security and compliance review.

This document records the third-party surfaces visible in the repository. It is
not vendor due diligence, not a DPA, and not a representation that a customer has
approved these providers.

## Provider Classes

| Provider class | Current repository use | Boundary |
|---|---|---|
| LLM provider | `src/api/openai.ts` and `src/api/anthropic.ts` provide optional live-model wrapper paths; `src/api/llm-provider-registry.ts` records OpenAI, Anthropic, Vertex AI, and Azure OpenAI provider boundaries. | OpenAI and Anthropic are wired repository-side wrappers; customer must approve data-use, region, retention, model policy, timeout, budget, and live smoke proof before hosted use. OpenAI wrapper calls set `store: false`; Anthropic wrapper keeps request/response bodies caller-local. Both enforce timeout/output-token budgets and require fresh reasoning smoke-proof env evidence in production-like runtimes. This still does not prove live failover or production readiness. |
| Payments | Stripe billing and webhook surfaces. | Stripe live mode requires separate go-live verification, webhook secret, portal/product setup, and smoke tests. |
| Database | PostgreSQL for shared authority/control-plane paths. | Customer/operator owns managed database, backups, access, encryption, and region. |
| Queue/cache | Redis/BullMQ for async and shared runtime paths. | Customer/operator owns Redis durability, auth, failover, and monitoring. |
| Email delivery | Mailgun/SendGrid webhook handlers and email delivery event store. | Customer/operator owns provider credentials, sender domains, and webhook secrets. |
| Identity | SAML/OIDC/passkey/MFA hooks. | Customer/operator owns IdP configuration, user lifecycle, and access reviews. |
| NPM packages | Package-lock, supply-chain baseline, package-surface probes. | Repository checks do not certify upstream package behavior. |
| Crypto/domain risk sources | Customer-owned or third-party evidence can enter as digest-bound risk input. | Attestor is not a sanctions, fraud, market-data, oracle, custody, or screening provider. |

## Required Provider Evidence Before Production Claims

- provider owner and approval date
- data categories sent to the provider
- region and residency posture
- retention and deletion posture
- credential storage path
- webhook/signature validation evidence when applicable
- fallback or degradation behavior
- incident contact and escalation path

## LLM Provider Boundary

The repository contains OpenAI and Anthropic wrappers, but Attestor should not
claim live multi-provider LLM resilience until failover execution, customer
provider approvals, provider-parity runtime evidence, and per-provider live
smoke proofs are wired and verified for the selected deployment.
The repository now contains a provider registry contract with OpenAI and
Anthropic wired. Vertex AI and Azure OpenAI are planned provider surfaces, not
active runtime dependencies. The OpenAI and Anthropic wrappers have bounded
runtime policy envelopes plus opt-in reasoning live smoke probes; that is
narrower than a production multi-provider resilience claim.
The registry also rejects a generic second provider as failover evidence unless
that provider is wired for the same purpose, model mapping, route capabilities,
structured-output requirement when applicable, and provider rate-limit signals.
