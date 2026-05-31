/**
 * Shadow persistence stores - evaluation file-backed first slice.
 *
 * BOUNDARY:
 * - Local file-backed stores for evaluation/self-hosted development
 * - Tenant-scoped logical records with atomic writes and file locks
 * - Stores data-minimized shadow events and approval-required policy candidates
 * - Not a production shared database, SIEM, policy authoring UI, or immutable ledger
 */

import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  defaultShadowAdmissionEventStorePath,
  defaultShadowCustomerActivationHandoffStorePath,
  defaultShadowCustomerActivationReceiptStorePath,
  defaultShadowPolicyCandidateStorePath,
  defaultShadowPolicySimulationReportStorePath,
} from './shadow-persistence-helpers.js';

export { createFileBackedShadowAdmissionEventStore } from './shadow-admission-event-store.js';
export { createFileBackedShadowCustomerActivationHandoffStore } from './shadow-customer-activation-handoff-store.js';
export { createFileBackedShadowCustomerActivationReceiptStore } from './shadow-customer-activation-receipt-store.js';
export { createFileBackedShadowPolicyCandidateStore } from './shadow-policy-candidate-store.js';
export { createFileBackedShadowPolicySimulationReportStore } from './shadow-policy-simulation-report-store.js';
export * from './shadow-persistence-types.js';

export function resetShadowPersistenceStoresForTests(options?: {
  readonly admissionEventPath?: string | null;
  readonly policyCandidatePath?: string | null;
  readonly policySimulationReportPath?: string | null;
  readonly customerActivationHandoffPath?: string | null;
  readonly customerActivationReceiptPath?: string | null;
}): void {
  const admissionPath = resolve(options?.admissionEventPath ?? defaultShadowAdmissionEventStorePath());
  const candidatePath = resolve(options?.policyCandidatePath ?? defaultShadowPolicyCandidateStorePath());
  const simulationPath = resolve(options?.policySimulationReportPath ?? defaultShadowPolicySimulationReportStorePath());
  const activationHandoffPath = resolve(options?.customerActivationHandoffPath ?? defaultShadowCustomerActivationHandoffStorePath());
  const activationReceiptPath = resolve(options?.customerActivationReceiptPath ?? defaultShadowCustomerActivationReceiptStorePath());
  for (const path of [admissionPath, candidatePath, simulationPath, activationHandoffPath, activationReceiptPath]) {
    if (existsSync(path)) rmSync(path, { force: true });
    if (existsSync(`${path}.lock`)) rmSync(`${path}.lock`, { recursive: true, force: true });
  }
}
