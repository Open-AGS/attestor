# Third-Party Provider Inventory And Risk Boundary

Status: provider inventory for security and compliance review.

This document records the third-party surfaces visible in the repository. It is
not vendor due diligence, not a DPA, and not a representation that a customer has
approved these providers.

## Provider Classes

| Provider class | Current repository use | Boundary |
|---|---|---|
| LLM provider | `src/api/openai.ts` uses OpenAI for optional analysis paths; `src/api/llm-provider-registry.ts` records OpenAI, Anthropic, Vertex AI, and Azure OpenAI provider boundaries. | OpenAI is the only wired provider; customer must approve data-use, region, retention, model policy, timeout, budget, and live smoke proof before hosted use. OpenAI wrapper calls set `store: false`, enforce timeout/output-token budgets, and still do not prove production readiness. |
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

The repository contains an OpenAI wrapper, but Attestor should not claim
multi-provider LLM resilience until provider clients, failover,
provider-parity rate-limit handling, and live smoke proof are wired and verified.
The repository now contains a provider registry contract, but OpenAI remains
the only wired provider. Anthropic, Vertex AI, and Azure OpenAI are planned
provider surfaces, not active runtime dependencies. The OpenAI wrapper has a
bounded runtime policy envelope; that is narrower than a production multi-provider
resilience claim.
