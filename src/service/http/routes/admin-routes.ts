import type { Hono } from 'hono';
import { registerAdminAccountMutationRoutes } from './admin-account-mutation-routes.js';
import { registerAdminQueueRoutes } from './admin-queue-routes.js';
import { registerAdminReadRoutes } from './admin-read-routes.js';
import { registerAdminReleaseEnforcementRoutes } from './admin-release-enforcement-routes.js';
import type { AdminRouteDeps } from './admin-route-context.js';
import { registerAdminTenantKeyRoutes } from './admin-tenant-key-routes.js';

export { resetAdminRouteAuthLimiterForTests } from './admin-route-context.js';
export type { AdminRouteDeps } from './admin-route-context.js';

export function registerAdminRoutes(app: Hono, deps: AdminRouteDeps): void {
  registerAdminReadRoutes(app, deps);
  registerAdminQueueRoutes(app, deps);
  registerAdminAccountMutationRoutes(app, deps);
  registerAdminTenantKeyRoutes(app, deps);
  registerAdminReleaseEnforcementRoutes(app, deps);
}
