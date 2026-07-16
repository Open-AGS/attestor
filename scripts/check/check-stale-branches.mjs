#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function remoteBranches() {
  const output = runGit(['branch', '-r', '--format=%(refname:short)']);
  if (!output) return [];
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((branch) => branch !== 'origin' && branch !== 'origin/HEAD');
}

function countAheadBehind(branch) {
  const output = runGit(['rev-list', '--left-right', '--count', `origin/master...${branch}`]);
  const [behindRaw, aheadRaw] = output.split(/\s+/u);
  return {
    ahead: Number.parseInt(aheadRaw ?? '0', 10),
    behind: Number.parseInt(behindRaw ?? '0', 10),
  };
}

function isMergedIntoMaster(branch) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', branch, 'origin/master'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readOpenPrHeads(filePath) {
  if (!filePath) return [];
  return [
    ...new Set(
      readFileSync(filePath, 'utf8')
        .split(/\r?\n/u)
        .map((line) => line.trim().replace(/^origin\//u, ''))
        .filter(Boolean),
    ),
  ];
}

const requireMasterOnly = process.argv.includes('--require-master-only');
const requireActivePrOnly = process.argv.includes('--require-active-pr-only');
const openPrHeadsFile = argumentValue('--open-pr-heads-file');

if (requireMasterOnly && requireActivePrOnly) {
  console.error('Choose either --require-master-only or --require-active-pr-only.');
  process.exit(1);
}

if (requireActivePrOnly && !openPrHeadsFile) {
  console.error('--require-active-pr-only requires --open-pr-heads-file.');
  process.exit(1);
}

const branches = remoteBranches();
const nonMaster = branches.filter((branch) => branch !== 'origin/master');
const openPrHeads = readOpenPrHeads(openPrHeadsFile);
const openPrHeadSet = new Set(openPrHeads);
const activePrBranches = nonMaster.filter((branch) =>
  openPrHeadSet.has(branch.replace(/^origin\//u, '')),
);
const orphanedRemoteBranches = nonMaster.filter(
  (branch) => !openPrHeadSet.has(branch.replace(/^origin\//u, '')),
);
const codexBranches = nonMaster.filter((branch) => branch.startsWith('origin/codex/'));
const mergedCodex = codexBranches.filter(isMergedIntoMaster);
const unmergedCodex = codexBranches.filter((branch) => !isMergedIntoMaster(branch));

const report = {
  totalRemoteBranches: branches.length,
  nonMasterBranches: nonMaster.map((branch) => branch.replace(/^origin\//u, '')),
  openPrHeadBranches: openPrHeads,
  activePrBranches: activePrBranches.map((branch) => branch.replace(/^origin\//u, '')),
  orphanedRemoteBranches: orphanedRemoteBranches.map((branch) =>
    branch.replace(/^origin\//u, ''),
  ),
  mergedCodexBranches: mergedCodex.map((branch) => branch.replace(/^origin\//u, '')),
  unmergedCodexBranches: unmergedCodex.map((branch) => ({
    branch: branch.replace(/^origin\//u, ''),
    ...countAheadBehind(branch),
  })),
  requireMasterOnly,
  requireActivePrOnly,
};

console.log(JSON.stringify(report, null, 2));

if (mergedCodex.length > 0) {
  console.error('Merged codex/* branches remain on the remote. Delete them after verifying origin/master contains them.');
  process.exitCode = 1;
}

if (requireMasterOnly && nonMaster.length > 0) {
  console.error('Remote branch policy requires master-only public branches.');
  process.exitCode = 1;
}

if (requireActivePrOnly && orphanedRemoteBranches.length > 0) {
  console.error('Only master and active same-repository PR branches may exist on the remote.');
  process.exitCode = 1;
}
