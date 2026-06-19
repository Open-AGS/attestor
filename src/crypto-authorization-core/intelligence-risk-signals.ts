/**
 * Crypto intelligence risk signal public surface.
 *
 * The implementation is split by contract, common signal helpers, risk-finding
 * translation, context-derived signals, assessment construction, and descriptor
 * exports while preserving the original import path.
 */
export * from './intelligence-risk-signals-types.js';
export { createCryptoIntelligenceRiskSignalAssessment } from './intelligence-risk-signals-core.js';
export {
  cryptoIntelligenceRiskSignalLabel,
  cryptoIntelligenceRiskSignalsDescriptor,
} from './intelligence-risk-signals-descriptor.js';
