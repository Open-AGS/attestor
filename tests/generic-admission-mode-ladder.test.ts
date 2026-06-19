import { runAuthorityApprovalNoGoTests } from './generic-admission-mode-ladder/authority-approval-no-go-tests.js';
import { runCombinatorialInvariantTests } from './generic-admission-mode-ladder/combinatorial-invariants-tests.js';
import { runCoreModeTests } from './generic-admission-mode-ladder/core-mode-tests.js';
import { runDriftAuthorityScopeTests } from './generic-admission-mode-ladder/drift-authority-scope-tests.js';
import { getPassedCount } from './generic-admission-mode-ladder/helpers.js';
import { runSupplyReviewDelegationTests } from './generic-admission-mode-ladder/supply-review-delegation-tests.js';

runCoreModeTests();
runCombinatorialInvariantTests();
runAuthorityApprovalNoGoTests();
runSupplyReviewDelegationTests();
runDriftAuthorityScopeTests();

console.log(`Generic admission mode ladder tests: ${getPassedCount()} passed, 0 failed`);
