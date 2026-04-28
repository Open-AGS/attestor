import assert from 'node:assert/strict';
import { analyzePlan } from '../src/connectors/predictive-guardrails.js';
import { runPostgresProve } from '../src/connectors/postgres-prove.js';
import { snowflakeConnector } from '../src/connectors/snowflake-connector.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function testMissingExplainPlanFailsClosed(): void {
  const result = analyzePlan(null);

  equal(result.performed, false, 'Predictive guardrail: missing EXPLAIN plan is not treated as performed');
  equal(result.riskLevel, 'critical', 'Predictive guardrail: missing EXPLAIN plan is critical');
  equal(result.recommendation, 'deny', 'Predictive guardrail: missing EXPLAIN plan denies execution');
  equal(result.signals[0]?.signal, 'explain_plan_missing', 'Predictive guardrail: missing plan reason is explicit');
}

function testMalformedExplainPlanFailsClosed(): void {
  const result = analyzePlan([
    {
      Plan: {
        get 'Node Type'() {
          throw new Error('malformed plan');
        },
      },
    },
  ]);

  equal(result.performed, false, 'Predictive guardrail: malformed EXPLAIN plan is not treated as performed');
  equal(result.riskLevel, 'critical', 'Predictive guardrail: malformed EXPLAIN plan is critical');
  equal(result.recommendation, 'deny', 'Predictive guardrail: malformed EXPLAIN plan denies execution');
  equal(result.signals[0]?.signal, 'explain_plan_malformed', 'Predictive guardrail: malformed plan reason is explicit');
}

function testValidLowRiskPlanCanProceed(): void {
  const result = analyzePlan([
    {
      Plan: {
        'Node Type': 'Index Scan',
        'Plan Rows': 10,
        'Total Cost': 5,
      },
    },
  ]);

  equal(result.performed, true, 'Predictive guardrail: valid EXPLAIN plan is treated as performed');
  equal(result.riskLevel, 'low', 'Predictive guardrail: low-risk plan stays low risk');
  equal(result.recommendation, 'proceed', 'Predictive guardrail: low-risk valid plan can proceed');
  ok(result.plannerEvidence?.nodeTypes.includes('Index Scan'), 'Predictive guardrail: valid plan evidence is retained');
}

async function testPostgresProofPathNotReadyFailsClosed(): Promise<void> {
  const originalPgUrl = process.env.ATTESTOR_PG_URL;
  delete process.env.ATTESTOR_PG_URL;
  try {
    const result = await runPostgresProve('SELECT 1');

    equal(result.attempted, false, 'Postgres prove: unconfigured runtime is not attempted');
    equal(result.predictiveGuardrail.performed, false, 'Postgres prove: unconfigured runtime has no performed preflight');
    equal(result.predictiveGuardrail.riskLevel, 'critical', 'Postgres prove: unconfigured runtime is critical');
    equal(result.predictiveGuardrail.recommendation, 'deny', 'Postgres prove: unconfigured runtime denies execution');
    equal(result.predictiveGuardrail.signals[0]?.signal, 'postgres_not_ready', 'Postgres prove: unconfigured runtime reason is explicit');
  } finally {
    if (originalPgUrl === undefined) {
      delete process.env.ATTESTOR_PG_URL;
    } else {
      process.env.ATTESTOR_PG_URL = originalPgUrl;
    }
  }
}

async function testSnowflakeWriteSqlFailsClosedBeforeDriver(): Promise<void> {
  const config = {
    provider: 'snowflake',
    connectionUrl: 'https://example.snowflakecomputing.com',
    timeoutMs: 1000,
    maxRows: 100,
  };
  const result = await snowflakeConnector.execute('DELETE FROM finance.payments', config);
  const preflight = await snowflakeConnector.preflight?.('DELETE FROM finance.payments', config);
  const stacked = await snowflakeConnector.execute('SELECT * FROM finance.payments; SELECT * FROM finance.ledger', config);

  equal(result.success, false, 'Snowflake connector: write SQL is rejected before execution');
  ok(result.error?.includes('Write operation detected'), 'Snowflake connector: write rejection reason is explicit');
  equal(stacked.success, false, 'Snowflake connector: stacked SQL is rejected before execution');
  ok(stacked.error?.includes('Stacked queries detected'), 'Snowflake connector: stacked rejection reason is explicit');
  equal(preflight?.performed, false, 'Snowflake preflight: write SQL is not treated as performed');
  equal(preflight?.riskLevel, 'critical', 'Snowflake preflight: write SQL is critical');
  equal(preflight?.recommendation, 'deny', 'Snowflake preflight: write SQL denies execution');
  equal(preflight?.signals[0]?.signal, 'sql_not_read_only', 'Snowflake preflight: write rejection reason is explicit');
}

testMissingExplainPlanFailsClosed();
testMalformedExplainPlanFailsClosed();
testValidLowRiskPlanCanProceed();
await testPostgresProofPathNotReadyFailsClosed();
await testSnowflakeWriteSqlFailsClosedBeforeDriver();

console.log(`Predictive guardrails fail-closed tests: ${passed} passed, 0 failed`);
