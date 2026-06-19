# Pricing ROI Calculator

This page turns Attestor pricing into a simple buyer-facing sizing and ROI model.

Use [Commercial packaging, pricing, and evaluation](product-packaging.md) as the source of truth for plan names, list prices, usage limits, overage rates, free evaluation posture, add-ons, and production licensing boundaries. This page is only the calculator logic that can later become a public website widget, sales worksheet, or checkout preflight.

## Inputs

Ask for five values:

| Input | Meaning |
|---|---|
| `daily_admissions` | Proposed consequences Attestor evaluates per day. |
| `business_days_per_month` | Default `22` for workday-heavy workflows, or `30` for always-on agent/platform traffic. |
| `high_consequence_actions_per_month` | Subset of admissions that could cause money movement, filing, external communication, policy activation, release, or irreversible execution. |
| `estimated_loss_per_bad_action_usd` | Customer's own estimate of one bad consequence. |
| `prevented_bad_actions_per_year` | Conservative expected number of avoided incidents per year. Use `1` as the simplest baseline. |

Do not ask for seats, prompts, tokens, MAU, or files. Those are not the Attestor value unit.

## Volume Sizing

Calculate:

```text
monthly_admissions = daily_admissions * business_days_per_month
```

Then recommend:

| Monthly admissions | Recommendation |
|---:|---|
| `0` to `10,000` total during onboarding | Trial account entitlement, if evaluation is enough. |
| `0` to `15,000` per month | Pilot Workflow for one selected pack without enforce mode. |
| `0` to `25,000` per month | Starter Workflow when one production workflow needs review/enforce. |
| `25,001` to `250,000` per month | Pro Workflow. |
| `250,001` and above | Negotiated deployment or custom commercial workflow terms. |

When enforcement is required, do not recommend Trial or Pilot Workflow by
themselves. Production enforcement needs Starter Workflow or Pro Workflow plus
a customer PEP/gate.

## Subscription Cost

Use current workflow list prices:

| Billing surface | Monthly list price | Included admissions | Overage |
|---|---:|---:|---:|
| Trial account entitlement | `$0` | `10,000` total over `30` days | none; hard stop |
| Pilot Workflow | `$99` | `15,000` / month | none; hard stop |
| Starter Workflow | `$299` | `25,000` / month | `$0.05` |
| Pro Workflow | `$999` | `250,000` / month | `$0.025` |
| Negotiated deployment | custom | custom | custom |

For paid plans:

```text
monthly_subscription_cost =
  monthly_list_price + max(0, monthly_admissions - included_monthly_admissions) * overage_rate
```

Negotiated deployment and custom workflow terms should be confirmed in a sales
conversation before quoting overage-heavy workloads.

## Avoided-Loss ROI

Calculate:

```text
annual_subscription_cost = monthly_subscription_cost * 12
annual_avoided_loss = estimated_loss_per_bad_action_usd * prevented_bad_actions_per_year
roi_multiple = annual_avoided_loss / annual_subscription_cost
```

Example:

| Field | Value |
|---|---:|
| daily admissions | `2,000` |
| business days per month | `22` |
| monthly admissions | `44,000` |
| recommended billing surface | Pro Workflow |
| monthly subscription cost | `$999` |
| annual subscription cost | `$11,988` |
| estimated loss per bad action | `$250,000` |
| prevented bad actions per year | `1` |
| ROI multiple | `20.9x` |

Use conservative avoided-loss values. Attestor is not insurance and does not guarantee that every bad action is prevented; the calculator only helps a customer compare control cost with consequence risk.

## Pricing Page Copy

Recommended short copy:

> Size Attestor by admissions before consequence. One admission is one proposed high-consequence action evaluated before your system acts. Safe verification, account reads, billing reads, and idempotent retries are not the meter.

Recommended CTA logic:

| Condition | CTA |
|---|---|
| wants evaluation only | Start Trial |
| wants scoped rollout rehearsal | Start Pilot Workflow |
| wants one production workflow | Start Starter Workflow |
| wants SSO, RBAC, dual-control, or all current hosted packs | Start Pro Workflow |
| wants high volume, retention, support, custom integrations, self-hosted, air-gapped, dedicated, or regulated deployment | Talk to Sales |

## What Not To Claim

Do not claim:

- that legacy Developer account access is an active billing plan
- that Trial by itself enforces production workflows
- that Pilot Workflow by itself enforces production workflows
- that annual Stripe checkout is wired until the runtime supports billing intervals
- that negotiated deployment is self-service checkout; it remains offline/operator-owned
- that the ROI multiple is guaranteed savings

Those boundaries keep the pricing page aligned with the shipped runtime and the commercial source of truth.
