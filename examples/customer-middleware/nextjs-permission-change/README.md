# Next.js Permission Change Route Handler

Use this shape when a Next.js Route Handler or Server Action is about to change
access.

Source anchors:

- Route Handlers use the standard Web Request/Response model:
  https://nextjs.org/docs/app/api-reference/file-conventions/route
- Next.js form actions and mutations are documented separately:
  https://nextjs.org/docs/app/guides/forms

```ts
// app/api/access/grant/route.ts
export async function POST(request: Request) {
  const result = await handlePermissionChange(request, deps);
  return Response.json(result.body, { status: result.status });
}
```

Outcomes:

- `admit` -> original role grant may proceed.
- `narrow` -> only the bounded role/scope may proceed.
- `review` -> return a hold response and route to review.
- `block` -> reject before the identity-admin service is called.

The helper also holds observe/warn responses, fail-closed responses, failed
required checks, and decisions that only carry an admission receipt instead of
execution proof.

This example uses synthetic references only. It does not change a real IdP,
prove SSO/RBAC deployment, or prove production no-bypass enforcement.
