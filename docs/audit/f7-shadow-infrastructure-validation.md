# F7 Shadow Infrastructure Red-Team Validation

Status: validation slice for the project-owner supplied F7 report.

Baseline: `origin/master` at `b3eb1e5ed6d860d6c357e3c16f067e1d9f3e3fe5`.

This document validates the F7 shadow-infrastructure report against the current
repository state before implementation work continues. It is not a certification,
not live production evidence, and not a claim that shadow-to-enforce promotion is
ready for high-impact production use.

## Scope

F7 covers the shadow-mode path from recorded admission observations through
simulation, policy promotion, bundle publication, downstream verification,
activation readiness, customer handoff, and activation receipt.

The repository currently has these relevant surfaces:

- `shadow-events.ts`: digest-first shadow admission events.
- `shadow-simulation.ts`: simulation report generation.
- `shadow-policy-promotion-draft.ts`: draft-only promotion records.
- `shadow-policy-bundle-publication.ts`: signed shadow policy bundle publication.
- `shadow-activation-readiness-gate.ts`: seven-component activation readiness.
- `shadow-customer-activation-handoff.ts`: customer controls and operator handoff.
- `shadow-persistence-store.ts`: file-backed evaluation storage.
- `production-storage-path.ts`: selected-profile storage readiness evaluation.
- `shadow-routes.ts`: HTTP route composition for the shadow surfaces.

## Standards Anchors

- OWASP API Security Top 10 2023: API3, API5, and API8 are relevant to shadow
  route authorization, object-property validation, and deployment-mode
  misconfiguration.
- NIST SP 800-53 Rev. 5: AC-5, AU-4, CA-8, IR-4, RA-3, and SA-15 are useful
  engineering anchors for separation of duties, audit storage, red-team testing,
  incident handling, risk assessment, and development process controls.
- NIST SP 800-115: useful for framing red-team and technical testing as evidence,
  not as proof of production security.

## Validation Summary

| ID | Report claim | Repository status | Validation result |
|---|---|---|---|
| F7-S1 | Shadow event injection without origin-binding | Shadow events carry `admissionId` and `admissionDigest`; no production-path cryptographic witness is required. The direct public route-injection wording is too strong because shadow simulation routes read events through `deps.listShadowEvents({ tenant })`, not arbitrary event arrays from the caller. | `partial` |
| F7-S2 | `redactionLevel: operator-supplied` is a self-attest hole | `operator-supplied` exists, but `createShadowAdmissionEvent` stores feature keys and a digest, not raw observed feature values. The raw-leak wording is too broad. A redaction-policy witness is still absent. | `partial` |
| F7-S3 | Simulation report window can be widened/narrowed by attacker | Core simulation accepts caller-provided events and threshold, but HTTP routes use persisted tenant events. `minimumPromotionEvents` is still request-controlled within validation bounds. | `partial` |
| F7-S4 | Break-glass rollout has no extra gate | `break-glass` is an equal rollout strategy and does not require a distinct secondary approver, expiry, or reconciliation record. | `open` |
| F7-S5 | `customerControlsReady` can flip true with missing required controls | Current code computes `customerControlsReady = controlRefs.every((control) => control.present)`, and tests cover missing controls. | `invalid-as-stated` |
| F7-S6 | Shadow persistence is per-node single-host | File-backed shadow persistence is real, but `production-storage-path.ts` explicitly marks shadow stores as `shared-durable` requirements and blocks `production-shared` by default. | `accepted-limitation` |
| F7-S7 | Policy Foundry red-team replay is not a runtime gate | Correct boundary. Replay tests exist; they do not replace production runtime guards. | `accepted-limitation` |
| F7-S8 | Shadow-to-enforce promotion is single-operator gated | `shadow-customer-activation-handoff.ts` has `operatorRef`, not a required two-person high-risk promotion contract. | `open` |
| F7-S9 | Shadow bundle signing inherits signing-layer blast radius | The shadow bundle publication has a signing boundary, but it is not independently tenant-isolated by default. This overlaps F6-T1/F6-T6 and needs a dedicated boundary validation before stronger claims. | `partial` |
| F7-S10 | `productionReady: false` flags are descriptive only | Storage readiness is enforced for selected profile through `production-storage-path.ts`. There is not yet a universal boot-time aggregator for every shadow module's production-readiness descriptor. | `partial` |

## Corrected Queue

After this validation slice, F7 has six planned repository units:

1. Shadow event origin and redaction witness: F7-S1 plus F7-S2.
2. Server-owned simulation policy floor: F7-S3.
3. Break-glass hardening: F7-S4.
4. Two-person high-risk activation handoff: F7-S8.
5. Shadow bundle signing boundary validation: F7-S9.
6. Shadow readiness and claim alignment: F7-S10.

F7-S5 is invalid as stated. F7-S6 is an accepted repository limitation because
selected-profile storage readiness already blocks `production-shared` when
shadow stores remain file-backed. F7-S7 is a true boundary: red-team replay is
evidence and design feedback, not a runtime guard.

## Go / No-Go

| Claim | Verdict |
|---|---|
| Attestor has a typed shadow-to-enforce pipeline | Holds. The pipeline has staged contracts and tests. |
| Shadow event data cannot poison promotion | Not yet. Origin witness and redaction witness remain partial. |
| Customer controls can be marked ready while a required control is missing | Invalid as stated. Current code uses strict `every(...)`. |
| File-backed shadow stores are allowed for `production-shared` readiness | Invalid as stated. Selected-profile storage readiness blocks this by default. |
| Break-glass activation is specially gated | Not yet. |
| High-risk shadow activation requires two people | Not yet. |
| Red-team replay equals runtime enforcement | No. It is evidence, not runtime enforcement. |

## Sources

- OWASP API Security Top 10 2023: https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- NIST SP 800-53 Rev. 5: https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final
- NIST SP 800-115: https://csrc.nist.gov/pubs/sp/800/115/final
