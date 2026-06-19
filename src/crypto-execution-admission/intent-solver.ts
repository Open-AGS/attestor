/**
 * Intent-solver admission handoff public surface.
 *
 * Implementation details are split by contract, normalization, expectation
 * evaluation, handoff construction, and descriptor exports while preserving the
 * public import path used by planner and tests.
 */
export * from './intent-solver-types.js';
export { createIntentSolverAdmissionHandoff } from './intent-solver-core.js';
export {
  intentSolverAdmissionDescriptor,
  intentSolverAdmissionHandoffLabel,
} from './intent-solver-descriptor.js';
