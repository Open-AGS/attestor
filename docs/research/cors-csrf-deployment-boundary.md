# CORS / CSRF Deployment Boundary Research Anchors

This note records the source anchors for Attestor's hosted account-session
browser boundary. It is an engineering anchor, not a claim that any customer
browser deployment, proxy, CDN, or WAF has been live-proven.

## Sources

| Source | Anchor used | Attestor mapping | Limitation |
|---|---|---|---|
| [OWASP Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Custom headers are a practical AJAX/API CSRF defense when CORS is correctly restricted; SameSite is defense-in-depth, not the only boundary. | Cookie-authenticated unsafe account mutations require `x-attestor-csrf`, while CORS must stay exact-origin. | Header presence is not a synchronizer-token or double-submit-token implementation. |
| [MDN CORS guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) | Credentialed CORS must not rely on wildcard `Access-Control-Allow-Origin`; cross-origin custom headers require browser preflight. | `ATTESTOR_ACCOUNT_SESSION_ALLOWED_ORIGINS` is exact-origin only and wildcard-like entries fail closed. | Repository tests do not prove deployed CORS response headers or browser behavior. |
| [MDN Fetch Metadata request headers](https://developer.mozilla.org/en-US/docs/Glossary/Fetch_metadata_request_header) | `Sec-Fetch-Site` exposes whether a request is same-origin, same-site, cross-site, or user-originated. | `Sec-Fetch-Site: cross-site` fails closed for cookie-authenticated account mutations. | Not every client sends Fetch Metadata headers; the guard is additive, not the only control. |
| [web.dev Fetch Metadata guidance](https://web.dev/articles/fetch-metadata) | Fetch Metadata can be used as defense-in-depth against cross-site request abuse by rejecting cross-site unsafe requests. | The account-session guard rejects explicit cross-site browser evidence before mutation handlers run. | This is not a complete browser security posture or WAF proof. |
| [Hono CSRF](https://hono.dev/docs/middleware/builtin/csrf) and [CORS](https://hono.dev/docs/middleware/builtin/cors) middleware docs | Hono exposes built-in middleware for origin and CORS handling; middleware must be scoped carefully. | Attestor keeps a route-aware guard because only cookie account-session mutations are in the CSRF surface; header/API-key traffic is not treated as cookie CSRF. | Attestor does not install broad Hono CORS middleware by default. |

## Repo-Side Contract

- Cookie-authenticated unsafe account mutations require `x-attestor-csrf`.
- Explicit cross-site browser evidence fails closed.
- Origin checks allow the request origin, `ATTESTOR_PUBLIC_BASE_URL`,
  `ATTESTOR_PUBLIC_HOSTNAME` as an HTTPS origin, or exact entries in
  `ATTESTOR_ACCOUNT_SESSION_ALLOWED_ORIGINS`.
- Wildcard, regex-like, path-bearing, query-bearing, or fragment-bearing
  allowed-origin entries are invalid and fail closed.

## No-Claims

- This does not prove production CORS correctness.
- This does not prove any live browser application, CDN, proxy, WAF, or
  customer deployment.
- This does not replace account-session authorization, role checks, or a
  future session-bound CSRF token if Attestor ships a richer browser UI that
  needs one.
