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


async def guarded_export(
    intent: ExportIntent,
    attestor: AttestorClient,
    exporter: ExportService,
) -> dict[str, Any]:
    proposed_payload = build_export_admission_payload(intent)
    decision = await attestor.admit(proposed_payload)

    if decision["outcome"] in {"review", "block"}:
        return {
            "held": True,
            "outcome": decision["outcome"],
            "reasonCodes": decision.get("reasonCodes", []),
            "proofRefs": decision.get("proofRefs", []),
        }

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
