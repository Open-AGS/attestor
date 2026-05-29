import { strict as assert } from 'node:assert';

export interface FinancialTestContext {
  ok(condition: boolean, msg: string): void;
}

export interface FinancialTestRunnerContext extends FinancialTestContext {
  getPassed(): number;
}

export function createFinancialTestContext(): FinancialTestRunnerContext {
  let passed = 0;

  return {
    ok(condition: boolean, msg: string): void {
      assert(condition, msg);
      passed += 1;
    },
    getPassed(): number {
      return passed;
    },
  };
}
