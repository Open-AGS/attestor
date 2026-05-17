# General Crypto Transaction Gate

Status: repository-side Step 24 contract for the unified Shadow-to-Policy
plan. This is not a wallet, custodian, exchange, chain analytics provider,
transaction submission service, live customer deployment, or production
readiness evidence.

## Decision

The general crypto transaction gate sits after the
[Enterprise integration recipes](enterprise-integration-recipes.md) and before
customer-owned crypto execution:

```text
agent or workflow proposes crypto consequence
  -> target wrapper emits digest-only action material
  -> general crypto transaction gate
  -> crypto execution admission plan
  -> customer-owned wallet / Safe / bundler / payment / custody / solver edge
  -> downstream receipt digest
```

Crypto remains one adapter family inside the same Attestor engine. Treasury is
only a high-value subset. The gate also covers ordinary programmable-money
risks: transfer, approval, permit, swap, bridge, Safe transaction proposal,
UserOperation, session-key grant, delegated EOA authorization, and x402
payment.

## Runtime Contract

The machine-readable contract lives in
`src/consequence-admission/general-crypto-transaction-gate.ts`.

Version:

```text
attestor.general-crypto-transaction-gate.v1
```

The gate accepts only digest-safe material:

```text
tenantRefDigest
actorRefDigest
walletAccountRefDigest
actionRequestDigest
policyCandidateDigest
approvalRefDigest
executionPlanDigest
simulationDigest
assetRefDigest
targetContractRefDigest
counterpartyRefDigest
amountRefDigest
callDataDigest
typedDataDigest
routeRefDigest
chainId
action
status fields
```

The gate returns:

```text
decision = admit | review | block
allowed
failClosed
customerGateAction = proceed | hold
checks
reasonCodes
requiredEvidence
nextActions
standards
digest
```

Every result carries the same non-claim flags:

```text
approvalRequired = true
autoEnforce = false
signsTransaction = false
broadcastsTransaction = false
custodyWallet = false
chainAnalyticsProvider = false
rawPayloadStored = false
productionReady = false
```

## Covered Actions

| Action | Main evidence | Default risk | Block examples |
|---|---|---:|---|
| `native.transfer` | asset, counterparty, amount, chain policy, simulation | R2 | wrong-chain, failed simulation |
| `erc20.transfer` | token contract, asset, counterparty, amount, simulation | R2 | wrong-chain, failed simulation |
| `erc20.approve` | token contract, spender, bounded allowance, simulation | R3 | unlimited approval, unknown spender |
| `permit.sign` | EIP-712 typed-data digest, EIP-2612 domain, spender, amount | R3 | permit-domain-mismatch, unknown spender |
| `swap.execute` | route, slippage/destination risk, simulation | R3 | failed simulation |
| `bridge.transfer` | route, destination risk, amount, simulation | R4 | wrong-chain, failed simulation |
| `safe.tx.propose` | Safe transaction hash, quorum or guard evidence, call digest | R3 | missing Safe transaction hash |
| `userop.submit` | EntryPoint, UserOperation hash, simulateValidation evidence | R3 | validation-failed |
| `session_key.grant` | bounded permission scope, counterparty, typed-data digest | R4 | session-key-overbroad |
| `delegation.authorize` | bounded delegation scope, counterparty, typed-data digest | R4 | delegation-overbroad |
| `x402.pay` | challenge, facilitator verify result, facilitator settle result | R2 | verify-failed, settle-failed |

## Decision Rules

The gate is intentionally conservative:

```text
any failed check  -> block
any review check  -> review
all pass          -> admit
```

Examples:

```text
wrong-chain                      -> block
unlimited approval               -> block
spender-denied                   -> block
spender-unknown                  -> block
permit-domain-mismatch           -> block
validation-failed                -> block
session-key-overbroad            -> block
delegation-overbroad             -> block
missing approval ref             -> review
missing execution plan           -> review
missing simulation               -> review
destination-risk-unknown         -> review
quorum-missing                   -> review
settle-missing                   -> review
```

The gate does not infer a trusted spender, permit domain, route, quorum,
EntryPoint, UserOperation hash, session scope, delegation scope, or x402
settlement from model text. Those states must arrive as structured evidence
from a customer-owned integration or a repository-side test fixture.

## Primary Research Anchors

Reviewed on 2026-05-17:

- [ERC-20 / EIP-20](https://eips.ethereum.org/EIPS/eip-20) anchors token
  `transfer`, `approve`, and allowance semantics.
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) anchors typed structured
  data signing and domain separation for signing requests.
- [EIP-2612](https://eips.ethereum.org/EIPS/eip-2612) anchors ERC-20 `permit`
  authorization through owner, spender, value, nonce, deadline, and domain
  binding.
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) anchors
  UserOperation-based account abstraction and EntryPoint validation flow.
- [ERC-7562](https://eips.ethereum.org/EIPS/eip-7562) anchors validation and
  reputation constraints for account-abstraction operations.
- [EIP-5792](https://eips.ethereum.org/EIPS/eip-5792) anchors wallet call
  batching surfaces that can carry transaction execution requests.
- [ERC-7715](https://eips.ethereum.org/EIPS/eip-7715) anchors wallet
  permission request shape for session-style authority grants.
- [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) anchors EOA delegated
  execution authorization as a separate high-risk authority surface.
- [ERC-7683](https://eips.ethereum.org/EIPS/eip-7683) anchors cross-chain
  intent/order shape relevant to bridge and solver-style execution.
- [Safe Transaction Service API](https://docs.safe.global/core-api/api-safe-transaction-service)
  and [Safe Smart Account Guards](https://docs.safe.global/advanced/smart-account-guards)
  anchor Safe transaction hash and guard/quorum evidence.
- [OpenZeppelin Defender transaction proposals](https://docs.openzeppelin.com/defender/module/transaction-proposals)
  anchors reviewable transaction proposal workflows.
- [x402 docs](https://docs.x402.org/) and
  [Coinbase CDP x402 docs](https://docs.cdp.coinbase.com/x402/welcome)
  anchor HTTP-native payment challenge, verify, and settle evidence.
- [Coinbase CDP Policy Engine](https://docs.cdp.coinbase.com/wallets/security-and-policies/policy-engine/overview),
  [Fireblocks Transaction Authorization Policy](https://developers.fireblocks.com/docs/set-transaction-authorization-policy),
  and [BitGo policies](https://developers.bitgo.com/guides/policies/overview)
  anchor external custody/wallet policy surfaces that Attestor can gate before
  customer-owned execution.

These sources are engineering anchors only. They do not certify Attestor,
prove wallet or custody integration, prove x402 facilitator integration, prove
chain analytics coverage, prove customer deployment, or prove production
readiness.

## Non-Claims

This gate does not claim:

- wallet implementation
- custody implementation
- exchange implementation
- transaction submission
- key custody or signing authority
- chain analytics classification
- bridge, solver, bundler, facilitator, or relayer operation
- Safe app deployment
- x402 facilitator deployment
- customer deployment
- non-bypassable enforcement
- downstream receipt correctness
- compliance certification
- production readiness
- automatic policy activation
- live customer pilot execution

It proves a repository-side, digest-only gate contract for general crypto
consequences inside the same Shadow-to-Policy engine. The domain recipe pack is
now recorded separately; the remaining master-plan step is the pilot readiness
packet.
