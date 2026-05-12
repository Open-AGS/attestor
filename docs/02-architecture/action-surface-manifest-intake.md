# Action Surface Manifest Intake

Action Surface Manifest Intake is the file-text boundary before
[Action Surface Declaration Ingestors](action-surface-declaration-ingestors.md).
It lets onboarding start from the files customers already maintain: OpenAPI,
AsyncAPI, MCP tool manifests, and GitHub Actions-style workflow manifests.

The intake layer parses JSON or YAML text, detects the manifest kind, and routes
the parsed object into the matching declaration ingestor. It does not persist the
raw manifest, call provider APIs, issue credentials, generate policy authority,
or make any execution path non-bypassable.

## Why It Exists

Most real OpenAPI, AsyncAPI, and workflow metadata is stored as `.yaml` or
`.yml`. Requiring customers to pre-convert every file to an object shape before
Attestor can discover action surfaces adds avoidable onboarding work.

This layer removes that first conversion step while preserving the safety
boundary:

```text
JSON/YAML manifest text
  -> parse and digest
  -> detect manifest kind
  -> declaration ingestor
  -> action surface profiler
```

## Supported Formats

- JSON
- YAML

The default manifest size limit is **512 KiB**. Oversized input is rejected
before parsing. The output includes only a content digest and declaration
metadata, not the raw manifest text.

## Supported Manifest Kinds

Auto-detection supports:

- `openapi` when the parsed manifest has an `openapi` field
- `asyncapi` when the parsed manifest has an `asyncapi` field
- `mcp-tools` when the parsed manifest has a top-level `tools` array
- `workflow-manifest` when the parsed manifest has a `jobs` object

Callers can pass an explicit manifest kind when detection is ambiguous, such as
legacy AsyncAPI-style channel documents without the top-level version field.

## Dependency Boundary

YAML parsing uses `js-yaml` as a direct dependency instead of relying on a
transitive package already present in the lockfile. The dependency is scoped to
manifest parsing; raw customer data and provider payloads still must not be
stored or serialized.

## Safety Boundary

Safe automation:

- parse bounded JSON/YAML text
- compute a manifest content digest
- detect manifest kind
- route to the existing declaration ingestors
- return profiler-ready declarations

Still prohibited:

- do not store raw manifest content in the result
- do not expose secret names from workflow files
- do not serialize workflow commands, tool descriptions, or operation
  descriptions
- do not fetch live provider inventories
- do not generate gateway/proxy/adapter configs
- do not claim production readiness or non-bypassability

## Relationship To Onboarding

Manifest intake makes the first customer step smaller:

```text
customer uploads or provides OpenAPI / AsyncAPI / MCP / workflow manifest text
  -> Action Surface Manifest Intake
  -> Action Surface Declaration Ingestors
  -> Action Surface Profiler
  -> Policy Foundry
  -> Integration Mode Readiness
```

This improves onboarding efficiency without changing Attestor's core rule:
metadata can identify likely action surfaces, but only evidence, simulation,
approval, replay/idempotency controls, credential isolation, and downstream
verification can move a workflow toward enforcement.
