# Signed Assurance Packet

Status: Step 08 repo-side deterministic contract and pure packet builder. This
is not a live signing service, not production readiness, not external
immutability, and not runtime enforcement.

## Decision

The signed assurance packet is the digest-bound artifact emitted after the
human comprehension gate. It binds the consequence envelope, decision source,
tamper-evident history verification, human review posture, policy refs,
evidence refs, signal refs, relationship refs, and replay refs into one
signable packet.

The exported version is:

```text
attestor.signed-assurance-packet.v1
```

The package exports:

```text
SignedAssurancePacket
SignedAssurancePacketSigningPayload
signedAssurancePacketDescriptor()
createSignedAssurancePacketHistoryBinding()
createSignedAssurancePacketSigningPayload()
createSignedAssurancePacket()
```

## Packet Boundary

The packet stores digest-only references:

```text
envelopeRefDigest
decisionSourceDigest
history root / last-entry / verification digests
human comprehension gate result digest
policyRefDigests
evidenceRefDigests
signalRefDigests
relationshipRefDigests
replayRefDigests
```

It does not store raw prompts, raw provider bodies, raw tool payloads, customer
identifiers, tenant identifiers, wallet material, payment details, downstream
response bodies, or private thresholds.

## Signing Boundary

The first implementation accepts an optional signature record over the
canonical signing payload:

```text
unsigned
signed-evaluation
signed-production
```

Only an `external-kms-hsm` signature with `productionReady = true` can be
classified as `signed-production`. Runtime-memory signatures remain
`signed-evaluation`, even if the supplied signature record claims production
readiness.

The packet itself never grants authority:

```text
grantsAuthority = false
canAdmit = false
activatesEnforcement = false
autoEnforce = false
activationReady = false
```

## Invariants

Every packet keeps these invariants:

```text
signatureRequired = true
productionSigningBoundaryRequired = true
tamperEvidentHistoryBound = true
rawPayloadStored = false
externalImmutabilityClaimed = false
complianceClaimed = false
productionReady = false
```

`packetReady` only means the packet is signed and the referenced
tamper-evident history verification evidence says it is verified. A caller
cannot make a packet ready by setting `historyBinding.verified = true` alone:
the builder requires a matching `ConsequenceTamperEvidentHistoryVerification`
object and checks the root digest, last-entry digest, entry count, and
verification digest before accepting the binding. It does not mean the
consequence can execute.

## Primary Source Anchors

- RFC 8785 / JSON Canonicalization Scheme: cryptographic hashes and signatures
  need stable byte representations. Attestor uses its existing strict
  canonical JSON helper for repeatable packet digests.
- RFC 7515 / JSON Web Signature and RFC 8725 / JWT Best Current Practices:
  signed artifacts must bind the payload, algorithm, key identity, and
  verification context explicitly. The packet records the algorithm, signer
  ref, payload digest, signing boundary, and fingerprint.
- in-toto Attestation Statement and DSSE: attestations bind immutable subjects
  by digest to typed predicates/signing payloads. This packet mirrors that
  digest-bound shape without claiming in-toto or DSSE interoperability.
- NIST AI RMF: measurement and audit material should be mapped, measured, and
  managed without converting measurement output into decision authority.

## Non-Claims

This file does not claim:

- production signing readiness
- external transparency log or immutable-store publication
- in-toto, DSSE, JWS, JWT, or NIST conformance
- runtime admission authority
- automatic policy activation
- completed verifier distribution
- that an evaluation signature is acceptable for production enforcement
