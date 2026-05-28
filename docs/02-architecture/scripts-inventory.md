# Scripts Inventory

This is the maintainer map for `scripts/`.

It is a reference document, not a path migration plan. It describes how the
current root-level scripts are grouped, which local gates to run before a PR,
and what each script family is allowed to prove.

Research anchors:

- npm runs package scripts from the package root, so script paths can rely on
  package-root-relative paths:
  https://docs.npmjs.com/cli/v11/using-npm/scripts/#working-directory-for-scripts
- GitHub recommends README navigation that tells readers what the project does,
  why it is useful, how to get started, and where to get help:
  https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes
- Diataxis treats reference docs as concise maps of machinery:
  https://diataxis.fr/reference/

## Current Shape

Root script files: 16.

Check script files under `scripts/check/`: 8.

Probe script files under `scripts/probe/`: 19.

Render script files under `scripts/render/`: 17.

Demo script files under `scripts/demo/`: 8.

Rehearsal script files under `scripts/rehearse/`: 4.

Verification script files under `scripts/verify/`: 4.

The scripts are less flat now, but still intentionally move one family at a
time. The carved-out families are `scripts/check/`, which holds CI and local
evidence guards, `scripts/probe/`, which holds opt-in package-surface, live,
provider, Stripe, HA, observability, and hosted-flow probes, and
`scripts/render/`, which holds local packet, profile, proof, and deployment
bundle renderers, and `scripts/demo/`, which holds local golden path demos and
the shared demo path-boundary helper, and `scripts/rehearse/`, which holds
operator rehearsal scripts, and `scripts/verify/`, which holds PR-contract,
PR-body, and multi-query kit verification helpers. The remaining root-level
script families should move only through small path-migration PRs that update package scripts,
workflows, tests, and docs together.

## Pick One Script Family

| Family | Count | Use it when | Examples |
|---|---:|---|---|
| `scripts/check/check-*` | 8 | You need a local or CI guard over evidence, redaction, findings, baseline alignment, branches, or supply-chain posture. | `check-baseline-alignment.mjs`, `check-supply-chain-baseline.mjs`, `check-public-artifacts-redaction.mjs` |
| `scripts/probe/probe-*` | 19 | You need an opt-in package-surface, live, provider, Stripe, HA, observability, or hosted-flow probe. | `probe-consequence-admission-package-surface.mjs`, `probe-stripe-live-readiness.ts`, `probe-production-hosted-flow.ts` |
| `scripts/render/render-*` | 17 | You need to render local packets, profiles, credentials templates, proof surfaces, or deployment bundles. | `render-proof-surface.ts`, `render-production-readiness-packet.ts`, `render-ha-profile.ts` |
| `scripts/demo/demo-*` | 8 | You need a runnable local golden path or path-boundary demo. | `demo-golden-refund.ts`, `demo-golden-paths.ts`, `demo-path-boundary.ts` |
| `scripts/rehearse/rehearse-*` | 4 | You need a production rehearsal script that simulates an operational path. | `rehearse-production-consequence-behavior.ts`, `rehearse-production-backup-restore-dr.ts` |
| `run-*` | 3 | You need a suite runner or live/ops gate runner. | `run-suite.mjs`, `run-live-ops-gate.mjs` |
| `scripts/verify/{validate,verify}-*` | 4 | You need PR-body, PR-contract, or MQ-kit validation. | `validate-pr-body.mjs`, `validate-pr-contract.mjs`, `verify-mq-cert.ts` |
| `benchmark-*` | 2 | You need local performance or observability benchmark evidence. | `benchmark-observability.ts`, `benchmark-crypto-intelligence-performance.ts` |
| named ops helpers | 11 | You need a named operator helper that does not fit a prefix family. | `control-plane-backup.ts`, `repo-pipeline-readiness.ts`, `bootstrap-stripe-commercial.ts` |

## PR Preflight

Before opening or updating a PR, run the smallest local gate that matches the
change. For docs, navigator, and public-contract changes, the minimum shape is:

```bash
npm run check:pr-body -- <path-to-pr-body.md>
npm run test:package-script-runner
git diff --check
```

Add the targeted doc or contract test for the file you changed. Add
`npm run typecheck` and `npm run typecheck:hygiene` when TypeScript source,
package scripts, or package-surface behavior changes.

The `check:pr-body` gate exists because GitHub PR contract checks include both
the PR contract and the baseline-alignment checkbox rules. If a PR body is not
checked locally, the same mistake can pass local tests and fail in GitHub.

## Move Rule

Do not move scripts just to make the directory look cleaner.

A script move requires a dedicated path-migration PR that updates all of:

- `package.json` scripts
- GitHub workflows
- tests that import or execute the script path
- docs that mention the path
- package-surface probes and suite runners

That PR must run `npm run test:package-script-runner` and the closest targeted
tests for every moved family.

Move one family at a time. Prefer navigation over churn when a move does not
make discovery or verification easier.

## Authority Boundary

Scripts are local, CI, or opt-in operator helpers.

They can prove repository contracts, render local packets, run demos, or check
configured live probes. They do not prove production readiness by name alone.
Production claims still require live proof register evidence, deployment or
operator proof, and current runtime probes.

Keep these distinctions clean:

```text
check script is not production proof
probe script is not customer PEP no-bypass proof
rendered packet is not live deployment evidence
demo script is not hosted enforcement
```

## If You Are Lost

1. Need CI or PR discipline? Start with `scripts/check/check-*`, `validate-*`, and
   `run-suite.mjs`.
2. Need proof or deployment material? Start with `scripts/render/render-*`.
3. Need live or package-surface evidence? Start with `scripts/probe/probe-*`.
4. Need an operator rehearsal? Start with `scripts/rehearse/rehearse-*`.
5. Need to show the product locally? Start with `scripts/demo/demo-*`.
