# Account Routes Inventory

Status: F-01 parity lock for the final large-file refactor wave.

This document records the account route surface before `account-routes.ts`
is split into smaller route-family modules. It is repository-side
maintainability evidence only; it does not add a route, remove a route, or
change runtime behavior.

## Boundary

`src/service/http/routes/account-routes.ts` currently owns 51 hosted account
routes. The split target is a small `registerAccountRoutes` facade plus
responsibility-named route modules for public auth, federated auth, MFA/passkey,
account-admin users/API keys, and account billing/visibility.

The route split must preserve:

- method and path;
- status-code and response-shape behavior;
- JSON content-type rejection through `readAccountJsonBody()`;
- account-session authority from `requireAccountSession()`;
- account mutation idempotency through `beginAccountMutationIdempotency()`;
- account-session mutation audit through `recordAccountSessionMutationAudit()`;
- auth-abuse rate limits before expensive auth, SSO, password, and reset work;
- response material boundaries, including one-time clear-text API key material;
- `Cache-Control: no-store` where the route currently sets it.

## Route Inventory

| Method | Path | Family | Authority boundary |
|---|---|---|---|
| `POST` | `/api/v1/account/users/bootstrap` | bootstrap | hosted account context |
| `POST` | `/api/v1/auth/signup` | public auth | anonymous + auth-abuse rate limit |
| `POST` | `/api/v1/auth/login` | public auth | anonymous + auth-abuse rate limit |
| `POST` | `/api/v1/auth/passkeys/options` | public passkey auth | anonymous + auth-abuse rate limit |
| `POST` | `/api/v1/auth/passkeys/verify` | public passkey auth | passkey challenge token |
| `GET` | `/api/v1/auth/saml/metadata` | federated auth | public metadata |
| `POST` | `/api/v1/auth/saml/login` | federated auth | anonymous + auth-abuse rate limit |
| `POST` | `/api/v1/auth/saml/acs` | federated auth | SAML callback + federated callback rate limit |
| `POST` | `/api/v1/auth/oidc/login` | federated auth | anonymous + auth-abuse rate limit |
| `GET` | `/api/v1/auth/oidc/callback` | federated auth | OIDC callback + federated callback rate limit |
| `POST` | `/api/v1/auth/mfa/verify` | MFA login | MFA challenge token |
| `POST` | `/api/v1/auth/logout` | session auth | account session |
| `POST` | `/api/v1/auth/password/change` | session auth | account session + current-password rate limit |
| `GET` | `/api/v1/auth/me` | session auth | account session |
| `GET` | `/api/v1/account/mfa` | account profile | account session |
| `GET` | `/api/v1/account/oidc` | account profile | account session |
| `GET` | `/api/v1/account/saml` | account profile | account session |
| `GET` | `/api/v1/account/passkeys` | account profile | account session |
| `POST` | `/api/v1/account/passkeys/register/options` | passkey management | account session + current-password rate limit |
| `POST` | `/api/v1/account/passkeys/register/verify` | passkey management | account session + challenge token |
| `POST` | `/api/v1/account/passkeys/:id/delete` | passkey management | account session + current-password rate limit |
| `POST` | `/api/v1/account/mfa/totp/enroll` | MFA management | account session + current-password rate limit |
| `POST` | `/api/v1/account/mfa/totp/confirm` | MFA management | account session |
| `POST` | `/api/v1/account/mfa/disable` | MFA management | account session + current-password rate limit |
| `GET` | `/api/v1/account/usage` | account visibility | tenant context |
| `GET` | `/api/v1/account` | account visibility | hosted account context |
| `GET` | `/api/v1/account/entitlement` | account visibility | hosted account context |
| `GET` | `/api/v1/account/features` | account visibility | hosted account context |
| `GET` | `/api/v1/account/api-keys` | API key admin | account admin session |
| `POST` | `/api/v1/account/api-keys` | API key admin | account admin session + mutation idempotency + audit |
| `POST` | `/api/v1/account/api-keys/:id/rotate` | API key admin | account admin session + mutation idempotency + audit |
| `POST` | `/api/v1/account/api-keys/:id/deactivate` | API key admin | account admin session + mutation idempotency + audit |
| `POST` | `/api/v1/account/api-keys/:id/reactivate` | API key admin | account admin session + mutation idempotency + audit |
| `POST` | `/api/v1/account/api-keys/:id/revoke` | API key admin | account admin session + mutation idempotency + audit |
| `GET` | `/api/v1/account/users` | user admin | account admin session |
| `POST` | `/api/v1/account/users` | user admin | account admin session + mutation idempotency + audit |
| `GET` | `/api/v1/account/users/invites` | invite admin | account admin session |
| `POST` | `/api/v1/account/users/invites` | invite admin | account admin session + mutation idempotency + audit |
| `POST` | `/api/v1/account/users/invites/:id/revoke` | invite admin | account admin session + mutation idempotency + audit |
| `POST` | `/api/v1/account/users/invites/accept` | invite acceptance | invite token + auth-abuse rate limit |
| `POST` | `/api/v1/account/users/:id/deactivate` | user admin | account admin session + mutation idempotency + audit |
| `POST` | `/api/v1/account/users/:id/reactivate` | user admin | account admin session + mutation idempotency + audit |
| `POST` | `/api/v1/account/users/:id/password-reset` | password reset admin | account admin session + mutation idempotency + rate limit + audit |
| `POST` | `/api/v1/auth/password/reset` | public password reset | reset token + auth-abuse rate limit |
| `GET` | `/api/v1/account/email/deliveries` | account email delivery | account admin or billing admin session |
| `POST` | `/api/v1/account/billing/checkout` | retired account billing compatibility | account admin or billing admin session + audit + workflow checkout replacement |
| `GET` | `/api/v1/account/billing/workflows` | workflow billing | account admin, billing admin, or read-only session |
| `POST` | `/api/v1/account/billing/workflows/checkout` | workflow billing | account admin or billing admin session + Stripe idempotency key + audit |
| `POST` | `/api/v1/account/billing/portal` | account billing | account admin or billing admin session + audit |
| `GET` | `/api/v1/account/billing/export` | account billing | hosted account context; CSV response sets `Cache-Control: no-store` |
| `GET` | `/api/v1/account/billing/reconciliation` | account billing | account admin, billing admin, or read-only session |

## Split Map

| Planned module | Route families |
|---|---|
| `account-public-auth-routes.ts` | bootstrap, signup, login, logout, password change/reset, `/auth/me` |
| `account-federated-auth-routes.ts` | SAML metadata/login/ACS, OIDC login/callback |
| `account-mfa-passkey-routes.ts` | MFA login/management, passkey login/management |
| `account-admin-user-routes.ts` | API key admin, user admin, invite admin, password-reset issue |
| `account-billing-routes.ts` | account summary, usage, features, email deliveries, billing checkout, workflow billing checkout/listing, portal/export/reconciliation |
| `account-route-context.ts` | shared idempotency, audit, session, and route response helpers that remain route-owned |

## Tests

The route split must keep these checks green or replace them with narrower
equivalent checks in the same PR:

- `npm run test:account-routes-inventory`
- `npm run test:account-route-helper-split`
- `npm run test:service-account-routes-authorization`
- `npm run test:service-account-auth-service`
- `npm run test:service-account-api-key-service`
- `npm run test:service-account-user-management-service`
- `npm run test:service-account-cors-csrf-boundary`
- `npm run test:hosted-api-authorization-matrix`
- `npm run test:large-file-budget`

## No-Claims

This inventory is a route parity lock only.

It does not prove live account mutation idempotency across replicas, live
federated callback source-IP behavior, deployed account mutation audit-chain
integrity, customer PEP no-bypass, production readiness, or enterprise
readiness.
