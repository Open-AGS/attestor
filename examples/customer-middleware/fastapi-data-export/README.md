# FastAPI Data Export Dependency

Use this shape when a FastAPI path operation is about to start a customer export.

Source anchors:

- FastAPI middleware runs around every request:
  https://fastapi.tiangolo.com/tutorial/middleware/
- FastAPI dependencies let path operations share reusable request-time logic:
  https://fastapi.tiangolo.com/tutorial/dependencies/

For Attestor, prefer a route-level dependency/helper for body-derived action
intent. The action is in the export request body, so the gate should run inside
the path operation or a dependency that receives the parsed request.

```py
@app.post("/exports/customer")
async def export_customer(intent: ExportIntent):
    return await guarded_export(intent, attestor, exporter)
```

Outcomes:

- `admit` -> original export may proceed.
- `narrow` -> only the bounded export scope may proceed.
- `review` -> return a hold response and route to review.
- `block` -> reject before the export job starts.

This example uses synthetic references only. It does not read a warehouse,
export customer records, or prove production no-bypass enforcement.
