# Policy Limit Model

Policy limits are the bounded part of consequence admission inside the AI Action Control Plane.

An admission should not be a broad permission like:

```text
the AI may pay suppliers
```

It should be closer to:

```text
the AI-assisted workflow may dispatch this supplier payment only if amount, recipient, velocity, policy scope, proof, and review threshold all fit the active policy limits
```

The policy limit model gives consequence admission a shared limit vocabulary before domain packs add their own native policy engines.

## Why Limits Are First-Class

Agentic AI risk is not only whether a model can call a tool. The sharper question is what the tool is allowed to change once called.

For Attestor, a limit is evidence-bearing policy material. It can allow, narrow, require review, or block a proposed consequence.

```text
proposed consequence
  -> policy limit set
  -> measured consequence attributes
  -> admit / narrow / review / block
  -> downstream contract and verifier
```

## Limit Kinds

The current shared vocabulary covers:

- `amount`: maximum value for money or value-like consequences
- `velocity`: maximum count over a time window
- `recipient-allowlist`: approved payees, counterparties, accounts, or destinations
- `asset-allowlist`: approved tokens, currencies, instruments, or asset identifiers
- `data-scope`: allowed data domains and optional record cap
- `authority-scope`: allowed role, entitlement, admin, delegation, or approval scope
- `time-window`: not-before and not-after execution bounds
- `risk-class-ceiling`: maximum accepted Attestor risk class
- `human-review-threshold`: value threshold where automatic execution must stop for review
- `custom`: customer-defined policy reference that must be observed explicitly

Each limit has a breach action:

- `narrow`: a safer bounded form may proceed with explicit constraints
- `review`: the consequence must wait for human or external review
- `block`: the consequence is rejected fail-closed

Missing required measurements fail closed as `block`.

## Example: Supplier Payment

A payment policy can say:

```text
amount <= 250 EUR
recipient in supplier_steel_works, supplier_copper_yard
velocity <= 3 payments per 3600 seconds for procurement-agent
human review required at or above 1000 EUR
risk <= R3
```

If the amount is 240 EUR and the recipient is allowlisted, the limit evaluation returns `admit`.

If the amount is 300 EUR and the amount limit has breach action `narrow`, the evaluation returns `narrow` with an explicit constraint:

```text
Maximum amount is 250 EUR.
```

If the recipient is not allowlisted, the evaluation returns `block`.

If the amount is 1000 EUR or more, the evaluation returns `review` even if the recipient is valid.

## Example: Crypto Approval

A programmable-money policy can say:

```text
asset in USDC, ETH
recipient in safe_treasury, custody_main
amount <= 500 USDC
velocity <= 5 approvals per 86400 seconds for agent-wallet-1
human review required at or above 2000 USDC
```

The crypto pack can still add chain-specific simulation, account, nonce, allowance, and adapter checks. The shared limit model keeps the cross-domain question stable: what bounded consequence is this policy willing to admit?

## Example: Data Export

A data export policy can say:

```text
data domains in customer-support, billing-summary
records <= 100
risk <= R2
```

If the measurement does not include data domains or record count, required measurement is missing and the evaluation blocks. The absence of measurement is not treated as permission.

## Relationship To Other Layers

- [Consequence taxonomy](consequence-taxonomy.md) names the consequence domain.
- The policy limit model evaluates whether the proposed consequence fits bounded policy.
- [Downstream enforcement contract](downstream-enforcement-contract.md) checks whether a specific customer enforcement point may act on the admission.
- [Verifier helper](verifier-helper.md) packages that customer-side check into a small adapter API.
- Release-enforcement plane remains the deeper layer for signed release-token and presentation verification.

The limit model does not replace a bank, wallet, custody policy engine, database permission system, or cloud IAM control. It gives Attestor a shared, inspectable limit grammar before those systems receive an allowed consequence.
