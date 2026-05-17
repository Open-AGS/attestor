module tenantIsolation

sig Tenant {}

abstract sig TenantOwned {
  owner: one Tenant
}

sig Actor extends TenantOwned {}
sig Resource extends TenantOwned {}
sig Reviewer extends TenantOwned {}

sig Envelope extends TenantOwned {
  actor: one Actor,
  resource: one Resource
}

sig Trace extends TenantOwned {
  sourceEnvelope: one Envelope
}

sig Signal extends TenantOwned {
  sourceTrace: one Trace,
  dependsOn: set Signal
}

sig Packet extends TenantOwned {
  envelope: one Envelope,
  trace: one Trace,
  signals: set Signal
}

sig Access extends TenantOwned {
  accessor: one Actor,
  target: one TenantOwned,
  context: one Envelope
}

sig ReviewAssignment extends TenantOwned {
  reviewer: one Reviewer,
  packet: one Packet
}

sig Decision extends TenantOwned {
  packet: one Packet,
  trace: one Trace,
  reviewer: lone Reviewer
}

fact TenantScopedReferences {
  all e: Envelope |
    e.actor.owner = e.owner and
    e.resource.owner = e.owner

  all t: Trace |
    t.sourceEnvelope.owner = t.owner

  all s: Signal |
    s.sourceTrace.owner = s.owner and
    s.dependsOn.owner in s.owner

  all p: Packet |
    p.envelope.owner = p.owner and
    p.trace.owner = p.owner and
    p.signals.owner in p.owner

  all a: Access |
    a.accessor.owner = a.owner and
    a.target.owner = a.owner and
    a.context.owner = a.owner

  all r: ReviewAssignment |
    r.reviewer.owner = r.owner and
    r.packet.owner = r.owner

  all d: Decision |
    d.packet.owner = d.owner and
    d.trace.owner = d.owner and
    d.reviewer.owner in d.owner
}

fact NoSignalCycles {
  no s: Signal | s in s.^dependsOn
}

pred consistentTenantIsolationExample {
  some Tenant
  some Envelope
  some Trace
  some Signal
  some Packet
  some Decision
}

assert EnvelopeTenantBinding {
  all e: Envelope |
    e.actor.owner = e.owner and
    e.resource.owner = e.owner
}

assert TraceTenantBinding {
  all t: Trace |
    t.sourceEnvelope.owner = t.owner
}

assert SignalTenantBinding {
  all s: Signal |
    s.sourceTrace.owner = s.owner and
    s.dependsOn.owner in s.owner
}

assert PacketTenantBinding {
  all p: Packet |
    p.envelope.owner = p.owner and
    p.trace.owner = p.owner and
    p.signals.owner in p.owner
}

assert AccessNonInterference {
  all a: Access |
    a.accessor.owner = a.owner and
    a.target.owner = a.owner and
    a.context.owner = a.owner
}

assert ReviewAssignmentTenantBinding {
  all r: ReviewAssignment |
    r.reviewer.owner = r.owner and
    r.packet.owner = r.owner
}

assert DecisionNonInterference {
  all d: Decision |
    d.packet.owner = d.owner and
    d.trace.owner = d.owner and
    d.reviewer.owner in d.owner
}

run consistentTenantIsolationExample for 6 but exactly 2 Tenant

check EnvelopeTenantBinding for 6 but exactly 3 Tenant
check TraceTenantBinding for 6 but exactly 3 Tenant
check SignalTenantBinding for 6 but exactly 3 Tenant
check PacketTenantBinding for 6 but exactly 3 Tenant
check AccessNonInterference for 6 but exactly 3 Tenant
check ReviewAssignmentTenantBinding for 6 but exactly 3 Tenant
check DecisionNonInterference for 6 but exactly 3 Tenant
