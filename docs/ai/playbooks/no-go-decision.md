# No-Go Decision Playbook

Use this playbook when evidence is incomplete or a change would weaken Attestor's trust boundary.

No-go is not failure. It is a controlled refusal to create an unsupported claim or unsafe consequence.

## No-Go Conditions

Use no-go when:

- required repository evidence is missing
- the proposed change weakens fail-closed behavior
- tenant, account, customer, payment, wallet, provider, or secret data could leak
- live/ops readiness is claimed without a working target and probe evidence
- production readiness is claimed from secretless local checks only
- deterministic controls would be replaced by model judgment
- the smallest safe fix is not known
- required permissions, secrets, infrastructure, or operator actions are unavailable

## Required Output

```text
Decision: no-go
Protected principle:
What is proven:
What is not proven:
Blocking evidence:
Risk if we proceed:
Smallest next step:
What would make this go:
```

## Language Rule

Say `not proven` when evidence is missing.

Say `blocked` when an external dependency or operator action is required.

Say `unsafe to claim` when a public or technical claim would exceed the evidence.

Do not say `ready`, `secure`, `compliant`, `audited`, or `production-ready` unless the repository and runtime evidence proves that exact claim.
