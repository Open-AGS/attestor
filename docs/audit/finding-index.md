# Finding Index

This is the current-state index for important Attestor audit findings. It is
not a complete backfill of every historical low-severity note. It is the
canonical place to reconcile findings that affect posture, live-shadow
readiness, public claims, or P0/P1 execution.

Historical remediation documents remain evidence leaves. A finding is current
only when this file points to current repository evidence or a live proof gap.

## State Labels

- `open`: current repository evidence still supports the issue.
- `closed`: current repository evidence shows the issue is fixed.
- `disputed/closed`: original risk is contradicted or bounded by current repo
  evidence.
- `accepted limitation`: documented limitation accepted for the current scope.
- `live-proof-only`: repo-side work is complete; live environment evidence is
  still required.
- `needs live test`: cannot be proven from repository evidence alone.
- `needs ops proof`: requires cloud/IAM/KMS/network/runtime evidence.
- `not proven`: insufficient evidence to claim.

## Current High-Signal Findings

| Finding | Current state | Severity | Protected principle | Current evidence | Required action |
|---|---|---:|---|---|---|
| `B-081` scope tiebreak locale comparison | `closed` | Low/Medium | proof integrity; deterministic policy resolution | `docs/audit/REM-2026-POL-SCOPING-001.md`; `src/release-policy-control-plane/scoping.ts`; PR `#502`. | No further repo action unless non-ASCII scope identifiers are intentionally introduced. |
| `B-059` trusted proxy wildcard | `disputed/closed` | Low | fail-closed boundary; operational boundedness | `src/service/trusted-proxy.ts` requires `ATTESTOR_TRUSTED_PROXY_PEER_WILDCARD_OVERRIDE=accept-the-risk`. | Keep deployment docs explicit that wildcard is an exceptional operator override. |
| `B-069` Vault Transit timeout | `closed` | Low | availability; operational boundedness | `src/service/secret-envelope.ts` uses bounded Vault Transit timeout with configurable default. | No further repo action. Live Vault latency behavior remains an ops test. |
| `B-033` optional tenant payload binding | `open` | Medium | tenant isolation | Prior posture assessments identify optional payload tenant mismatch behavior; route-wide proof is incomplete. | Add route/token/proof/dashboard tenant mismatch tests and update index with file-level evidence. |
| `B-025` demo CLI scenario path traversal | `open` | Low | data minimization; demo safety | Historical report notes scenario path is caller-supplied. Current repo proof needs revalidation before fix. | Revalidate against current `origin/master`; fix before public demo if still repo-proven. |
| `B-028` secret redaction coverage | `open` | Low/Medium | data minimization and redaction | Historical report notes Stripe-focused redaction; broader AWS/GCP/JWT/SSH/GitHub token coverage needs current proof. | Expand redaction fixtures and public/demo artifact scan before public demo. |
| Admin API key blast radius | `open` | P1 | customer authority; operational boundedness | `ATTESTOR_ADMIN_API_KEY` remains a high-value secret used for administrative surface. | Add admin key blast-radius documentation, rotation proof, and route authorization sweep. |
| Customer PEP no-bypass | `needs live test` | P0 | enforcement boundary; customer authority | Baseline requires live customer PEP integration proof; repo-side primitives are not enough. | Build one reference PEP deployment and prove direct downstream bypass fails. |
| External KMS runtime signing | `needs ops proof` | P0 | proof integrity; key authority | Baseline requires KMS/HSM-backed signer proof; repo has PKI PVC boundary hardening but not live KMS authority proof. | Wire and prove external KMS runtime signing before limited enforcement. |
| Shared replay / introspection store | `needs live test` | P0/P1 | replay and idempotency safety | Repo has replay/freshness primitives and live proof gates; HA behavior needs Redis/Postgres-backed live proof. | Run multi-instance replay, outage, and fail-closed tests. |
| `ops/**` audit gap | `partial` | P0/P1 | runtime readiness | `OPS-SWEEP-01` and `OPS-SWEEP-02` are indexed; observability, PITR/Redis, autoscaling, profiles remain. | Continue `OPS-SWEEP-03` with observability and log/data minimization. |
| `src/service` admin routes gap | `open` | P0/P1 | customer authority; service/API security | Baseline flags `src/service/http/routes/admin-routes.ts` as high-value and not deeply audited. | Deep audit admin routes after current ops sweep phase or when baseline reprioritizes. |
| Required commit signatures | `open` | P0/P1 | release provenance | Baseline records branch-protection gap. | Enable required signatures and verify unsigned commit cannot merge. |
| Required PR reviews | `open` | P0/P1 | release provenance; auditability | Baseline records branch-protection gap. | Configure required approving review count and verify same-author/self-merge is blocked. |
| Test adequacy map | `open` | P1 | auditability; no overclaim | Targeted tests exist, but invariant-to-finding coverage map is incomplete. | Build P0/P1 finding-to-test matrix and add guard for closed critical findings. |

## Intake Rule For New Findings

Every P0/P1 finding and every finding that changes public readiness posture must
be added here with:

- current state,
- severity,
- protected principle,
- current repository evidence or explicit live-proof gap,
- required action.

Low/Medium findings may remain in a report until they affect baseline posture,
public claims, or a remediation PR.
