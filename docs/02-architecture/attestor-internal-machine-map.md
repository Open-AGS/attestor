# Attestor Internal Machine Map

Status: engine-level internal map for the current consequence path.

This document shows Attestor as one consequence-control machine. It is complete
for the main engine path: proposed action, admission decision, release
authorization, enforcement verification, customer gate, downstream action or
hold, receipt, and proof packet. It is not a claim that every source file,
deployment control, customer integration, or live production dependency is
shown in the picture.

## Core Shape

```text
AI / workflow proposes an action
  -> strict consequence request
  -> PIP evidence and context inputs
  -> PDP consequence admission decision
  -> admit | narrow | review | block
  -> PAP release authorization only for admit/narrow
  -> PEP release-enforcement verification
  -> customer gate / downstream PEP
  -> real action or nothing happens
  -> receipt and digest-only proof packet
```

The compact decision-space model is:

```text
untrusted action intent
  -> admission PDP
  -> protected release authorization
  -> enforcement PEP
  -> customer gate
  -> downstream consequence or hold
```

## Vocabulary Boundary

Attestor uses the standard access-control separation:

| Term | Meaning in this map | Attestor surface |
| --- | --- | --- |
| PIP | Policy Information Point: policy, evidence, authority, tenant, freshness, no-go, and context inputs. | Evidence refs, authority refs, policy refs, tenant context, replay/idempotency facts. |
| PAP | Policy Administration Point: policy and release administration. | Policy versions, release records, reviewer/signer refs, protected release-token issuance. |
| PDP | Policy Decision Point: evaluates the consequence request and returns a decision. | Consequence Admission Core: `admit`, `narrow`, `review`, `block`. |
| PEP | Policy Enforcement Point: enforces or holds before the real downstream action. | Release Enforcement Verifier plus customer gate / downstream gate. |

This vocabulary is aligned with NIST SP 800-162 and the OASIS XACML
architecture, but Attestor's decisions are consequence-admission decisions,
not a generic access-control product claim.

Source anchors:

- [NIST SP 800-162](https://csrc.nist.gov/pubs/sp/800/162/upd2/final)
- [OASIS XACML 3.0 core specification](https://docs.oasis-open.org/xacml/3.0/xacml-3.0-core-spec-cos01-en.html)

## Full Consequence Path Map

The map below is the canonical human-readable diagram for this document. It is
kept as plain text so the structure is visible in Markdown, code review,
terminal output, and repository diffs.

The customer-gate box marks the customer/downstream enforcement boundary.
This is where non-bypassability must be proven in a real customer deployment.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ AI AGENT / WORKFLOW                                                   │
│                                                                      │
│ "refund 50 EUR for customer X"                                       │
│ "export these rows"                                                  │
│ "change user role"                                                   │
│                                                                      │
│ Output: proposed action intent                                       │
│ Authority: NONE                                                      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ ACTION INTENT NORMALIZER                                              │
│                                                                      │
│ Turns messy AI/workflow output into a strict consequence request:     │
│                                                                      │
│  action                                                              │
│  actor                                                               │
│  target                                                              │
│  tenant                                                              │
│  scope                                                               │
│  evidence refs                                                       │
│  approval refs                                                       │
│  idempotency key                                                     │
│  requested downstream system                                         │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                ├── invalid / incomplete intent
                │       ▼
                │   ┌──────────────────────────────┐
                │   │ HOLD BEFORE DECISION          │
                │   │ no release token              │
                │   │ no downstream action          │
                │   └──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PIP: POLICY / EVIDENCE / CONTEXT INPUTS                              │
│                                                                      │
│  ┌──────────────────────┐   ┌──────────────────────┐                │
│  │ Policy version        │   │ Evidence refs         │                │
│  │ active rules          │   │ documents / receipts  │                │
│  └──────────────────────┘   └──────────────────────┘                │
│                                                                      │
│  ┌──────────────────────┐   ┌──────────────────────┐                │
│  │ Actor authority       │   │ Approval provenance   │                │
│  │ role / delegation     │   │ who approved what     │                │
│  └──────────────────────┘   └──────────────────────┘                │
│                                                                      │
│  ┌──────────────────────┐   ┌──────────────────────┐                │
│  │ Tenant / target       │   │ Replay / idempotency  │                │
│  │ boundary              │   │ has this run before?  │                │
│  └──────────────────────┘   └──────────────────────┘                │
│                                                                      │
│  ┌──────────────────────┐   ┌──────────────────────┐                │
│  │ No-go / hold state    │   │ Freshness             │                │
│  │ freeze / compliance   │   │ stale approval?       │                │
│  └──────────────────────┘   └──────────────────────┘                │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PDP: CONSEQUENCE ADMISSION CORE                                       │
│                                                                      │
│ Main decision engine.                                                │
│                                                                      │
│ Checks:                                                              │
│  ├─ Is the policy active and applicable?                             │
│  ├─ Does evidence bind to this action?                               │
│  ├─ Is the actor authorized?                                         │
│  ├─ Is approval real, fresh, and scoped?                              │
│  ├─ Does tenant match?                                                │
│  ├─ Does target system match?                                         │
│  ├─ Is requested scope too wide?                                      │
│  ├─ Is there a no-go/compliance hold?                                 │
│  ├─ Is this a replay or duplicate?                                    │
│  ├─ Is untrusted content trying to become authority?                  │
│  └─ Are deterministic constraints satisfied?                          │
│                                                                      │
│ Output: admit | narrow | review | block                              │
│         reason codes                                                 │
│         proof refs                                                   │
│         constraints                                                  │
└───────────────┬──────────────────┬──────────────────┬───────────────┘
                │                  │                  │
                ▼                  ▼                  ▼
        ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
        │ ADMIT         │   │ NARROW        │   │ REVIEW           │
        │ allowed as-is │   │ allowed only  │   │ human/operator   │
        │              │   │ in bounds     │   │ hold required    │
        └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘
               │                  │                    │
               │                  │                    ▼
               │                  │             ┌──────────────┐
               │                  │             │ NO EXECUTION  │
               │                  │             │ proof only    │
               │                  │             └──────────────┘
               │                  │
               │                  │
               │                  │             ┌──────────────────┐
               │                  └────────────▶│ bounded scope     │
               │                                │ constraints bind  │
               │                                └────────┬─────────┘
               │                                         │
               ▼                                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PAP / RELEASE AUTHORIZATION LAYER                                    │
│                                                                      │
│ Only ADMIT and NARROW can enter this path.                            │
│ REVIEW/BLOCK must not produce executable authority.                   │
│                                                                      │
│  ├─ bind decision id                                                  │
│  ├─ bind policy version                                               │
│  ├─ bind tenant                                                       │
│  ├─ bind target/audience                                              │
│  ├─ bind approved or narrowed scope                                   │
│  ├─ bind proof refs                                                   │
│  ├─ bind expiry                                                       │
│  ├─ bind sender constraint                                            │
│  ├─ sign protected release token                                      │
│  └─ register token for introspection                                  │
│                                                                      │
│ Output: protected release token                                      │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                ├── signing / policy / proof binding failure
                │       ▼
                │   ┌──────────────────────────────┐
                │   │ NO RELEASE                    │
                │   │ no downstream action          │
                │   └──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ RELEASE ENFORCEMENT VERIFIER                                         │
│ PEP-side verifier                                                     │
│                                                                      │
│ Checks:                                                              │
│  ├─ token signature valid?                                            │
│  ├─ token not expired?                                                │
│  ├─ token audience matches downstream?                                │
│  ├─ token tenant matches request?                                     │
│  ├─ scope matches approved/narrowed scope?                            │
│  ├─ sender-constrained presentation exists?                           │
│  ├─ online introspection says active?                                 │
│  ├─ replay consumption succeeds once?                                 │
│  ├─ body/action digest matches?                                       │
│  └─ release proof ref matches admission?                              │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                ├── any check fails
                │       ▼
                │   ┌──────────────────────────────┐
                │   │ HOLD                          │
                │   │ no downstream action          │
                │   │ reason is recorded            │
                │   └──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ CUSTOMER GATE / DOWNSTREAM PEP                                       │
│                                                                      │
│ Production: customer-owned, customer-operated.                       │
│ Attestor cannot magically force this unless customer wires it in.    │
│                                                                      │
│ Gate asks:                                                           │
│  ├─ Did Attestor admit or narrow?                                     │
│  ├─ Is release proof valid?                                           │
│  ├─ Was replay consumed?                                              │
│  ├─ Is this the right tenant?                                         │
│  ├─ Is this the right target system?                                  │
│  ├─ Is this the right action?                                         │
│  ├─ Is scope within allowed bounds?                                   │
│  └─ Is the downstream call still permitted?                           │
└───────────────┬──────────────────────────────────────┬───────────────┘
                │                                      │
                │                                      ├── any check fails
                │                                      │       ▼
                │                                      │   ┌─────────────────────┐
                │                                      │   │ NOTHING HAPPENS      │
                │                                      │   │ no refund/export/etc │
                │                                      │   └─────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ REAL DOWNSTREAM ACTION                                                │
│                                                                      │
│ Examples:                                                            │
│  ├─ refund 50 EUR                                                     │
│  ├─ export approved data                                              │
│  ├─ send external message                                             │
│  ├─ change authority/role                                             │
│  └─ execute operational action                                        │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ DOWNSTREAM RECEIPT                                                    │
│                                                                      │
│  ├─ what executed                                                     │
│  ├─ where it executed                                                 │
│  ├─ when it executed                                                  │
│  ├─ provider/job/object/transaction ref                               │
│  ├─ executed scope digest                                             │
│  └─ no raw sensitive payload                                          │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PROOF PACKET / AUDIT OUTPUT                                           │
│                                                                      │
│ Collects digest-only evidence from every layer:                       │
│                                                                      │
│  ├─ AI action digest                                                  │
│  ├─ normalized intent digest                                          │
│  ├─ PDP decision                                                      │
│  ├─ reason codes                                                      │
│  ├─ policy version                                                    │
│  ├─ evidence refs                                                     │
│  ├─ release token id/digest, not raw token                            │
│  ├─ introspection result                                              │
│  ├─ replay consumption result                                         │
│  ├─ customer gate decision                                            │
│  ├─ downstream receipt                                                │
│  ├─ redaction scan                                                    │
│  └─ no-claims                                                         │
└──────────────────────────────────────────────────────────────────────┘
```

## Branching Outcome Rules

| Decision | Release authorization | Enforcement / customer gate | Downstream action |
| --- | --- | --- | --- |
| `admit` | Protected release token may be issued. | Must verify token, introspection, replay, sender, target, tenant, scope, and proof binding. | Executes only if the gate proceeds. |
| `narrow` | Protected release token may be issued for the narrowed scope. | Must verify the narrowed scope and proof binding. | Executes only within the narrowed scope. |
| `review` | No executable release should be treated as authority. | Gate holds. | No action. |
| `block` | No executable release should be treated as authority. | Gate holds or blocks. | No action. |

Protected release authorization cannot rescue a bad request. If the export
intent, tenant, target, action, proof ref, sender binding, online
introspection, replay consumption, or scope binding fails, the PEP/customer
gate holds and the downstream action does not run.

The admission check kinds stay explicit in the map contract: `policy`,
`authority`, `evidence`, `freshness`, `enforcement`, and
`adapter-readiness`.

## Proof Packet Shape

The proof packet is the audit output of the whole path. It should carry
digest-only evidence:

```text
AI action digest
normalized request digest
PDP decision and reason codes
policy version
evidence refs
protected release token id/digest, not raw token
online introspection result
replay consumption result
customer gate decision
downstream receipt refs
redaction scan
no-claims
```

The proof packet must not carry raw prompts, raw provider bodies, raw release
tokens, sender proofs, raw rows, credentials, customer identifiers, private
policy internals, or provider error bodies.

## Main Parts

| Part | Main code | Role in the map |
| --- | --- | --- |
| Model/provider edge | `src/api/*` | Optional upstream source of proposed action intent; model output has no authority by itself. |
| Consequence admission core | `src/consequence-admission/*` | Normalizes and evaluates proposed consequences; emits `admit`, `narrow`, `review`, or `block`. |
| Release kernel/layer | `src/release-kernel/*`, `src/release-layer/*` | Binds accepted decisions to proof, policy version, reviewer/signer references, and release authorization. |
| Policy control plane | `src/release-policy-control-plane/*` | Creates, activates, resolves, and audits policy bundles and policy versions. |
| Release enforcement plane | `src/release-enforcement-plane/*` | Verifies release tokens, sender-bound presentations, online introspection, replay, and downstream binding. |
| Customer gate | `src/consequence-admission/customer-gate.ts` | Last proceed/hold gate before a real downstream consequence. |
| Domain packs | `src/financial/*`, `src/crypto-*/*`, `src/filing/*`, `src/domains/*` | Project domain-specific actions into the same consequence-admission engine. |
| Hosted service/runtime | `src/service/*` | Routes, tenant context, account/admin surfaces, stores, workers, and runtime composition. |
| Signing and proof support | `src/signing/*`, `src/proof-surface/*`, `src/showcase/*` | Verification kits, certificates, proof display, and reviewable proof artifacts. |
| Shadow-to-policy loop | `src/consequence-admission/shadow-*`, `src/consequence-admission/policy-foundry-*`, `src/consequence-admission/action-surface-*` | Review/onboarding side loop; it informs future policy but is not the enforcement edge. |

## Path Notes

### Allowed Path

```text
admit
  -> protected release token
  -> release-enforcement verifier
  -> customer gate proceeds
  -> downstream action executes
  -> receipt + proof packet
```

### Narrowed Path

```text
narrow
  -> protected release token bound to narrowed scope
  -> release-enforcement verifier
  -> customer gate proceeds only for narrowed scope
  -> bounded downstream action executes
  -> receipt + proof packet
```

### Hold Paths

```text
review
  -> no executable downstream authority
  -> customer gate holds
  -> proof explains why no action ran

block
  -> no executable downstream authority
  -> customer gate holds or blocks
  -> proof explains why no action ran
```

### Failure Paths

```text
invalid intent
missing proof
wrong tenant
wrong target or audience
wrong action
stale token
missing sender constraint
missing online introspection
replayed authorization
scope outside allowed bounds
redaction failure
```

Each failure path must hold before the real downstream action, or mark the
artifact as not shareable when the issue is proof-output redaction.

## Proof Boundary

This map explains the internal consequence path only. Production operation,
enterprise readiness, customer deployment, live customer PEP non-bypassability,
shared replay/introspection stores, external key-backed signing, and
compliance certification remain separate proof obligations.
