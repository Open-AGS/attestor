import type {
  ProductionPromotionCandidateSummary,
} from './production-promotion-candidate-types.ts';

export function renderReadme(summary: ProductionPromotionCandidateSummary): string {
  const blockers = summary.goNoGo.blockers.length
    ? summary.goNoGo.blockers.map((item) => `- ${item}`).join('\n')
    : '- none';
  return `# Attestor v0.2 Production-Promotion Candidate Evidence Bundle

Generated at:

- ${summary.generatedAt}

Verdict:

- ${summary.goNoGo.verdict}
- manifest verdict: ${summary.goNoGo.manifestVerdict}

Target:

- rehearsal id: ${summary.rehearsalId}
- environment: ${summary.targetEnvironment.name}
- provider: ${summary.targetEnvironment.provider}
- region: ${summary.targetEnvironment.region}

Environment packet:

- state: ${summary.environmentPacket.state ?? 'missing'}
- promotion gate passed: ${summary.environmentPacket.promotionGatePassed ?? 'unknown'}

Artifacts:

- archive: ${summary.artifacts.archivePath}
- archive sha256: ${summary.artifacts.archiveSha256Path}
- local signed attestation: ${summary.artifacts.attestationPath ?? 'missing'}
- public key: ${summary.artifacts.publicKeyPath ?? 'missing'}
- summary: ${summary.artifacts.summaryPath}

Verification:

1. Compare the archive digest in \`${summary.artifacts.archiveSha256Path}\`.
2. Verify the local Ed25519 attestation in \`${summary.artifacts.attestationPath ?? 'production-promotion-attestation.json'}\` against the public key.
3. If this archive is later published from GitHub Actions, verify repository/workflow provenance with:

\`\`\`bash
${summary.attestation.githubVerificationCommand}
\`\`\`

Blockers:

${blockers}

Limitations:

${summary.limitations.map((claim) => `- ${claim}`).join('\n')}
`;
}
