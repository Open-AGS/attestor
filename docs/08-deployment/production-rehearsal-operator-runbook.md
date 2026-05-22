# Production Rehearsal Operator Runbook

This runbook is the operator-facing companion for the production rehearsal track. It is scoped to the named `gke-production-rehearsal` target and the `production-shared` runtime profile.

It does not claim customer-operated production readiness by itself. It tells the operator when to stop, what evidence to collect, and which handoffs must be present before Step 10 packages a production-promotion candidate.

## Before Starting

Confirm the target is the same target used by the rehearsal manifest and target profile:

- `ATTESTOR_RUNTIME_PROFILE=production-shared`
- the target profile is `gke-production-rehearsal`
- the release authority request path uses `async-shared-authority-stores`
- shared PostgreSQL and Redis are provided by external substrates
- External Secrets and Workload Identity own runtime secrets
- the observability provider, Prometheus URL, Alertmanager URL, and dashboard URL are explicit

Run the planner first:

```bash
npm run plan:production-rehearsal -- --manifest path/to/filled-production-rehearsal-manifest.json
```

## Required Rehearsal Order

Run the gates in this order. Stop immediately when a required command fails.

1. `npm run verify`
2. `npm run probe:production-rehearsal-substrates`
3. `npm run rehearse:production-consequence`
4. `npm run rehearse:production-async-recovery`
5. `npm run rehearse:production-backup-restore-dr`
6. `npm run rehearse:production-observability-alerting`

Step 09 assumes Steps 05, 06, 07, and 08 already passed for the same target. Do not run Step 09 as a substitute for backup, restore, DR, queue, worker, or fail-closed consequence behavior evidence.

## Observability Checks

Step 09 verifies the runtime signal path and the operator surface:

- OTLP logs, traces, and metrics flush successfully
- Prometheus query API is reachable
- Alertmanager alerts API is reachable
- Alertmanager routing resolves representative warning, critical, default, security, billing, and watchdog scenarios
- every required routed receiver has a delivery target
- API health and readiness expose `runtimeProfile=production-shared`
- API health and readiness expose release runtime durability as ready
- API health and readiness expose `async-shared-authority-stores`
- API health and readiness expose `usesSharedAuthorityStores=true`
- the operational dashboard exposes `attestor_runtime_profile_info`

## Stop Conditions

Treat any of these as a hard stop condition:

- stop if `ATTESTOR_RUNTIME_PROFILE` is missing or is not `production-shared`
- stop if `/api/v1/health` or `/api/v1/ready` is not reachable for the target
- stop if `/api/v1/ready` returns non-2xx or runtime/rehearsal evidence records `checks.releaseRuntime=false`
- stop if `releaseRuntime.requestPath.contract` is not `async-shared-authority-stores`
- stop if `releaseRuntime.requestPath.usesSharedAuthorityStores=false`
- stop if `sharedAuthorityRuntime.ready=false`
- stop if OTLP telemetry flush fails
- stop if Prometheus or Alertmanager probe fails
- stop if Alertmanager routing lacks a required default, warning, or critical delivery receiver
- stop if the dashboard does not expose runtime/shared-authority truth
- stop if Step 08 backup/restore/DR evidence is missing, failed, or from a different target
- stop if the manifest or runbook contains plaintext secrets instead of redacted/external-secret references

## Evidence To Archive

Archive the generated Step 09 output:

- `.attestor/rehearsal/gke-production-rehearsal/observability-alerting/summary.json`
- `.attestor/rehearsal/gke-production-rehearsal/observability-alerting/README.md`
- `.attestor/rehearsal/gke-production-rehearsal/observability-alerting/observability-receivers/summary.json`
- `.attestor/rehearsal/gke-production-rehearsal/observability-alerting/alert-routing/summary.json`
- the filled production rehearsal manifest
- the Step 05, 06, 07, and 08 summaries consumed by the Step 09 run

## Operator Handoff

If Step 09 passes, do not call production ready yet. The next step is Step 10: package the production-promotion candidate evidence bundle with command outputs, artifact digests, workflow ids, non-claims, and an explicit go/no-go verdict.

If Step 09 fails, keep the failed summary. Do not rerun and overwrite the evidence until the failure has an operator note, a fix reference, and a new rehearsal id.
