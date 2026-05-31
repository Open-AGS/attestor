# Production Rehearsal Target Profiles

Target profiles bind the generic production rehearsal manifest to a concrete environment shape. They do not deploy Attestor and they do not prove production readiness by themselves.

The first profile is:

- [gke-production-rehearsal.json](gke-production-rehearsal.json) - a production-like GKE profile using `production-shared`, External Secrets, Gateway API, cert-manager TLS, Grafana Alloy observability, shared PostgreSQL, and shared Redis.

## GKE Production Rehearsal Profile

`gke-production-rehearsal` pins the rehearsal to the existing Attestor render and probe paths instead of introducing a new runtime story:

| Concern | Bound path |
|---|---|
| HA/Kubernetes profile | `npm run render:ha-profile` with `ops/kubernetes/ha/profiles/gke-production.json` |
| DNS/TLS/Gateway | `npm run render:gke-domain-cutover` |
| Observability profile | `npm run render:observability-profile` with `ops/observability/profiles/regulated-production.json` |
| Readiness packet | `npm run render:production-readiness-packet` with `production-shared`, `gke`, `grafana-alloy`, and `external-secret` |
| Runtime probes | `npm run probe:ha-runtime-connectivity`, `npm run probe:ha-release-inputs`, and `npm run probe:observability-receivers` |
| Substrate readiness | `npm run probe:production-rehearsal-substrates` |

The profile requires operator-supplied values for the real region, cluster, hostname, static address, DNS target, issuer, TLS secret, secret store, Workload Identity service account, PostgreSQL URLs, Redis URL, and observability receiver endpoints.

## How To Use It

1. Fill `docs/08-deployment/production-rehearsal-manifest.example.json` for the named target environment.
2. Apply the profile's `manifestPatch` posture: `production-shared`, no local fallback, external-secret references, GKE provider, and `attestor` namespace.
3. Run the planner:

```bash
npm run plan:production-rehearsal -- --manifest path/to/filled-production-rehearsal-manifest.json
```

The planner remains read-only. Step 05 adds the live substrate probe; until `npm run probe:production-rehearsal-substrates` passes for the named target, the profile is only a target binding, not production proof.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.
