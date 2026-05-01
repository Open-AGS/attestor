# Policy Discovery Candidates

Policy discovery is the handoff between shadow observation and customer-approved enforcement.

It answers this operator question:

```text
What policy work should we do before this AI action surface can move past shadow mode?
```

The first hosted surface is:

```text
GET /api/v1/shadow/policy-candidates
```

## What It Produces

The route converts the latest shadow policy simulation report into approval-required candidates:

- draft a policy for an action surface
- bind missing evidence
- bind missing authority
- prepare a downstream adapter
- investigate blocked or rejected actions
- reduce expected review load
- rehearse review mode
- rehearse enforce mode

Every candidate includes the source action surface, domain, proposed mode, required control closures, reason codes, confidence, and source recommendation kinds.

## Approval Boundary

Policy candidates are not policy changes.

The bundle and every candidate explicitly set:

```text
approvalRequired: true
autoEnforce: false
```

This is deliberate. Shadow mode may discover a candidate policy, but a customer or operator must approve it before any enforcement posture changes.

## Data Boundary

The candidate bundle is data-minimized. It works from simulation recommendations, action surfaces, counters, reason codes, and report digests.

It does not return raw prompts, raw tool payloads, recipients, evidence ids, SQL, customer records, payment secrets, wallet material, or downstream response bodies.

Every hosted response is served with `cache-control: no-store`.

## Design Basis

This mirrors established control workflows:

- AWS IAM Access Analyzer generates policy candidates from observed CloudTrail activity, then expects review and customization before attachment.
- Google Cloud Recommender recommendations have lifecycle states such as active, claimed, succeeded, failed, and dismissed.
- OPA decision logs support masking sensitive inputs before export.
- OPA policy testing separates candidate policy authoring from promotion.

Attestor applies the same discipline to AI action authorization: observe actions, recommend control work, require approval, then promote deliberately.

## Current Boundary

This is an evaluation candidate model with a hosted read route, file-backed candidate materialization, lifecycle transitions, a non-enforcing promotion draft, a non-enforcing policy promotion packet, and a packet impact simulation over shadow events. It is not yet:

- an automatic policy writer
- a policy compiler
- a customer-operated enforcement promotion system

The production path should bind candidates to shared tenant-scoped storage, reviewer identity, policy bundle versions, simulations, and downstream enforcement proofs.
