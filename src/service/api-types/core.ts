/**
 * Attestor service API core types.
 *
 * This module is re-exported by ../api-types.ts for compatibility.
 */

export interface ServiceHealth {
  status: 'healthy';
  version: string;
  uptime: number;
  domains: string[];
  connectors: string[];
  filingAdapters: string[];
  pki: {
    ready: boolean;
    publicTrustRootRoute: '/api/v1/pki/ca';
  };
  tenantIsolation: {
    requestLevel: boolean;
    databaseRls: {
      schemaAvailable: boolean;
      configured: boolean;
      activated: boolean;
      verified: boolean;
    };
  };
  engine: string;
}
