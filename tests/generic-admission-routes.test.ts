import { runFailClosedRetryTests } from './generic-admission-routes/fail-closed-retry-tests.js';
import { runGuardRouteTests } from './generic-admission-routes/guard-route-tests.js';
import { getPassedCount } from './generic-admission-routes/helpers.js';
import { runIdempotencyRouteTests } from './generic-admission-routes/idempotency-tests.js';
import { runPlanEnvelopeTests } from './generic-admission-routes/plan-envelope-tests.js';
import { runProtectedTokenTests } from './generic-admission-routes/protected-token-tests.js';
import { runRequestableDenialRouteTests } from './generic-admission-routes/requestable-denial-tests.js';
import { runWorkflowEntitlementRouteTests } from './generic-admission-routes/workflow-entitlement-tests.js';

await runPlanEnvelopeTests();
await runGuardRouteTests();
await runFailClosedRetryTests();
await runProtectedTokenTests();
await runRequestableDenialRouteTests();
await runIdempotencyRouteTests();
await runWorkflowEntitlementRouteTests();

console.log(`Generic admission route tests: ${getPassedCount()} passed, 0 failed`);
