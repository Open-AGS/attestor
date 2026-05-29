/**
 * Live Proof v1.1 - Truthful runtime evidence
 */

import { createFinancialTestContext } from './financial/helpers.js';
import { runDifferentialEvidenceFinancialTests } from './financial/differential-evidence-flow.js';
import { runLiveProofFinancialTests } from './financial/live-proof-flow.js';
import { runMultiQueryFinancialTests } from './financial/multi-query-flow.js';
import { runPostgresDemoFinancialTests } from './financial/postgres-demo-flow.js';
import { runReviewerIdentityFinancialTests } from './financial/reviewer-identity-flow.js';
import { runSemanticClauseFinancialTests } from './financial/semantic-clause-flow.js';

export async function runFinancialTests(): Promise<number> {
  const context = createFinancialTestContext();

  console.log('\n==============================================================');
  console.log('  BANK-GRADE - Live Proof v1.1');
  console.log('==============================================================');

  await runLiveProofFinancialTests(context);
  await runSemanticClauseFinancialTests(context);
  await runReviewerIdentityFinancialTests(context);
  await runPostgresDemoFinancialTests(context);
  await runMultiQueryFinancialTests(context);
  await runDifferentialEvidenceFinancialTests(context);

  const passed = context.getPassed();
  console.log(`\n  Financial Tests: ${passed} passed, 0 failed\n`);
  return passed;
}

runFinancialTests().then((passed) => {
  process.exit(passed > 0 ? 0 : 1);
}).catch((err: unknown) => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
