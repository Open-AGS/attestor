import type {
  ProductionBackupRestoreDrSummary,
} from './backup-restore-dr-types.ts';

export function renderReadme(summary: ProductionBackupRestoreDrSummary): string {
  const lines = [
    '# Production Backup / Restore / DR Rehearsal',
    '',
    `Generated: ${summary.generatedAt}`,
    `Profile: ${summary.profileId}`,
    `State: ${summary.readiness.state}`,
    `Passed: ${summary.readiness.passed ? 'yes' : 'no'}`,
    '',
    '## Checks',
    '',
    ...summary.checks.map((check) => `- ${check.status.toUpperCase()} ${check.id}: ${check.detail}`),
    '',
    '## Artifacts',
    '',
    `- Summary: ${summary.artifacts.summaryPath}`,
    `- Backup snapshot: ${summary.artifacts.backupSnapshotDir}`,
    `- PITR evidence: ${summary.artifacts.pitrEvidencePath ?? '(missing)'}`,
    '',
    '## Behavior',
    '',
  ];
  if (summary.behavior) {
    lines.push(
      `- Control-plane snapshot: ${summary.behavior.controlPlaneBackup.snapshotId}`,
      `- Present backup components: ${summary.behavior.controlPlaneBackup.presentComponents}`,
      `- Restored components: ${summary.behavior.controlPlaneRestore.restoredComponentCount}`,
      `- Redis source durability: appendonly=${summary.behavior.redisDurability.source.appendonly}, save=${summary.behavior.redisDurability.source.save ?? '(empty)'}`,
      `- Redis replacement durability: appendonly=${summary.behavior.redisDurability.replacement.appendonly}, save=${summary.behavior.redisDurability.replacement.save ?? '(empty)'}`,
      `- Replacement API ready status: ${summary.behavior.postRestore.apiReadyStatus}`,
      `- Replacement worker ready status: ${summary.behavior.postRestore.workerReadyStatus}`,
      `- Admission allowed probe: ${summary.behavior.postRestore.admissionAllowed ? 'passed' : 'failed'}`,
      `- Blocked fail-closed probe: ${summary.behavior.postRestore.blockedFailClosed ? 'passed' : 'failed'}`,
    );
  } else {
    lines.push('- Core backup/restore/DR behavior was not exercised.');
  }
  lines.push(
    '',
    '## Non-Claims',
    '',
    ...summary.nonClaims.map((claim) => `- ${claim}`),
    '',
  );
  return lines.join('\n');
}
