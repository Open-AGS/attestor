# Security Testing And Assessment

Status: repository testing posture and external test boundary.

Attestor has extensive automated tests and audit-remediation validation. That is
not the same as an independent penetration test or a customer production test.

Official anchor: [NIST SP 800-115](https://csrc.nist.gov/pubs/sp/800/115/final).

## Repository Test Layers

| Layer | Evidence |
|---|---|
| Type safety | `npm run typecheck`, `npm run typecheck:hygiene`. |
| Unit and contract tests | `npm test` through `scripts/run-suite.mjs`. |
| Architecture checks | `npm run verify:architecture`. |
| Build and package surface | `npm run build`, package-surface probes. |
| Supply-chain checks | `npm run security:supply-chain-baseline`, `npm run security:audit-high`. |
| Audit validation | F1-F12 validation tests, continuous red-team runner, and remediation tracker. |
| Production rehearsal | `tests/production-rehearsal-*.test.ts` and rehearsal scripts. |

## Recommended External Tests

For a production deployment, add:

- annual or release-gated penetration test
- quarterly internal red-team review
- nightly F-series regression and red-team replay
- API authorization and tenant-isolation test
- webhook signature bypass test
- downstream enforcement bypass test
- backup/restore and failover drill
- incident tabletop
- vendor/provider outage drill
- evidence export review with the auditor or security reviewer

## Evidence Handling

Security reports should record scope, date, tested version, tester, findings,
severity, remediation owner, retest result, and residual risk. Do not commit raw
customer payloads, credentials, provider bodies, wallet material, or production
incident data.
