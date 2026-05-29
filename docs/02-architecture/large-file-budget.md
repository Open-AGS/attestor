# Large File Budget

This is the Phase 0 guard for the large-file reduction track.

It does not refactor code. It prevents new oversized files from appearing
without an explicit registry entry and keeps the current oversized files from
growing while they wait for focused split work.

## Budget

| Range | Rule |
|---|---|
| `<= 800` lines | Normal target for source, tests, scripts, and examples. |
| `801-1200` lines | Tolerated when a file is still one coherent concept. Review before adding more. |
| `> 1200` lines | Hard-limit exception. Must be listed in the large-file registry. |

Generated files, lockfiles, OpenAPI JSON, and large fixture JSON are outside
this code-file guard. They should not drive source refactor decisions.

## Current Guard

Run:

```bash
npm run test:large-file-budget
```

The guard scans tracked files under:

```text
src/
tests/
scripts/
examples/
```

It checks TypeScript and JavaScript source-like files only.

The check fails when:

- a file grows above `1200` lines without a registry entry;
- a registered oversized file grows beyond its locked `maxLines`;
- a registered oversized file no longer exists and the registry was not cleaned;
- the registry contains duplicates.

The check reports files above `800` lines, but Phase 0 does not fail all of
them. The first job is to stop growth. Later phases shrink the existing list.

## Why This Shape

- ESLint's `max-lines` rule exists to aid maintainability and reduce
  complexity. Its default is `300`, which is useful as a pressure signal but
  too strict for Attestor's current trust-sensitive adapter and route surfaces.
- GitHub and Google engineering guidance both favor small, focused changes
  because they are easier to review, merge, test, and roll back.
- TypeScript module resolution means file moves must preserve runtime import
  resolution, not merely pass a text search.

References:

- <https://eslint.org/docs/latest/rules/max-lines>
- <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/getting-started/helping-others-review-your-changes>
- <https://google.github.io/eng-practices/review/developer/small-cls.html>
- <https://www.typescriptlang.org/docs/handbook/modules/theory.html>

## Split Policy

Default target:

```text
Most files: <= 800 lines
Hard exceptions: <= 1200 lines when genuinely cohesive
Current oversized files: no growth while queued
```

Do not split files just because they are large. Split when one of these is
true:

- the file has multiple ownership domains;
- route handlers for unrelated workflows live together;
- store/repository implementations are mixed;
- public barrels contain implementation logic;
- tests cover several behavior families that can be run independently;
- a script has separate collection, assertion, and rendering phases.

Do not split protocol adapters casually. Crypto and enforcement adapters may
temporarily exceed `800` lines when the file remains one canonical protocol
surface and the split would make review or security reasoning worse.

## Planned Reduction Order

Completed:

- `src/service/api-types.ts` is now a compatibility barrel over the
  responsibility-named `src/service/api-types/*` modules.
- `src/financial/cli.ts` is now a small operator entrypoint over
  responsibility-named `src/financial/cli/*` command modules.
- `scripts/probe/probe-consequence-admission-package-surface.mjs` is now a
  small package-surface probe entrypoint over
  `scripts/probe/consequence-admission-package-surface/*` assertion modules.
- `src/service/control-plane-store.ts` inventory is now documented in
  `docs/02-architecture/control-plane-store-inventory.md`; the next PR may
  split store families behind the existing compatibility facade.

Next:

1. `src/service/control-plane-store.ts` store-family split
2. `src/consequence-admission/index.ts` public surface split
3. `src/service/http/routes/shadow-routes.ts`
4. `src/service/http/routes/account-routes.ts`
5. Remaining route-store hotspots
6. Crypto/protocol adapters only where module-specific risk warrants it

## No-Claims

This guard is repository-side maintainability evidence only.

It does not prove production readiness, live customer enforcement, customer PEP
no-bypass, external KMS signing, shared replay safety, or enterprise readiness.
