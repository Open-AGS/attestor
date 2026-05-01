# Shadow Policy Simulation

Shadow mode becomes useful when it can answer a concrete operator question:

```text
If we promoted this action surface, what would Attestor admit, review, narrow, or block?
```

The shadow policy simulation report replays shadow admission events under a proposed mode and turns the result into an adoption report.

## What It Produces

The report includes:

- event window and event digests
- proposed mode
- simulated admit, narrow, review, and block counts
- policy, evidence, authority, and adapter gap counts
- review load and blocked action counts
- action-surface summaries
- recommendations for the next operator step

This is the bridge between shadow mode and enforcement. It lets teams see the expected operational impact before changing a live workflow.

## Recommendation Types

The first recommendation layer is intentionally conservative:

- `define-policy` when shadow traffic has no policy reference
- `bind-evidence` when evidence references are missing
- `bind-authority` when actor authority closure is missing
- `prepare-adapter` when a downstream adapter is not ready
- `investigate-blocks` when shadow replay finds blocked or human-rejected actions
- `reduce-review-load` when too much traffic would go to review
- `promote-to-review` or `promote-to-enforce` only after clean shadow traffic

Recommendations are not autonomous policy changes. They are operator-facing candidates that must be reviewed before enforcement.

## Data Boundary

Simulation works from shadow event metadata, digests, reason codes, and counters. It does not require raw prompts, raw tool payloads, customer records, payment instructions, SQL text, wallet material, or downstream response bodies.

That boundary is important: the report should make the risk visible without becoming a new sensitive-data warehouse.

## Current Boundary

This is an evaluation report model. It is not yet:

- a persistent production simulation store
- a full policy discovery engine
- a dashboard
- an automatic policy writer
- a legal or regulatory control report

The next production layer should store simulation reports in a shared tamper-evident path, bind them to approved policy versions, and require customer approval before a surface is promoted from shadow mode.
