# Attestor Test Navigator

Start with the surface you changed. Use
`docs/02-architecture/test-system-map.md` for the full map and
`docs/02-architecture/test-system-catalog.json` for the machine-readable
catalog.

## Fast Routing

| You changed | Run first |
|---|---|
| Admission decision logic | `npm run test:critical-admission-property-suite` |
| Generic admission route wiring | `npm run test:generic-admission-routes` |
| API/evidence JSON shape | `npm run test:api-evidence-shape-snapshots` |
| Golden path output | `npm run test:golden-output-baseline-diff` |
| Test map/catalog/docs | `npm run test:test-system-map` |

## Live Boundary

Do not run live/operator gates accidentally. These are separate:

```bash
npm run verify:live-local
npm run verify:ops
npm run verify:external-live
```

Those gates need live/operator evidence. They are not implied by `npm run
verify`.
