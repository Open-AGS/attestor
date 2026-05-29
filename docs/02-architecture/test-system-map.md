# Attestor Test System Map

This is the short path through the test system. It tells a reviewer where to
look and which gate to run without reading every `test:*` script first.

Attestor test organization follows three rules:

1. Hermetic repo-side tests are separate from live/operator proof gates.
2. Runtime authority boundaries get targeted contract tests before broad
   `verify`.
3. Test files move gradually by owned surface. Do not mass-move the 600+ root test files in one PR.

Machine-readable catalog: `docs/02-architecture/test-system-catalog.json`.

## If You Changed This, Start Here

| Changed surface | First gate | Then |
|---|---|---|
| Generic admission engine | `npm run test:critical-admission-property-suite` | `npm run test:generic-admission-mode-ladder` |
| Generic admission HTTP route | `npm run test:generic-admission-routes` | `npm run test:generic-admission-guard-route-matrix` |
| API or evidence response shape | `npm run test:api-evidence-shape-snapshots` | nearest route/engine test |
| Golden path reviewer output | `npm run test:golden-output-baseline-diff` | `npm run demo:golden-paths -- --json` |
| Shadow or Policy Foundry logic | `npm run test:shadow-runtime-pipeline` | nearest policy-foundry or dashboard test |
| Release kernel or policy control | nearest `test:release-*` script | package-surface probe |
| Crypto pack | nearest `test:crypto-*` script | negative conformance fixtures |
| Service route/store/billing/webhook | nearest `test:service-*` script | `npm run typecheck` |
| Docs, audit, or claim boundary | nearest docs/audit test | `npm run test:test-system-map` |
| Live or ops proof | `npm run verify:live-local` / `verify:ops` / `verify:external-live` | operator proof capture |

## Tier Model

| Tier | Name | Meaning |
|---|---|---|
| T0 | docs-and-meta | Documentation, catalog, script, and evidence-index locks. |
| T1 | unit-and-contract | Hermetic module and package-surface tests. |
| T2 | route-and-local-integration | Local HTTP route, store, replay, and service integration tests. |
| T3 | snapshot-and-golden | Stable API/evidence shape and golden output baselines. |
| T4 | property-and-fuzz | Generated or table-driven invariants for critical decision logic. |
| T5 | live-and-ops | Opt-in live, operator, cloud, provider, and deployment proof gates. |

## New Gate Family

These gates are repo-side only:

- `npm run test:test-system-map`
- `npm run test:api-evidence-shape-snapshots`
- `npm run test:golden-output-baseline-diff`
- `npm run test:critical-admission-property-suite`

They do not prove live customer PEP no-bypass, external KMS runtime signing, or
production readiness.

## Rehome Rule

The target shape is:

```text
tests/admission/
tests/shadow/
tests/release/
tests/crypto/
tests/finance/
tests/service/
tests/docs-audit/
tests/live/
```

This is a gradual map, not a mass move. A test family moves when its owned
surface is already being edited and the package script can be updated in the
same PR. Until then, the catalog is the navigation layer.

## Full Verify Boundary

`npm run verify` is the broad repo-side gate. It is appropriate after a broad
test-system change or before a release-style audit handoff.

It is not a production proof. Live claims still require the live proof register
and the opt-in live/operator gates.
