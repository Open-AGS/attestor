# Customer Middleware Proof Gate Boundary Validation - 2026-06-01

## Recent Fixes Chain-Effect Check

- Current source of truth: `origin/master` at
  `eae5ed266630d532aadb52c1182dff1a854e355f`.
- The immediately prior CI artifact, approval, and redaction remediation does
  not overlap this runtime example layer.
- The final chain-reaction intake re-raised the customer execution path as the
  remaining repo-proven customer-facing copy-paste risk.

## Validation Frame

Scope: customer middleware examples for Express refunds, FastAPI data exports,
Next.js permission changes, LangChain wallet tools, the shared TypeScript
admission helper, and the integration docs that describe customer gate
semantics.

Protected principles: fail-closed boundary, customer authority, proof
integrity, data minimization, no overclaim, and auditability.

External anchors:

- OWASP Authorization guidance recommends deny-by-default authorization and
  validating authorization on every request:
  <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>.
- NIST SP 800-162 defines the Policy Enforcement Point as the component that
  enforces decisions and the Policy Decision Point as the component that
  computes decisions:
  <https://csrc.nist.gov/pubs/sp/800/162/upd2/final>.
- Express middleware can end a request-response cycle or pass control to the
  next handler, so the example gate must hold before the downstream handler:
  <https://expressjs.com/en/guide/using-middleware>.
- FastAPI dependencies and middleware are request-time extension points; the
  example uses the dependency/helper shape where parsed body context is
  available:
  <https://fastapi.tiangolo.com/tutorial/dependencies/>.
- Next.js Route Handlers run server-side request handlers for route files:
  <https://nextjs.org/docs/app/getting-started/route-handlers>.
- LangChain tools are callable capabilities an agent can invoke, so wallet-tool
  examples must gate before tool invocation:
  <https://docs.langchain.com/oss/javascript/langchain/tools>.

## Inspected Files

- `examples/customer-middleware/shared/admission.ts`
- `examples/customer-middleware/express-refund/middleware.ts`
- `examples/customer-middleware/nextjs-permission-change/route.ts`
- `examples/customer-middleware/langchain-wallet-tool/tool-wrapper.ts`
- `examples/customer-middleware/fastapi-data-export/middleware.py`
- `examples/customer-middleware/*/README.md`
- `examples/customer-middleware/README.md`
- `docs/01-overview/how-to-integrate-attestor.md`
- `docs/01-overview/customer-admission-gate.md`
- `tests/customer-middleware-examples.test.ts`
- `examples/customer-middleware/fastapi-data-export/test_middleware.py`

## Finding

| Finding | State | Evidence | Remediation |
|---|---|---|---|
| OPS-214 customer middleware copy-paste execution gate | closed repo-side / live-proof-only | The shared TypeScript helper previously returned executable for `admit` or `narrow` alone. It did not model `mode`, `allowed`, `failClosed`, required checks, proof satisfaction, or execution proof kind. Express, Next.js, and LangChain examples used that helper after sending observe-mode intents. | The shared helper now requires enforce/review mode, `allowed === true`, not fail-closed, required checks satisfied, proof satisfied, and at least one non-`admission-receipt` proof ref. `narrow` also requires a returned bounded intent. TypeScript and FastAPI examples now hold observe/warn, missing-proof, receipt-only, failed-check, and fail-closed decisions before downstream calls. |

## Chain Reactions

- Observe or warn effective `admit` no longer calls refund, identity-admin,
  export, or wallet-facing services in the examples.
- A plain admission receipt can still be displayed as evidence that Attestor
  responded, but it cannot satisfy execution proof in these copy-paste gates.
- The examples now match the customer-admission-gate docs: Attestor decides,
  while the customer-owned gate enforces locally before the side effect.

## Verification

- `npm run test:customer-middleware-examples`
- Bundled Python: `python -m unittest test_middleware.py` from
  `examples/customer-middleware/fastapi-data-export`

## Remaining Boundary

Repo-side example hardening is closed for this slice. This does not prove live
customer PEP no-bypass, external KMS/HSM signing, live shared replay or
introspection storage, production deployment, or enterprise readiness.

## Verdict

No repo-proven P0/P1 remains in this scoped customer middleware example slice.
OPS-214 is repo-side closed with targeted regression tests. Enforce-pilot and
production claims still require live customer PEP no-bypass proof.
