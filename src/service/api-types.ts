/**
 * Attestor API service contract compatibility barrel.
 *
 * Request, response, and route types live in ./api-types/* so each family stays
 * navigable. Existing imports from ./api-types.js remain supported here.
 */

export type * from './api-types/shared.js';
export type * from './api-types/core.js';
export type * from './api-types/pipeline.js';
export type * from './api-types/account.js';
export type * from './api-types/billing.js';
export type * from './api-types/admin.js';
export { API_ROUTES } from './api-types/routes.js';
