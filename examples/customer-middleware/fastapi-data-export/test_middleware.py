from __future__ import annotations

import unittest

from middleware import ExportIntent, guarded_export, run_async


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
                "reasonCodes": ["data-scope-missing"],
                "proofRefs": ["proof:demo-export-review"],
            }
        )
        exporter = FakeExporter()
        result = run_async(guarded_export(self.intent(), attestor, exporter))

        self.assertEqual(result["outcome"], "review")
        self.assertEqual(exporter.calls, [])

    def test_narrow_executes_bounded_export(self):
        attestor = FakeAttestor(
            {
                "outcome": "narrow",
                "reasonCodes": ["record-scope-reduced"],
                "proofRefs": ["proof:demo-export-narrow"],
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
