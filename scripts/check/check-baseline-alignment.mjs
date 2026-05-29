#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BASELINE_PATH = 'docs/audit/current-posture-baseline.md';
export const BASELINE_SECTION = '### Baseline alignment';
export const DEPENDABOT_PR_AUTHOR = 'dependabot[bot]';

export const BASELINE_PHASE_LABELS = Object.freeze([
  'Live Shadow Readiness',
  'Limited Live Enforcement',
  'Public Demo / Marketing safety',
  'Enterprise Pilot readiness',
  'P0/P1 blocker closure',
  'Baseline update only',
  'Repository maintainability only',
]);

export const BASELINE_REQUIRED_FIELDS = Object.freeze([
  'Baseline blocker addressed:',
  'Baseline phase:',
  'Baseline checked against current origin/master:',
  'Finding index updated:',
  'Report index updated:',
  'Live proof register updated:',
  'Control map / research index updated:',
  'Evidence system exception:',
]);

const READINESS_CLAIM_PATTERN = /\b(?:production-ready|enterprise-ready)\b/iu;
const ADDITIONAL_FIELD_LABELS = Object.freeze([
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
  'Current baseline file:',
  'If this PR does not map to the current baseline, explain why:',
  'Files changed:',
  'Files intentionally not touched:',
  'What this PR does NOT prove:',
  'Remaining blockers:',
  'Dependency PR:',
  'Release notes / changelog / advisory checked:',
  'Lockfile / manifest diff checked:',
  'Runtime / security / build / action surface touched:',
  'Merge classification:',
  'Final decision:',
]);

const FIELD_BOUNDARY_LABELS = Object.freeze([
  ...BASELINE_REQUIRED_FIELDS,
  ...ADDITIONAL_FIELD_LABELS,
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
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

function hasHeading(body, heading) {
  return new RegExp(`^${escapeRegExp(heading)}\\s*$`, 'mu').test(body);
}

function lineForField(body, field) {
  const fieldPattern = new RegExp(`^${escapeRegExp(field)}(.*)$`, 'iu');
  const lines = body.split(/\r?\n/u);

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.match(fieldPattern);
    if (!match) continue;

    const inlineValue = match[1]?.trim() ?? '';
    if (inlineValue.length > 0) return inlineValue;

    const blockValue = [];
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex]?.trim() ?? '';
      if (isFieldBlockBoundary(nextLine)) break;
      blockValue.push(nextLine);
    }
    return blockValue.join('\n').trim();
  }

  return null;
}

function isFieldBlockBoundary(trimmedLine) {
  return trimmedLine.length === 0 ||
    /^#{1,6}\s/u.test(trimmedLine) ||
    /^- \[[ xX]\]/u.test(trimmedLine) ||
    FIELD_BOUNDARY_LABELS.some((label) => trimmedLine.startsWith(label));
}

function hasCheckedPhase(body, label) {
  return new RegExp(`^- \\[[xX]\\] ${escapeRegExp(label)}$`, 'imu').test(body);
}

function templateContainsPhase(body, label) {
  return new RegExp(`^- \\[[ xX]\\] ${escapeRegExp(label)}$`, 'imu').test(body);
}

function hasNonEmptyField(body, field) {
  const value = lineForField(body, field);
  return value !== null && value.length > 0;
}

function hasNoClaimEvidence(body) {
  return hasHeading(body, '### No-claims / limitations') &&
    hasNonEmptyField(body, 'What this PR does NOT prove:') &&
    hasNonEmptyField(body, 'Repository evidence checked:');
}

function isDependabotPr(options) {
  return options.prAuthor === DEPENDABOT_PR_AUTHOR;
}

export function validateBaselineTemplate(templateBody) {
  const body = stripMarkdownFencedCodeBlocks(templateBody);
  const missingTemplateItems = [];

  if (!hasHeading(body, BASELINE_SECTION)) missingTemplateItems.push(BASELINE_SECTION);
  if (!body.includes(BASELINE_PATH)) missingTemplateItems.push(BASELINE_PATH);
  for (const field of BASELINE_REQUIRED_FIELDS) {
    if (!body.includes(field)) missingTemplateItems.push(field);
  }
  for (const phase of BASELINE_PHASE_LABELS) {
    if (!templateContainsPhase(body, phase)) missingTemplateItems.push(`phase: ${phase}`);
  }

  return {
    ok: missingTemplateItems.length === 0,
    mode: 'template',
    dependencyAutomationBypass: false,
    missingTemplateItems,
    emptyFields: [],
    noCheckedPhase: false,
    missingNoOverclaimEvidence: false,
  };
}

export function validateBaselineAlignment(body, options = {}) {
  if (isDependabotPr(options)) {
    return {
      ok: true,
      mode: 'pr-body',
      dependencyAutomationBypass: true,
      missingTemplateItems: [],
      emptyFields: [],
      noCheckedPhase: false,
      missingNoOverclaimEvidence: false,
    };
  }

  const contractBody = stripMarkdownFencedCodeBlocks(body);
  const missingTemplateItems = [];
  if (!hasHeading(contractBody, BASELINE_SECTION)) missingTemplateItems.push(BASELINE_SECTION);
  if (!contractBody.includes(BASELINE_PATH)) missingTemplateItems.push(BASELINE_PATH);

  const emptyFields = BASELINE_REQUIRED_FIELDS.filter((field) => !hasNonEmptyField(contractBody, field));
  const noCheckedPhase = !BASELINE_PHASE_LABELS.some((phase) => hasCheckedPhase(contractBody, phase));
  const missingNoOverclaimEvidence =
    READINESS_CLAIM_PATTERN.test(contractBody) && !hasNoClaimEvidence(contractBody);

  return {
    ok:
      missingTemplateItems.length === 0 &&
      emptyFields.length === 0 &&
      !noCheckedPhase &&
      !missingNoOverclaimEvidence,
    mode: 'pr-body',
    dependencyAutomationBypass: false,
    missingTemplateItems,
    emptyFields,
    noCheckedPhase,
    missingNoOverclaimEvidence,
  };
}

export function formatBaselineAlignmentFailure(result) {
  const lines = ['Baseline alignment check failed.'];
  if (result.missingTemplateItems.length > 0) {
    lines.push('Missing baseline alignment items:');
    lines.push(...result.missingTemplateItems.map((item) => `- ${item}`));
  }
  if (result.emptyFields.length > 0) {
    lines.push('Empty baseline alignment fields:');
    lines.push(...result.emptyFields.map((item) => `- ${item}`));
  }
  if (result.noCheckedPhase) {
    lines.push(`Check at least one baseline phase: ${BASELINE_PHASE_LABELS.join(', ')}`);
  }
  if (result.missingNoOverclaimEvidence) {
    lines.push('Production-ready or enterprise-ready language requires repository evidence and a no-claims block.');
  }
  return lines.join('\n');
}

function readBodyFromCli() {
  const argPath = process.argv[2];
  if (argPath) return readFileSync(argPath, 'utf8');
  if (process.env.PR_BODY !== undefined) return process.env.PR_BODY;
  return readFileSync(join(process.cwd(), '.github', 'pull_request_template.md'), 'utf8');
}

function validateCliBody(body) {
  if (process.argv[2] || process.env.PR_BODY !== undefined) {
    return validateBaselineAlignment(body, {
      prAuthor: process.env.PR_AUTHOR,
    });
  }
  return validateBaselineTemplate(body);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = validateCliBody(readBodyFromCli());
  if (!result.ok) {
    console.error(formatBaselineAlignmentFailure(result));
    process.exit(1);
  }
  if (result.dependencyAutomationBypass) {
    console.log('Dependabot PR detected; baseline alignment is not required for automation-authored dependency PRs.');
    process.exit(0);
  }
  console.log(result.mode === 'template' ? 'Baseline alignment template present.' : 'Baseline alignment present.');
}
