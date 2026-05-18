# Decision Lineage Graph

Status: implemented I11 contract slice. This is a digest-only, read-only
lineage graph for assurance-case nodes, defeaters, transitions, supporting
artifacts, and signature references. It is not a live enforcement component.

Version: `attestor.decision-lineage-graph.v1`

## Decision

`attestor.decision-lineage-graph.v1` turns an I00 assurance case into a
deterministic directed acyclic graph:

```text
AssuranceCaseContract
  + artifact refs
  + signature refs
  -> Decision Lineage Graph
```

The graph answers one narrow question:

```text
which digest-addressed artifact, signature reference, node, defeater, and
transition contributed to this decision claim lineage?
```

It does not decide whether the claim is safe, close a defeater, generate a
signature, write the audit plane, publish OpenLineage events, activate policy,
admit, or enforce.

## Files

```text
src/consequence-admission/decision-lineage-graph.ts
tests/decision-lineage-graph.test.ts
docs/02-architecture/decision-lineage-graph.md
```

Package script:

```bash
npm run test:decision-lineage-graph
```

## Source Anchors

The contract is shaped by these primary sources:

| Anchor | Imported rule |
|---|---|
| W3C PROV-DM / PROV-O | Provenance has entities, activities, agents, and responsibility links. I11 maps this to case artifacts, transitions, and builders. |
| OpenLineage | Lineage records should separate run/job/dataset-style inputs and outputs from extensible facets. I11 keeps artifact refs and graph nodes separate. |
| in-toto Statement | Signed material should bind a statement to immutable subjects by digest and a predicate type. I11 records signed subject digests only. |
| DSSE | Signature envelopes bind payload, payload type, and signature material. I11 stores signature-envelope references without creating signatures. |
| W3C Trace Context | Correlation identifiers must not carry sensitive data. I11 is digest-only and does not carry raw evidence. |
| OMG SACM | Assurance cases bind argument and artifact packages. I11 links I00 assurance-case material to artifact references without claiming SACM conformance. |

## Contract Shape

The graph contains four core object groups:

| Object | Meaning |
|---|---|
| `DecisionLineageGraphNode` | Case, assurance node, defeater, transition, artifact, or signature-reference node. |
| `DecisionLineageGraphEdge` | Relationship such as `contains`, `attacks`, `supports`, `derived-from`, or `signature-covers`. |
| `DecisionLineageArtifactRef` | Digest-only reference to a supporting artifact such as runtime-monitor, TLA-trace, calibration, or promotion-gate output. |
| `DecisionLineageSignatureRef` | Digest-only reference to an external/internal signature envelope over a subject digest. |

All graph nodes carry:

```text
sourceId
sourceDigest
sourceVersion
tenantRefDigest
scopeDigest
signedSubject
```

The graph record also reports:

```text
requiredSubjectDigests
signedSubjectDigests
missingSignatureCoverageDigests
openDefeaterCount
findings
reasonCodes
```

## Outcomes

| Outcome | Meaning |
|---|---|
| `decision-lineage-graph-ready` | The graph was built, structural references are bound, and no required signature coverage is missing. |
| `decision-lineage-held-for-case-binding` | A structural reference is dangling, such as a missing artifact target or unmatched signature subject. |
| `decision-lineage-held-for-signature-coverage` | `requireSignatureCoverage` is true and at least one required subject digest has no signature reference. |
| `decision-lineage-rejected-boundary` | The caller requested raw payload/evidence, signature creation, audit write, external export, policy activation, live enforcement, or authority action. |

Open defeat is not a graph-build failure. I11 keeps open defeaters visible in
`openDefeaterCount`, graph nodes, attack edges, and reason codes. Promotion
eligibility remains I08's job.

## Invariants

- Pure deterministic builder: no network, database, clock, random, or file I/O.
- Digest-only: no raw payload and no raw evidence are accepted or emitted.
- Tenant-bound: every graph node inherits the assurance-case tenant digest.
- Scope-bound: assurance nodes keep their own scope digest; non-scope artifacts
  inherit the root claim scope.
- Signature-reference only: signature refs are tracked by digest; the graph
  never signs or verifies payload bytes.
- No external export: OpenLineage and PROV are source anchors, not output
  formats.
- Read-only: no audit-plane write, no policy write, no policy activation.
- No authority: the graph cannot admit, enforce, or close defeat.

## Non-Claims

The descriptor exposes these non-claims:

```text
not-openlineage-export
not-prov-or-sacm-conformance
not-dsse-or-in-toto-signer
not-transparency-log
not-audit-plane-writer
not-policy-activation
not-live-enforcement
not-production-readiness
```

## Role In The Tracker

I11 adds signed node and transition lineage as an internal Attestor view. It
does not add a separate product or a second governance system. The graph is the
bridge between:

```text
I00 assurance case material
I09 formal trace evidence
I10 runtime monitor evidence
future I12/I13 authority-creep and outcome feedback material
```

The next slice, I12, should use this graph to detect measurement-as-authority
and other authority-creep paths. I12 should not mutate the graph in place; it
should add undercutting defeat material through the same assurance-case fabric.
