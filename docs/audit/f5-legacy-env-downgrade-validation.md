# F5 Legacy Env Downgrade Validation

Status: `fixed` for the scoped repository finding.

This note validates the F5-A2 finding from the project-owner supplied signing-layer redo:

```text
F5-A2 legacy flat verify escape via env
```

## Result

The finding was valid. A legacy flat verification path is already deprecated, but allowing it through environment variables makes verifier behavior dependent on ambient process configuration.

Repository behavior now removes the env-var downgrade:

- CLI legacy flat verification is available only through the explicit `--allow-legacy-verify` flag.
- `ATTESTOR_ALLOW_LEGACY` no longer changes CLI verifier behavior.
- `/api/v1/verify` no longer supports `ATTESTOR_ALLOW_LEGACY_API`.
- API verification without PKI material fails closed with `422`.
- Documentation states that no env-var downgrade is supported.

## Repository Evidence

- `src/signing/verify-cli.ts`
- `src/service/http/routes/pipeline-verification-routes.ts`
- `tests/f5-legacy-env-downgrade-validation.test.ts`
- `tests/pipeline-verification-routes.test.ts`
- `docs/06-signing/signing-verification.md`

## Control Boundary

This does not remove the explicit CLI legacy flag. The flag remains for intentionally verifying legacy kits that do not contain PKI material. It is visible at the command line and is not triggered by ambient environment configuration.

Certificate-level `allowLegacyUnbounded` remains a separate F5-NEW-3 compatibility item and is not closed here.

## Sources

- CWE-757, Selection of Less-Secure Algorithm During Negotiation: https://cwe.mitre.org/data/definitions/757.html
- Sigstore security architecture and trust-root model: https://docs.sigstore.dev/about/security/
