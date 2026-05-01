# Money Movement Shadow Pack

The Money Movement shadow pack is the first consequence-pack policy discovery slice.

It does not move money, sign transactions, call a payment processor, or replace customer approval policy. It turns redacted shadow observations into policy candidates that a customer can review before enforcement.

## Input Boundary

The pack works from two inputs:

- a shadow admission event
- operator-supplied money-movement observations

The observation must be data-minimized:

- amount bucket, not raw payment instruction
- currency
- recipient digest, not raw recipient
- recipient class, such as `vendor`, `customer`, or `internal`
- value direction, such as `refund`, `payout`, `payment`, `credit`, or `adjustment`

Recipient values must be provided as `sha256:` digests. The pack rejects raw-looking recipient identifiers.

## What It Recommends

The first report can produce:

- auto-admit ceiling candidates for lower-value bands that stayed clean in shadow traffic
- review threshold candidates where actions started needing review
- block threshold candidates where actions blocked or were rejected
- recurring recipient allowlist candidates
- recipient review candidates
- stay-in-shadow recommendations when there is not enough observed traffic

These are candidates, not applied policy. A customer still has to review, approve, and bind the policy before `review` or `enforce` mode.

## Why This Shape

This follows a proven operational pattern:

- AWS IAM Access Analyzer generates policy templates from observed CloudTrail access activity.
- Google Cloud IAM Recommender uses permission-usage observations to recommend tighter roles.
- Stripe Radar lets teams place unusual or high-risk payments into review and inspect rule impact before tightening rules.

Attestor applies the same idea to AI action authorization: observe proposed consequences, recommend control boundaries, simulate impact, then require human approval before enforcement.

## Current Boundary

This is not a fraud engine, payment-risk model, bank policy engine, or custody control. It is a money-movement policy discovery pack for the generic admission path.

Production use still requires customer-side enforcement, amount limits, recipient mapping, maker-checker review, downstream token verification, audit retention, and independent security/compliance review.
