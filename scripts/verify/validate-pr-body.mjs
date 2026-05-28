#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  formatBaselineAlignmentFailure,
  validateBaselineAlignment,
} from '../check/check-baseline-alignment.mjs';
import {
  formatValidationFailure,
  validatePrContract,
} from './validate-pr-contract.mjs';

function readBodyFromCli() {
  const argPath = process.argv[2];
  if (argPath) return readFileSync(argPath, 'utf8');
  if (process.env.PR_BODY !== undefined) return process.env.PR_BODY;
  return '';
}

export function validatePrBody(body, options = {}) {
  const contract = validatePrContract(body, options);
  const baseline = validateBaselineAlignment(body, options);

  return {
    ok: contract.ok && baseline.ok,
    contract,
    baseline,
  };
}

export function formatPrBodyValidationFailure(result) {
  const lines = ['PR body validation failed.'];
  if (!result.contract.ok) lines.push(formatValidationFailure(result.contract));
  if (!result.baseline.ok) lines.push(formatBaselineAlignmentFailure(result.baseline));
  return lines.join('\n\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = validatePrBody(readBodyFromCli(), {
    prAuthor: process.env.PR_AUTHOR,
  });

  if (!result.ok) {
    console.error(formatPrBodyValidationFailure(result));
    process.exit(1);
  }

  console.log('PR body contract and baseline alignment present.');
}
