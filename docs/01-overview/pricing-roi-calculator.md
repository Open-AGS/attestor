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
| `0` to `500` | Developer, if shadow/warn evaluation is enough. |
| `501` to `5,000` | Trial for serious shadow evaluation, or Starter if enforcement is needed now. |
| `5,001` to `25,000` | Starter. |
| `25,001` to `250,000` | Pro. |
| `250,001` to `1,000,000` | Scale. |
| `1,000,001` and above | Enterprise conversation. |

When enforcement is required, do not recommend Developer. Developer is a free evaluation path, not a production enforcement promise.

## Subscription Cost

Use current list prices:

| Plan | Monthly list price | Included monthly admissions | Overage |
|---|---:|---:|---:|
| Developer | `$0` | `500` | none; upgrade required |
| Trial | `$0` | `5,000` total during trial | none; convert or upgrade |
| Starter | `$299` | `25,000` | `$0.05` |
| Pro | `$1,499` | `250,000` | `$0.025` |
| Scale | `$5,999` | `1,000,000` | `$0.015` |
| Enterprise | custom | custom | custom |

For paid plans:

```text
monthly_subscription_cost =
  monthly_list_price + max(0, monthly_admissions - included_monthly_admissions) * overage_rate
```

Scale and Enterprise pricing should be confirmed in a sales conversation before quoting overage-heavy workloads.

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
| recommended plan | Pro |
| monthly subscription cost | `$1,499` |
| annual subscription cost | `$17,988` |
| estimated loss per bad action | `$250,000` |
| prevented bad actions per year | `1` |
| ROI multiple | `13.9x` |

Use conservative avoided-loss values. Attestor is not insurance and does not guarantee that every bad action is prevented; the calculator only helps a customer compare control cost with consequence risk.

## Pricing Page Copy

Recommended short copy:

> Size Attestor by admissions before consequence. One admission is one proposed high-consequence action evaluated before your system acts. Safe verification, account reads, billing reads, and idempotent retries are not the meter.

Recommended CTA logic:

| Condition | CTA |
|---|---|
| wants evaluation only | Start Developer |
| wants shadow evaluation at real volume | Start 60-day Trial |
| wants one production workflow | Start Starter |
| wants SSO, dual-control, and multiple workflows | Start Pro |
| wants high volume, retention, support, or custom integrations | Talk to Sales for Scale |
| wants self-hosted, air-gapped, dedicated, or regulated deployment | Talk to Sales for Enterprise |

## What Not To Claim

Do not claim:

- that Developer enforces production workflows
- that Trial is automatically provisioned by hosted signup today
- that annual Stripe checkout is wired until the runtime supports billing intervals
- that Enterprise is self-service checkout unless `ATTESTOR_STRIPE_PRICE_ENTERPRISE` is intentionally configured
- that the ROI multiple is guaranteed savings

Those boundaries keep the pricing page aligned with the shipped runtime and the commercial source of truth.
