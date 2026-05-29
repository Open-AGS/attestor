

import type { FinancialTestContext } from './helpers.js';

export async function runSemanticClauseFinancialTests({ ok }: FinancialTestContext): Promise<void> {
  // ── Semantic Clause Evaluation ──
  console.log('\n  [Semantic Clause Evaluation]');
  {
    const { evaluateSemanticClauses } = await import('../../src/financial/semantic-clauses.js');

    // Mock execution evidence: counterparty exposure with known values
    const execEvidence = {
      success: true, durationMs: 12, rowCount: 3, error: null, schemaHash: 'test',
      columns: ['counterparty', 'gross_long', 'gross_short', 'net_exposure', 'exposure_usd', 'concentration_pct'],
      columnTypes: ['text', 'numeric', 'numeric', 'numeric', 'numeric', 'numeric'],
      rows: [
        { counterparty: 'JPM', gross_long: 1000000, gross_short: 400000, net_exposure: 600000, exposure_usd: 600000, concentration_pct: 0.15 },
        { counterparty: 'GS', gross_long: 800000, gross_short: 300000, net_exposure: 500000, exposure_usd: 500000, concentration_pct: 0.12 },
        { counterparty: 'MS', gross_long: 600000, gross_short: 200000, net_exposure: 400000, exposure_usd: 400000, concentration_pct: 0.10 },
      ],
    };

    // Test 1: Balance identity passes (net = gross_long - gross_short)
    const balanceClause = { id: 'SC-001', type: 'balance_identity' as const, description: 'Net exposure = gross long - gross short', expression: 'net_exposure = gross_long - gross_short', columns: ['net_exposure', 'gross_long', 'gross_short'], tolerance: 0.01, severity: 'hard' as const };
    const balanceResult = evaluateSemanticClauses([balanceClause], execEvidence);
    ok(balanceResult.performed, 'Semantic: balance identity evaluated');
    ok(balanceResult.passCount === 1, 'Semantic: balance identity passes');
    ok(balanceResult.hardFailCount === 0, 'Semantic: no hard failures');

    // Test 2: Control total passes (exposure_usd sums correctly)
    const controlClause = { id: 'SC-002', type: 'control_total' as const, description: 'Total exposure reconciliation', expression: 'exposure_usd = sum(exposure_usd)', columns: ['exposure_usd'], tolerance: 0.01, severity: 'hard' as const };
    const controlResult = evaluateSemanticClauses([controlClause], execEvidence);
    ok(controlResult.performed, 'Semantic: control total evaluated');
    ok(controlResult.passCount === 1, 'Semantic: control total passes');

    // Test 3: Sign constraint passes (all exposures non-negative)
    const signClause = { id: 'SC-003', type: 'sign_constraint' as const, description: 'Exposures must be non-negative', expression: 'exposure_usd >= 0', columns: ['exposure_usd'], tolerance: 0, severity: 'hard' as const };
    const signResult = evaluateSemanticClauses([signClause], execEvidence);
    ok(signResult.passCount === 1, 'Semantic: sign constraint passes');

    // Test 4: Ratio bound passes (concentration < 100%)
    const ratioClause = { id: 'SC-004', type: 'ratio_bound' as const, description: 'Concentration must be under 100%', expression: 'concentration_pct <= 1.0', columns: ['concentration_pct'], tolerance: 0, severity: 'soft' as const };
    const ratioResult = evaluateSemanticClauses([ratioClause], execEvidence);
    ok(ratioResult.passCount === 1, 'Semantic: ratio bound passes');

    // Test 5: Completeness check passes (no nulls)
    const completenessClause = { id: 'SC-005', type: 'completeness_check' as const, description: 'All exposure fields populated', expression: 'non-null', columns: ['counterparty', 'exposure_usd', 'concentration_pct'], tolerance: 0, severity: 'hard' as const };
    const completenessResult = evaluateSemanticClauses([completenessClause], execEvidence);
    ok(completenessResult.passCount === 1, 'Semantic: completeness passes');

    // Test 6: Balance identity HARD FAIL (wrong net values)
    const badExec = {
      ...execEvidence,
      rows: [
        { counterparty: 'JPM', gross_long: 1000000, gross_short: 400000, net_exposure: 999999, exposure_usd: 600000, concentration_pct: 0.15 },
        { counterparty: 'GS', gross_long: 800000, gross_short: 300000, net_exposure: 500000, exposure_usd: 500000, concentration_pct: 0.12 },
      ],
    };
    const failResult = evaluateSemanticClauses([balanceClause], badExec);
    ok(failResult.failCount === 1, 'Semantic: balance identity fails on wrong net');
    ok(failResult.hardFailCount === 1, 'Semantic: balance hard failure counted');
    ok(!failResult.evaluations[0].passed, 'Semantic: evaluation reports failure');
    ok(failResult.evaluations[0].variance !== null && failResult.evaluations[0].variance > 0, 'Semantic: variance reported');

    // Test 7: Sign constraint HARD FAIL (negative exposure)
    const negExec = {
      ...execEvidence,
      rows: [
        { counterparty: 'JPM', gross_long: 1000000, gross_short: 400000, net_exposure: 600000, exposure_usd: -100, concentration_pct: 0.15 },
      ],
    };
    const negResult = evaluateSemanticClauses([signClause], negExec);
    ok(negResult.failCount === 1, 'Semantic: sign constraint fails on negative');
    ok(negResult.hardFailCount === 1, 'Semantic: sign hard failure counted');

    // Test 8: Multiple clauses mixed results
    const mixedResult = evaluateSemanticClauses([balanceClause, signClause, ratioClause], badExec);
    ok(mixedResult.clauseCount === 3, 'Semantic: 3 clauses evaluated');
    ok(mixedResult.passCount >= 1, 'Semantic: some clauses pass');
    ok(mixedResult.failCount >= 1, 'Semantic: some clauses fail');

    // Test 9: No execution → not performed
    const noExecResult = evaluateSemanticClauses([balanceClause], null);
    ok(!noExecResult.performed, 'Semantic: null execution → not performed');

    console.log(`    Clauses: balance=${balanceResult.passCount === 1 ? '✓' : '✗'}, control=${controlResult.passCount === 1 ? '✓' : '✗'}, sign=${signResult.passCount === 1 ? '✓' : '✗'}, ratio=${ratioResult.passCount === 1 ? '✓' : '✗'}, complete=${completenessResult.passCount === 1 ? '✓' : '✗'}`);
    console.log(`    Failures: balance_bad=${failResult.hardFailCount}, negative=${negResult.hardFailCount}, mixed=${mixedResult.failCount}/${mixedResult.clauseCount}`);
  }

  // ── Semantic Clause Pipeline Integration ──
  console.log('\n  [Semantic Clause Pipeline Integration]');
  {
    const { runFinancialPipeline } = await import('../../src/financial/pipeline.js');
    const { COUNTERPARTY_SQL, COUNTERPARTY_INTENT, COUNTERPARTY_FIXTURE, COUNTERPARTY_REPORT_CONTRACT, COUNTERPARTY_REPORT } = await import('../../src/financial/fixtures/scenarios.js');

    // Scenario 1: Pipeline with passing semantic clauses → decision unaffected
    // Uses actual counterparty fixture columns: counterparty_name, exposure_usd, credit_rating, sector
    const passingClauses = [
      { id: 'SC-P01', type: 'sign_constraint' as const, description: 'Exposures non-negative', expression: 'exposure_usd >= 0', columns: ['exposure_usd'], tolerance: 0, severity: 'hard' as const },
      { id: 'SC-P02', type: 'completeness_check' as const, description: 'Key fields populated', expression: 'non-null', columns: ['counterparty_name', 'exposure_usd'], tolerance: 0, severity: 'soft' as const },
    ];
    const passReport = runFinancialPipeline({
      runId: 'sem-pass-test',
      intent: COUNTERPARTY_INTENT,
      candidateSql: COUNTERPARTY_SQL,
      fixtures: [COUNTERPARTY_FIXTURE],
      generatedReport: COUNTERPARTY_REPORT,
      reportContract: COUNTERPARTY_REPORT_CONTRACT,
      semanticClauses: passingClauses,
    });
    ok(passReport.decision === 'pass', 'Pipeline+Semantic: passing clauses → decision still pass');
    ok(passReport.semanticClauses !== null, 'Pipeline+Semantic: clause result present');
    ok(passReport.semanticClauses!.performed, 'Pipeline+Semantic: clauses evaluated');
    ok(passReport.semanticClauses!.hardFailCount === 0, 'Pipeline+Semantic: no hard failures');
    ok(passReport.semanticClauses!.passCount === 2, 'Pipeline+Semantic: both clauses pass');
    // Check artifact surfacing
    ok(passReport.outputPack.semanticClauses !== null, 'Pipeline+Semantic: output pack has semantic summary');
    ok(passReport.outputPack.semanticClauses!.performed, 'Pipeline+Semantic: output pack shows performed');
    // Check audit trail contains semantic entry
    ok(passReport.audit.entries.some((e) => e.stage === 'semantic_clauses'), 'Pipeline+Semantic: audit trail has semantic entry');

    // Scenario 2: Pipeline with hard-failing semantic clause → decision becomes 'fail'
    // Intentionally wrong constraint: exposure_usd must be negative (all values are positive)
    const failingClauses = [
      { id: 'SC-F01', type: 'sign_constraint' as const, description: 'Exposure must be negative (intentionally wrong)', expression: 'exposure_usd < 0', columns: ['exposure_usd'], tolerance: 0, severity: 'hard' as const },
    ];
    const failReport = runFinancialPipeline({
      runId: 'sem-fail-test',
      intent: COUNTERPARTY_INTENT,
      candidateSql: COUNTERPARTY_SQL,
      fixtures: [COUNTERPARTY_FIXTURE],
      generatedReport: COUNTERPARTY_REPORT,
      reportContract: COUNTERPARTY_REPORT_CONTRACT,
      semanticClauses: failingClauses,
    });
    ok(failReport.decision === 'fail', 'Pipeline+Semantic: hard clause failure → decision fail');
    ok(failReport.semanticClauses!.hardFailCount === 1, 'Pipeline+Semantic: 1 hard failure');
    ok(failReport.semanticClauses!.evaluations[0].explanation.includes('violate'), 'Pipeline+Semantic: explanation mentions violation');
    // Check dossier blockers
    ok(failReport.dossier.blockers.some((b) => b.source.includes('semantic_clause')), 'Pipeline+Semantic: dossier has semantic blocker');
    // Check output pack
    ok(failReport.outputPack.semanticClauses!.hardFailCount === 1, 'Pipeline+Semantic: output pack shows hard fail');
    ok(failReport.outputPack.semanticClauses!.failedClauses.length === 1, 'Pipeline+Semantic: output pack lists failed clause');

    // Scenario 3: Pipeline without semantic clauses → null result, decision unaffected
    const noClauseReport = runFinancialPipeline({
      runId: 'sem-none-test',
      intent: COUNTERPARTY_INTENT,
      candidateSql: COUNTERPARTY_SQL,
      fixtures: [COUNTERPARTY_FIXTURE],
      generatedReport: COUNTERPARTY_REPORT,
      reportContract: COUNTERPARTY_REPORT_CONTRACT,
    });
    ok(noClauseReport.semanticClauses === null, 'Pipeline+Semantic: no clauses → null result');
    ok(noClauseReport.decision === 'pass', 'Pipeline+Semantic: no clauses → decision unaffected');

    console.log(`    Pass scenario: decision=${passReport.decision}, clauses=${passReport.semanticClauses!.passCount}/${passReport.semanticClauses!.clauseCount}`);
    console.log(`    Fail scenario: decision=${failReport.decision}, hard_fails=${failReport.semanticClauses!.hardFailCount}, blockers=${failReport.dossier.blockers.filter((b) => b.source.includes('semantic')).length}`);
    console.log(`    No-clause scenario: decision=${noClauseReport.decision}, clauses=${noClauseReport.semanticClauses}`);
  }

}
