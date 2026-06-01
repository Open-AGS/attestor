from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class ExportIntent:
    actor: str
    segment_ref: str
    report_ref: str
    requested_records: int
    evidence_refs: tuple[str, ...]


class AttestorClient(Protocol):
    async def admit(self, intent: dict[str, Any]) -> dict[str, Any]:
        ...


class ExportService(Protocol):
    async def export(self, request: dict[str, Any]) -> dict[str, Any]:
        ...


def build_export_admission_payload(intent: ExportIntent) -> dict[str, Any]:
    return {
        "mode": "observe",
        "actor": intent.actor,
        "action": "customer_export",
        "domain": "data-disclosure",
        "downstreamSystem": "customer-export-service",
        "policyRef": "policy:data-export:v1",
        "dataScope": {
            "records": intent.requested_records,
            "classification": "customer-report",
            "fields": ["account_summary", "usage_band", "renewal_month"],
        },
        "evidenceRefs": list(intent.evidence_refs),
        "nativeInputRefs": [intent.segment_ref, intent.report_ref],
        "summary": "AI requested a controlled customer export before export execution.",
    }


def _execution_proof_refs(decision: dict[str, Any]) -> list[dict[str, Any]]:
    proof_refs = decision.get("proofRefs", [])
    return [
        proof_ref
        for proof_ref in proof_refs
        if isinstance(proof_ref, dict) and proof_ref.get("kind") != "admission-receipt"
    ]


def _decision_can_execute(decision: dict[str, Any]) -> bool:
    if decision.get("outcome") not in {"admit", "narrow"}:
        return False
    if decision.get("mode") in {"observe", "warn"}:
        return False
    if decision.get("allowed") is not True:
        return False
    if decision.get("failClosed") is True:
        return False
    if decision.get("requiredChecksSatisfied") is not True:
        return False
    if decision.get("proofSatisfied") is not True:
        return False
    if not _execution_proof_refs(decision):
        return False
    if decision.get("outcome") == "narrow" and "narrowedIntent" not in decision:
        return False
    return True


def _held_response(decision: dict[str, Any]) -> dict[str, Any]:
    return {
        "held": True,
        "outcome": decision.get("outcome", "review"),
        "mode": decision.get("mode", "observe"),
        "reasonCodes": decision.get("reasonCodes", []),
        "proofRefs": decision.get("proofRefs", []),
    }


async def guarded_export(
    intent: ExportIntent,
    attestor: AttestorClient,
    exporter: ExportService,
) -> dict[str, Any]:
    proposed_payload = build_export_admission_payload(intent)
    decision = await attestor.admit(proposed_payload)

    if not _decision_can_execute(decision):
        return _held_response(decision)

    bounded_payload = decision.get("narrowedIntent") or proposed_payload
    bounded_scope = bounded_payload.get("dataScope", {})

    return await exporter.export(
        {
            "segmentRef": intent.segment_ref,
            "reportRef": intent.report_ref,
            "maxRecords": bounded_scope.get("records", intent.requested_records),
            "fields": bounded_scope.get("fields", []),
        }
    )


def run_async(coro: Any) -> Any:
    return asyncio.run(coro)
