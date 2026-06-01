from __future__ import annotations

import unittest

from middleware import ExportIntent, guarded_export, run_async


def execution_proof(proof_id):
    return {
        "kind": "release-token",
        "id": proof_id,
        "digest": "sha256:" + "b" * 64,
        "uri": None,
        "verifyHint": "Verify at the customer-owned enforcement point.",
    }


def admission_receipt(receipt_id):
    return {
        "kind": "admission-receipt",
        "id": receipt_id,
        "digest": "sha256:" + "c" * 64,
        "uri": None,
        "verifyHint": "Receipt only; not execution proof.",
    }


class FakeAttestor:
    def __init__(self, decision):
        self.decision = decision
        self.seen_intent = None

    async def admit(self, intent):
        self.seen_intent = intent
        return self.decision


class FakeExporter:
    def __init__(self):
        self.calls = []

    async def export(self, request):
        self.calls.append(request)
        return {"exportRef": "export:demo", "request": request}


class FastApiDataExportMiddlewareTest(unittest.TestCase):
    def test_review_holds_before_export_service(self):
        attestor = FakeAttestor(
            {
                "outcome": "review",
                "mode": "enforce",
                "allowed": False,
                "failClosed": False,
                "requiredChecksSatisfied": True,
                "proofSatisfied": True,
                "reasonCodes": ["data-scope-missing"],
                "proofRefs": [execution_proof("proof:demo-export-review")],
            }
        )
        exporter = FakeExporter()
        result = run_async(guarded_export(self.intent(), attestor, exporter))

        self.assertEqual(result["outcome"], "review")
        self.assertEqual(exporter.calls, [])

    def test_observe_admit_holds_before_export_service(self):
        attestor = FakeAttestor(
            {
                "outcome": "admit",
                "mode": "observe",
                "allowed": True,
                "failClosed": False,
                "requiredChecksSatisfied": True,
                "proofSatisfied": True,
                "reasonCodes": ["observe-effective-admit"],
                "proofRefs": [execution_proof("proof:demo-export-observe")],
            }
        )
        exporter = FakeExporter()
        result = run_async(guarded_export(self.intent(), attestor, exporter))

        self.assertEqual(result["held"], True)
        self.assertEqual(result["mode"], "observe")
        self.assertEqual(exporter.calls, [])

    def test_receipt_only_admit_holds_before_export_service(self):
        attestor = FakeAttestor(
            {
                "outcome": "admit",
                "mode": "enforce",
                "allowed": True,
                "failClosed": False,
                "requiredChecksSatisfied": True,
                "proofSatisfied": True,
                "reasonCodes": ["receipt-only"],
                "proofRefs": [admission_receipt("receipt:demo-export")],
            }
        )
        exporter = FakeExporter()
        result = run_async(guarded_export(self.intent(), attestor, exporter))

        self.assertEqual(result["held"], True)
        self.assertEqual(exporter.calls, [])

    def test_narrow_executes_bounded_export(self):
        attestor = FakeAttestor(
            {
                "outcome": "narrow",
                "mode": "enforce",
                "allowed": True,
                "failClosed": False,
                "requiredChecksSatisfied": True,
                "proofSatisfied": True,
                "reasonCodes": ["record-scope-reduced"],
                "proofRefs": [execution_proof("proof:demo-export-narrow")],
                "narrowedIntent": {
                    "dataScope": {
                        "records": 100,
                        "fields": ["account_summary"],
                    }
                },
            }
        )
        exporter = FakeExporter()
        result = run_async(guarded_export(self.intent(), attestor, exporter))

        self.assertEqual(result["request"]["maxRecords"], 100)
        self.assertEqual(result["request"]["fields"], ["account_summary"])

    @staticmethod
    def intent():
        return ExportIntent(
            actor="analytics-ai-agent",
            segment_ref="segment:demo-customers",
            report_ref="report:demo-renewal",
            requested_records=5000,
            evidence_refs=("ticket:demo-export", "approval:demo-export"),
        )


if __name__ == "__main__":
    unittest.main()
