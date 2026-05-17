---- MODULE AdmissionStateMachine ----
EXTENDS Naturals, FiniteSets

CONSTANTS
  Tenants,
  Requests,
  Digests,
  Nonces,
  NoDigest,
  NoNonce

Stages == {
  "proposed",
  "enveloped",
  "traced",
  "review",
  "blocked",
  "admitted",
  "enforced"
}

Hazards == 0..4

VARIABLES
  requestTenant,
  requestStage,
  authorityOk,
  traceValid,
  traceTenant,
  packetDigest,
  packetNonce,
  consumedNonces,
  reviewRequired,
  reviewed,
  hazard,
  priorHazard,
  enforcementActive

vars == <<
  requestTenant,
  requestStage,
  authorityOk,
  traceValid,
  traceTenant,
  packetDigest,
  packetNonce,
  consumedNonces,
  reviewRequired,
  reviewed,
  hazard,
  priorHazard,
  enforcementActive
>>

TypeOK ==
  /\ Requests # {}
  /\ Tenants # {}
  /\ NoDigest \in Digests
  /\ NoNonce \notin Nonces
  /\ requestTenant \in [Requests -> Tenants]
  /\ requestStage \in [Requests -> Stages]
  /\ authorityOk \in [Requests -> BOOLEAN]
  /\ traceValid \in [Requests -> BOOLEAN]
  /\ traceTenant \in [Requests -> Tenants]
  /\ packetDigest \in [Requests -> Digests]
  /\ packetNonce \in [Requests -> (Nonces \cup {NoNonce})]
  /\ consumedNonces \subseteq Nonces
  /\ reviewRequired \in [Requests -> BOOLEAN]
  /\ reviewed \in [Requests -> BOOLEAN]
  /\ hazard \in [Requests -> Hazards]
  /\ priorHazard \in [Requests -> Hazards]
  /\ enforcementActive \in [Requests -> BOOLEAN]

Init ==
  /\ requestTenant \in [Requests -> Tenants]
  /\ requestStage = [r \in Requests |-> "proposed"]
  /\ authorityOk = [r \in Requests |-> FALSE]
  /\ traceValid = [r \in Requests |-> FALSE]
  /\ traceTenant = requestTenant
  /\ packetDigest = [r \in Requests |-> NoDigest]
  /\ packetNonce = [r \in Requests |-> NoNonce]
  /\ consumedNonces = {}
  /\ reviewRequired = [r \in Requests |-> FALSE]
  /\ reviewed = [r \in Requests |-> FALSE]
  /\ hazard = [r \in Requests |-> 0]
  /\ priorHazard = [r \in Requests |-> 0]
  /\ enforcementActive = [r \in Requests |-> FALSE]

Envelope(r) ==
  /\ r \in Requests
  /\ requestStage[r] = "proposed"
  /\ requestStage' = [requestStage EXCEPT ![r] = "enveloped"]
  /\ UNCHANGED <<
    requestTenant,
    authorityOk,
    traceValid,
    traceTenant,
    packetDigest,
    packetNonce,
    consumedNonces,
    reviewRequired,
    reviewed,
    hazard,
    priorHazard,
    enforcementActive
  >>

RecordTrace(r) ==
  /\ r \in Requests
  /\ requestStage[r] = "enveloped"
  /\ requestStage' = [requestStage EXCEPT ![r] = "traced"]
  /\ traceValid' = [traceValid EXCEPT ![r] = TRUE]
  /\ traceTenant' = [traceTenant EXCEPT ![r] = requestTenant[r]]
  /\ UNCHANGED <<
    requestTenant,
    authorityOk,
    packetDigest,
    packetNonce,
    consumedNonces,
    reviewRequired,
    reviewed,
    hazard,
    priorHazard,
    enforcementActive
  >>

BindAuthority(r) ==
  /\ r \in Requests
  /\ requestStage[r] \in {"enveloped", "traced", "review"}
  /\ authorityOk' = [authorityOk EXCEPT ![r] = TRUE]
  /\ UNCHANGED <<
    requestTenant,
    requestStage,
    traceValid,
    traceTenant,
    packetDigest,
    packetNonce,
    consumedNonces,
    reviewRequired,
    reviewed,
    hazard,
    priorHazard,
    enforcementActive
  >>

IssuePacket(r, d, n) ==
  /\ r \in Requests
  /\ d \in Digests \ {NoDigest}
  /\ n \in Nonces
  /\ requestStage[r] \in {"traced", "review"}
  /\ packetDigest' = [packetDigest EXCEPT ![r] = d]
  /\ packetNonce' = [packetNonce EXCEPT ![r] = n]
  /\ UNCHANGED <<
    requestTenant,
    requestStage,
    authorityOk,
    traceValid,
    traceTenant,
    consumedNonces,
    reviewRequired,
    reviewed,
    hazard,
    priorHazard,
    enforcementActive
  >>

RaiseHazard(r, h) ==
  /\ r \in Requests
  /\ h \in Hazards
  /\ h >= hazard[r]
  /\ priorHazard' = [priorHazard EXCEPT ![r] = hazard[r]]
  /\ hazard' = [hazard EXCEPT ![r] = h]
  /\ reviewRequired' = [reviewRequired EXCEPT ![r] = reviewRequired[r] \/ (h >= 3)]
  /\ UNCHANGED <<
    requestTenant,
    requestStage,
    authorityOk,
    traceValid,
    traceTenant,
    packetDigest,
    packetNonce,
    consumedNonces,
    reviewed,
    enforcementActive
  >>

Review(r) ==
  /\ r \in Requests
  /\ requestStage[r] \in {"traced", "review"}
  /\ requestStage' = [requestStage EXCEPT ![r] = "review"]
  /\ reviewed' = [reviewed EXCEPT ![r] = TRUE]
  /\ UNCHANGED <<
    requestTenant,
    authorityOk,
    traceValid,
    traceTenant,
    packetDigest,
    packetNonce,
    consumedNonces,
    reviewRequired,
    hazard,
    priorHazard,
    enforcementActive
  >>

Admit(r) ==
  /\ r \in Requests
  /\ requestStage[r] \in {"traced", "review"}
  /\ authorityOk[r]
  /\ traceValid[r]
  /\ packetDigest[r] # NoDigest
  /\ packetNonce[r] # NoNonce
  /\ packetNonce[r] \notin consumedNonces
  /\ (reviewRequired[r] => reviewed[r])
  /\ requestStage' = [requestStage EXCEPT ![r] = "admitted"]
  /\ UNCHANGED <<
    requestTenant,
    authorityOk,
    traceValid,
    traceTenant,
    packetDigest,
    packetNonce,
    consumedNonces,
    reviewRequired,
    reviewed,
    hazard,
    priorHazard,
    enforcementActive
  >>

Enforce(r) ==
  /\ r \in Requests
  /\ requestStage[r] = "admitted"
  /\ traceValid[r]
  /\ traceTenant[r] = requestTenant[r]
  /\ packetDigest[r] # NoDigest
  /\ packetNonce[r] # NoNonce
  /\ packetNonce[r] \notin consumedNonces
  /\ requestStage' = [requestStage EXCEPT ![r] = "enforced"]
  /\ enforcementActive' = [enforcementActive EXCEPT ![r] = TRUE]
  /\ consumedNonces' = consumedNonces \cup {packetNonce[r]}
  /\ UNCHANGED <<
    requestTenant,
    authorityOk,
    traceValid,
    traceTenant,
    packetDigest,
    packetNonce,
    reviewRequired,
    reviewed,
    hazard,
    priorHazard
  >>

Block(r) ==
  /\ r \in Requests
  /\ requestStage[r] \notin {"enforced"}
  /\ requestStage' = [requestStage EXCEPT ![r] = "blocked"]
  /\ UNCHANGED <<
    requestTenant,
    authorityOk,
    traceValid,
    traceTenant,
    packetDigest,
    packetNonce,
    consumedNonces,
    reviewRequired,
    reviewed,
    hazard,
    priorHazard,
    enforcementActive
  >>

Next ==
  \E r \in Requests:
    \/ Envelope(r)
    \/ RecordTrace(r)
    \/ BindAuthority(r)
    \/ Review(r)
    \/ Block(r)
    \/ \E d \in Digests \ {NoDigest}: \E n \in Nonces: IssuePacket(r, d, n)
    \/ \E h \in Hazards: RaiseHazard(r, h)
    \/ Admit(r)
    \/ Enforce(r)

NoAdmitWithoutAuthority ==
  \A r \in Requests:
    requestStage[r] \in {"admitted", "enforced"} => authorityOk[r]

NoEnforcementWithoutPacket ==
  \A r \in Requests:
    enforcementActive[r] =>
      /\ requestStage[r] = "enforced"
      /\ packetDigest[r] # NoDigest
      /\ packetNonce[r] # NoNonce

NoCrossTenantLeak ==
  \A r \in Requests:
    traceValid[r] => traceTenant[r] = requestTenant[r]

NoReviewBypass ==
  \A r \in Requests:
    requestStage[r] \in {"admitted", "enforced"} =>
      (reviewRequired[r] => reviewed[r])

MonotoneFusion ==
  \A r \in Requests:
    priorHazard[r] <= hazard[r]

ReplaySafety ==
  \A r1 \in Requests:
    \A r2 \in Requests:
      (r1 # r2 /\ enforcementActive[r1] /\ enforcementActive[r2]) =>
        packetNonce[r1] # packetNonce[r2]

Spec ==
  Init /\ [][Next]_vars

====
