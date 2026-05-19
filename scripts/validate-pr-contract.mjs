#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_SECTIONS = Object.freeze([
  '## Attestor PR Contract',
  '### Status',
  '### Scope',
  '### Trust surface',
  '### Claim labels',
  '### Evidence',
  '### Changes',
  '### Tests / checks',
  '### Readiness classification',
  '### No-claims / limitations',
  '### Dependency review',
  '### Human admission',
]);

export const REQUIRED_NON_EMPTY_FIELDS = Object.freeze([
  'Mode:',
  'Tracker:',
  'Step:',
  'Progress:',
  'Source of truth:',
  'Evidence state:',
  'Next:',
  'Newest user/request in operational terms:',
  'Affected trust surface:',
  'Protected principle:',
  'Repository evidence checked:',
  'Official / primary sources checked:',
  'Files changed:',
  'What this PR does NOT prove:',
]);

export const ALLOWED_EVIDENCE_STATES = Object.freeze([
  'repo-proven',
  'partial-repo',
  'source-backed',
  'inferred',
  'not proven',
  'contradicted',
  'blocked',
  'design-hypothesis',
  'novel-construct',
  'opinion / design hypothesis',
]);

export const DEPENDABOT_PR_AUTHOR = 'dependabot[bot]';

function lineForField(body, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = body.match(new RegExp(`^${escaped}(.*)$`, 'imu'));
  return match?.[1]?.trim() ?? null;
}

function stripMarkdownFencedCodeBlocks(body) {
  const normalizedBody = body.replace(/^\uFEFF/u, '');
  const lines = normalizedBody.split(/\r?\n/u);
  const kept = [];
  let inFence = false;
  let fenceMarker = null;

  for (const line of lines) {
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(/^(```+|~~~+)/u);
    if (fenceMatch) {
      const marker = fenceMatch[1]?.startsWith('`') ? '`' : '~';
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
        continue;
      }
      if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = null;
        continue;
      }
    }
    if (!inFence) kept.push(line);
  }

  return kept.join('\n');
}

function hasRequiredSection(body, section) {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`^${escaped}\\s*$`, 'mu').test(body);
}

function hasCheckedDecision(body, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`^- \\[[xX]\\] ${escaped}$`, 'imu').test(body);
}

function checkedCount(body, labels) {
  return labels.filter((label) => hasCheckedDecision(body, label)).length;
}

function hasDependencySurfaceRisk(body) {
  const dependencyPr = lineForField(body, 'Dependency PR:')?.toLowerCase() ?? '';
  const surface = lineForField(body, 'Runtime / security / build / action surface touched:')?.toLowerCase() ?? '';
  return dependencyPr === 'yes' || surface === 'yes';
}

function isDependabotPr(options) {
  return options.prAuthor === DEPENDABOT_PR_AUTHOR;
}

export function validatePrContract(body, options = {}) {
  if (isDependabotPr(options)) {
    return {
      ok: true,
      dependencyAutomationBypass: true,
      missingSections: [],
      emptyFields: [],
      invalidEvidenceState: null,
      noMergeClassification: false,
      invalidFinalDecisionCount: 1,
      dependencyReviewMissing: [],
    };
  }

  const contractBody = stripMarkdownFencedCodeBlocks(body);
  const missingSections = REQUIRED_SECTIONS.filter((section) =>
    !hasRequiredSection(contractBody, section)
  );
  const emptyFields = REQUIRED_NON_EMPTY_FIELDS.filter((field) => {
    const value = lineForField(contractBody, field);
    return value === null || value.length === 0;
  });

  const evidenceState = lineForField(contractBody, 'Evidence state:');
  const invalidEvidenceState = evidenceState && !ALLOWED_EVIDENCE_STATES.includes(evidenceState)
    ? evidenceState
    : null;

  const mergeClassificationCount = checkedCount(contractBody, [
    'safe small change',
    'trust-sensitive change',
    'contract-only',
    'runtime-wired',
    'docs/readiness claim change',
    'blocked / do not merge yet',
  ]);
  const finalDecisionCount = checkedCount(contractBody, [
    'OK to merge',
    'Do not merge yet',
  ]);

  const dependencyReviewMissing = hasDependencySurfaceRisk(contractBody)
    ? [
        'Release notes / changelog / advisory checked:',
        'Lockfile / manifest diff checked:',
      ].filter((field) => {
        const value = lineForField(body, field);
        return value === null || value.length === 0;
      })
    : [];

  return {
    ok:
      missingSections.length === 0 &&
      emptyFields.length === 0 &&
      invalidEvidenceState === null &&
      mergeClassificationCount > 0 &&
      finalDecisionCount === 1 &&
      dependencyReviewMissing.length === 0,
    dependencyAutomationBypass: false,
    missingSections,
    emptyFields,
    invalidEvidenceState,
    noMergeClassification: mergeClassificationCount === 0,
    invalidFinalDecisionCount: finalDecisionCount,
    dependencyReviewMissing,
  };
}

export function formatValidationFailure(result) {
  const lines = ['PR contract failed.'];
  if (result.missingSections.length > 0) {
    lines.push('Missing required sections:');
    lines.push(...result.missingSections.map((item) => `- ${item}`));
  }
  if (result.emptyFields.length > 0) {
    lines.push('Empty required fields:');
    lines.push(...result.emptyFields.map((item) => `- ${item}`));
  }
  if (result.invalidEvidenceState) {
    lines.push(`Invalid Evidence state: ${result.invalidEvidenceState}`);
    lines.push(`Allowed: ${ALLOWED_EVIDENCE_STATES.join(', ')}`);
  }
  if (result.noMergeClassification) {
    lines.push('Human admission must check at least one merge classification line.');
  }
  if (result.invalidFinalDecisionCount !== 1) {
    lines.push('Human admission must check exactly one final decision line.');
  }
  if (result.dependencyReviewMissing.length > 0) {
    lines.push('Dependency review fields required for dependency or runtime/security/build/action-surface PRs:');
    lines.push(...result.dependencyReviewMissing.map((item) => `- ${item}`));
  }
  return lines.join('\n');
}

function readBodyFromCli() {
  const argPath = process.argv[2];
  if (argPath) return readFileSync(argPath, 'utf8');
  return process.env.PR_BODY ?? '';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const body = readBodyFromCli();
  const result = validatePrContract(body, {
    prAuthor: process.env.PR_AUTHOR,
  });
  if (!result.ok) {
    console.error(formatValidationFailure(result));
    process.exit(1);
  }
  if (result.dependencyAutomationBypass) {
    console.log('Dependabot PR detected; Attestor human PR contract template is not required for automation-authored dependency PRs.');
    process.exit(0);
  }
  console.log('PR contract present.');
}
