import type {
  GoldenOperationalExecutionReviewerSandboxResult,
} from './golden-operational-execution-reviewer-sandbox-types.js';

function list(items: readonly string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- none';
}

export function renderGoldenOperationalExecutionReviewerSandboxMarkdown(
  result: GoldenOperationalExecutionReviewerSandboxResult,
): string {
  const decision = result.decisionSummary;
  return `# Golden Path: Operational Execution Reviewer Sandbox

Status: ${result.inputStatus}

## Practical Contrast

Without Attestor for this local input:

- no Attestor issue-code report
- no digest-bound rollback, dry-run, approval, replay, or trace material
- no explicit no-claim boundary before an operational side effect

With Attestor for this local input:

- result status: ${result.inputStatus}
- engine ran: ${result.engineRan}
- visible gate stages: ${result.gateOrder.length}
- issue codes: ${result.issueCodes.length}
- deployments: ${result.safetyBoundary.noDeployment ? '0' : 'present'}
- infrastructure changes: ${result.safetyBoundary.noInfrastructureChange ? '0' : 'present'}
- secret-manager writes: ${result.safetyBoundary.noSecretManagerWrite ? '0' : 'present'}
- decision digest: ${decision?.decisionRelevantDigest ?? 'none'}

## Input Boundary

- engine scope: ${result.engineScope}
- requested action surface: ${result.requestedActionSurface ?? 'not provided'}
- engine ran: ${result.engineRan}
- input digest: ${result.inputDigest ?? 'none'}

## Schema Errors

${list(result.schemaErrors)}

## Issue Codes

${list(result.issueCodes)}

## Decision Summary

- expected posture: ${result.expectedPosture ?? 'none'}
- shadow decision: ${decision?.shadowDecision ?? 'none'}
- effective decision: ${decision?.effectiveDecision ?? 'none'}
- packet decision: ${decision?.packetDecision ?? 'none'}
- fusion posture: ${decision?.fusionPosture ?? 'none'}
- conflict outcome: ${decision?.conflictOutcome ?? 'none'}
- human gate: ${decision?.humanStatus ?? 'none'}
- evidence completeness: ${decision?.evidenceCompletenessPercent ?? 0}%
- decision digest: ${decision?.decisionRelevantDigest ?? 'none'}

## Gate Trace

${result.gateOrder.map((gate, index) => `${index + 1}. ${gate}`).join('\n')}

## No-Claims

${list(result.noClaims)}

## Safety Boundary

- target-system calls: ${result.safetyBoundary.noTargetSystemCall ? '0' : 'present'}
- deployments: ${result.safetyBoundary.noDeployment ? '0' : 'present'}
- infrastructure changes: ${result.safetyBoundary.noInfrastructureChange ? '0' : 'present'}
- secret-manager writes: ${result.safetyBoundary.noSecretManagerWrite ? '0' : 'present'}
- incident automation execution: ${result.safetyBoundary.noIncidentAutomationExecution ? '0' : 'present'}
- runbook execution: ${result.safetyBoundary.noRunbookExecution ? '0' : 'present'}
- provider calls: ${result.safetyBoundary.noProviderCall ? '0' : 'present'}
- audit writes: ${result.safetyBoundary.noAuditWrite ? '0' : 'present'}
- policy activation: ${result.safetyBoundary.noPolicyActivation ? '0' : 'present'}
- learning/training activation: ${result.safetyBoundary.noLearningActivation && result.safetyBoundary.noTrainingActivation ? '0' : 'present'}
- grants authority: ${result.safetyBoundary.grantsAuthority}
- can admit: ${result.safetyBoundary.canAdmit}
- production ready: ${result.safetyBoundary.productionReady}
`;
}

export function renderGoldenOperationalExecutionReviewerSandboxJson(
  result: GoldenOperationalExecutionReviewerSandboxResult,
): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
