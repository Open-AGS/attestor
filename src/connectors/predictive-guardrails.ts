/**
 * Attestor Predictive Guardrails - Pre-Execution Risk Preflight
 *
 * Uses PostgreSQL EXPLAIN (FORMAT JSON) to derive bounded risk signals
 * BEFORE actual execution. This is a proactive governance layer:
 * the system can warn, hold, or deny execution based on predicted behavior.
 *
 * What this IS:
 * - A bounded risk preflight using the query planner's cost/row estimates
 * - A set of derived risk signals (high volume, sequential scan, excessive joins)
 * - An input to the authority decision (warn/hold/deny)
 *
 * What this is NOT:
 * - An exact execution predictor (planner estimates can be wrong)
 * - A full query optimizer (we only read EXPLAIN output)
 * - A replacement for runtime guardrails (those still run independently)
 */

import { enforceAllowedSchemas, validateReadOnlySql } from './postgres.js';

export interface PredictiveGuardrailResult {
  /** Whether the preflight was performed. */
  performed: boolean;
  /** Overall risk level. */
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  /** Individual risk signals. */
  signals: PredictiveRiskSignal[];
  /** Recommended action. */
  recommendation: 'proceed' | 'warn' | 'hold' | 'deny';
  /** Raw planner evidence (if available). */
  plannerEvidence: {
    estimatedRows: number | null;
    estimatedCost: number | null;
    nodeTypes: string[];
    sequentialScans: number;
    nestedLoops: number;
  } | null;
}

export interface PredictiveRiskSignal {
  signal: string;
  severity: 'info' | 'warn' | 'critical';
  detail: string;
  threshold: string;
  observed: string;
}

export interface PredictivePreflightOptions {
  readonly allowedSchemas?: readonly string[];
}

// Risk Thresholds

const THRESHOLDS = {
  HIGH_ROW_ESTIMATE: 100000,
  CRITICAL_ROW_ESTIMATE: 1000000,
  HIGH_COST: 10000,
  CRITICAL_COST: 100000,
  MAX_SEQUENTIAL_SCANS: 2,
  MAX_NESTED_LOOPS: 3,
};

// EXPLAIN Analysis

interface PlanNode {
  'Node Type': string;
  'Plan Rows'?: number;
  'Total Cost'?: number;
  'Plans'?: PlanNode[];
  [key: string]: unknown;
}

function extractPlanMetrics(plan: PlanNode): { estimatedRows: number; estimatedCost: number; nodeTypes: string[]; sequentialScans: number; nestedLoops: number } {
  let maxRows = plan['Plan Rows'] ?? 0;
  let maxCost = plan['Total Cost'] ?? 0;
  const nodeTypes: string[] = [plan['Node Type']];
  let sequentialScans = plan['Node Type'] === 'Seq Scan' ? 1 : 0;
  let nestedLoops = plan['Node Type'] === 'Nested Loop' ? 1 : 0;

  if (plan['Plans']) {
    for (const child of plan['Plans']) {
      const childMetrics = extractPlanMetrics(child);
      maxRows = Math.max(maxRows, childMetrics.estimatedRows);
      maxCost = Math.max(maxCost, childMetrics.estimatedCost);
      nodeTypes.push(...childMetrics.nodeTypes);
      sequentialScans += childMetrics.sequentialScans;
      nestedLoops += childMetrics.nestedLoops;
    }
  }

  return { estimatedRows: maxRows, estimatedCost: maxCost, nodeTypes, sequentialScans, nestedLoops };
}

/**
 * Analyze a PostgreSQL EXPLAIN JSON result into risk signals.
 */
export function analyzePlan(explainResult: unknown): PredictiveGuardrailResult {
  try {
    // PostgreSQL EXPLAIN (FORMAT JSON) returns [{ "Plan": { ... } }]
    const plans = explainResult as Array<{ Plan: PlanNode }>;
    if (!plans?.[0]?.Plan) {
      return {
        performed: false,
        riskLevel: 'critical',
        signals: [{
          signal: 'explain_plan_missing',
          severity: 'critical',
          detail: 'PostgreSQL EXPLAIN did not return a readable JSON plan.',
          threshold: 'valid EXPLAIN JSON plan',
          observed: 'missing',
        }],
        recommendation: 'deny',
        plannerEvidence: null,
      };
    }

    const rootPlan = plans[0].Plan;
    const metrics = extractPlanMetrics(rootPlan);
    const signals: PredictiveRiskSignal[] = [];

    // Row volume risk
    if (metrics.estimatedRows >= THRESHOLDS.CRITICAL_ROW_ESTIMATE) {
      signals.push({ signal: 'critical_row_volume', severity: 'critical', detail: `Estimated ${metrics.estimatedRows.toLocaleString()} rows`, threshold: `< ${THRESHOLDS.CRITICAL_ROW_ESTIMATE.toLocaleString()}`, observed: metrics.estimatedRows.toLocaleString() });
    } else if (metrics.estimatedRows >= THRESHOLDS.HIGH_ROW_ESTIMATE) {
      signals.push({ signal: 'high_row_volume', severity: 'warn', detail: `Estimated ${metrics.estimatedRows.toLocaleString()} rows`, threshold: `< ${THRESHOLDS.HIGH_ROW_ESTIMATE.toLocaleString()}`, observed: metrics.estimatedRows.toLocaleString() });
    }

    // Cost risk
    if (metrics.estimatedCost >= THRESHOLDS.CRITICAL_COST) {
      signals.push({ signal: 'critical_cost', severity: 'critical', detail: `Estimated cost ${metrics.estimatedCost.toFixed(0)}`, threshold: `< ${THRESHOLDS.CRITICAL_COST}`, observed: metrics.estimatedCost.toFixed(0) });
    } else if (metrics.estimatedCost >= THRESHOLDS.HIGH_COST) {
      signals.push({ signal: 'high_cost', severity: 'warn', detail: `Estimated cost ${metrics.estimatedCost.toFixed(0)}`, threshold: `< ${THRESHOLDS.HIGH_COST}`, observed: metrics.estimatedCost.toFixed(0) });
    }

    // Sequential scan risk
    if (metrics.sequentialScans > THRESHOLDS.MAX_SEQUENTIAL_SCANS) {
      signals.push({ signal: 'excessive_sequential_scans', severity: 'warn', detail: `${metrics.sequentialScans} sequential scans detected`, threshold: `<= ${THRESHOLDS.MAX_SEQUENTIAL_SCANS}`, observed: String(metrics.sequentialScans) });
    }

    // Nested loop risk
    if (metrics.nestedLoops > THRESHOLDS.MAX_NESTED_LOOPS) {
      signals.push({ signal: 'excessive_nested_loops', severity: 'warn', detail: `${metrics.nestedLoops} nested loops detected`, threshold: `<= ${THRESHOLDS.MAX_NESTED_LOOPS}`, observed: String(metrics.nestedLoops) });
    }

    // Determine risk level and recommendation
    const hasCritical = signals.some((s) => s.severity === 'critical');
    const hasWarn = signals.some((s) => s.severity === 'warn');
    const riskLevel: PredictiveGuardrailResult['riskLevel'] = hasCritical ? 'critical' : hasWarn ? 'moderate' : 'low';
    const recommendation: PredictiveGuardrailResult['recommendation'] = hasCritical ? 'deny' : hasWarn ? 'warn' : 'proceed';

    return {
      performed: true,
      riskLevel,
      signals,
      recommendation,
      plannerEvidence: {
        estimatedRows: metrics.estimatedRows,
        estimatedCost: metrics.estimatedCost,
        nodeTypes: [...new Set(metrics.nodeTypes)],
        sequentialScans: metrics.sequentialScans,
        nestedLoops: metrics.nestedLoops,
      },
    };
  } catch (error) {
    return {
      performed: false,
      riskLevel: 'critical',
      signals: [{
        signal: 'explain_plan_malformed',
        severity: 'critical',
        detail: error instanceof Error ? error.message : String(error),
        threshold: 'valid EXPLAIN JSON plan',
        observed: 'malformed',
      }],
      recommendation: 'deny',
      plannerEvidence: null,
    };
  }
}

/**
 * Run EXPLAIN on a query against PostgreSQL and analyze the plan.
 * Returns the preflight result without executing the actual query.
 */
export async function runPredictivePreflight(
  sql: string,
  connectionUrl: string,
  options: PredictivePreflightOptions = {},
): Promise<PredictiveGuardrailResult> {
  try {
    validateReadOnlySql(sql);
    if (options.allowedSchemas?.length) {
      enforceAllowedSchemas(sql, Array.from(options.allowedSchemas));
    }
  } catch (err) {
    return {
      performed: false,
      riskLevel: 'critical',
      signals: [{
        signal: 'sql_governance_failed_before_explain',
        severity: 'critical',
        detail: err instanceof Error ? err.message : String(err),
        threshold: 'read-only SELECT/WITH SQL accepted by PostgreSQL governance before EXPLAIN',
        observed: 'rejected before planner preflight',
      }],
      recommendation: 'deny',
      plannerEvidence: null,
    };
  }

  let Client: any;
  try {
    const pg = await (Function('return import("pg")')() as Promise<any>);
    Client = pg.default?.Client ?? pg.Client;
  } catch {
    return {
      performed: false,
      riskLevel: 'critical',
      signals: [{
        signal: 'driver_missing',
        severity: 'critical',
        detail: 'pg driver not installed',
        threshold: 'pg driver available',
        observed: 'missing',
      }],
      recommendation: 'deny',
      plannerEvidence: null,
    };
  }

  const client = new Client({ connectionString: connectionUrl });
  try {
    await client.connect();
    const result = await client.query(`EXPLAIN (FORMAT JSON) ${sql}`);
    const explainJson = result.rows[0]?.['QUERY PLAN'];
    await client.end();
    return analyzePlan(explainJson);
  } catch (err) {
    try { await client.end(); } catch { /* ignore */ }
    return {
      performed: false,
      riskLevel: 'critical',
      signals: [{
        signal: 'explain_failed',
        severity: 'critical',
        detail: err instanceof Error ? err.message : String(err),
        threshold: 'successful EXPLAIN preflight',
        observed: 'error',
      }],
      recommendation: 'deny',
      plannerEvidence: null,
    };
  }
}
