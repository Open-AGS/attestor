/**
 * Attestor Usage Meter — Hosted API First Slice
 *
 * Tracks billable admission run usage per tenant in a local file-backed ledger.
 *
 * BOUNDARY:
 * - Monthly counters keyed by tenantId + month
 * - Local single-node JSON ledger, persisted on disk
 * - Local file lock around write mutations; no shared multi-node billing datastore
 * - Intended for hosted-product shell and quota enforcement
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { withFileLock, writeTextFileAtomic } from './file-store.js';
import { resolvePlanQuotaPolicy } from './plan-catalog.js';

export interface UsageContext {
  tenantId: string;
  planId: string;
  meter: 'monthly_admission_runs';
  period: string;
  used: number;
  quota: number | null;
  remaining: number | null;
  enforced: boolean;
  hardLimit: boolean;
  overage: boolean;
  overageUnits: number;
}

export interface UsageLedgerRecord {
  tenantId: string;
  period: string;
  used: number;
  updatedAt: string;
}

interface UsageLedgerFile {
  version: 1;
  // Storage key retained for backward-compatible ledger files; the public meter
  // exposed by API responses is monthly_admission_runs.
  monthlyPipelineRuns: UsageLedgerRecord[];
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function usageKey(tenantId: string, period: string): string {
  return `${tenantId}:${period}`;
}

function ledgerPath(): string {
  return resolve(process.env.ATTESTOR_USAGE_LEDGER_PATH ?? '.attestor/usage-ledger.json');
}

function defaultLedger(): UsageLedgerFile {
  return { version: 1, monthlyPipelineRuns: [] };
}

function loadLedger(): UsageLedgerFile {
  const path = ledgerPath();
  if (!existsSync(path)) return defaultLedger();
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as UsageLedgerFile;
    if (parsed.version === 1 && Array.isArray(parsed.monthlyPipelineRuns)) return parsed;
  } catch {
    // fall through to safe default
  }
  return defaultLedger();
}

function saveLedger(ledger: UsageLedgerFile): void {
  const path = ledgerPath();
  mkdirSync(dirname(path), { recursive: true });
  writeTextFileAtomic(path, `${JSON.stringify(ledger, null, 2)}\n`);
}

function withUsageLedgerLock<T>(action: (ledger: UsageLedgerFile, path: string) => T): T {
  const path = ledgerPath();
  return withFileLock(path, () => action(loadLedger(), path));
}

function buildUsageContext(
  tenantId: string,
  planId: string | null | undefined,
  quota: number | null | undefined,
  period: string,
  used: number,
): UsageContext {
  const resolvedQuota = typeof quota === 'number' && quota >= 0 ? quota : null;
  const quotaPolicy = resolvePlanQuotaPolicy(planId);
  const overageUnits = resolvedQuota === null ? 0 : Math.max(0, used - resolvedQuota);
  const hardLimit = resolvedQuota !== null && quotaPolicy.hardLimit;
  return {
    tenantId,
    planId: quotaPolicy.planId,
    meter: 'monthly_admission_runs',
    period,
    used,
    quota: resolvedQuota,
    remaining: resolvedQuota === null ? null : Math.max(0, resolvedQuota - used),
    enforced: hardLimit,
    hardLimit,
    overage: overageUnits > 0,
    overageUnits,
  };
}

function loadUsedCount(tenantId: string, period: string): number {
  const ledger = loadLedger();
  return ledger.monthlyPipelineRuns.find((entry) => entry.tenantId === tenantId && entry.period === period)?.used ?? 0;
}

export function getUsageContext(
  tenantId: string,
  planId: string | null | undefined,
  quota: number | null | undefined,
): UsageContext {
  const period = currentPeriod();
  const used = loadUsedCount(tenantId, period);
  return buildUsageContext(tenantId, planId, quota, period, used);
}

export function canConsumePipelineRun(
  tenantId: string,
  planId: string | null | undefined,
  quota: number | null | undefined,
): { allowed: boolean; usage: UsageContext } {
  const usage = getUsageContext(tenantId, planId, quota);
  if (!usage.enforced) return { allowed: true, usage };
  return { allowed: usage.used < (usage.quota ?? 0), usage };
}

export function consumePipelineRun(
  tenantId: string,
  planId: string | null | undefined,
  quota: number | null | undefined,
): UsageContext {
  return withUsageLedgerLock((ledger) => {
    const period = currentPeriod();
    const key = usageKey(tenantId, period);
    const existing = ledger.monthlyPipelineRuns.find((entry) => usageKey(entry.tenantId, entry.period) === key);
    let used: number;
    if (existing) {
      existing.used += 1;
      existing.updatedAt = new Date().toISOString();
      used = existing.used;
    } else {
      used = 1;
      ledger.monthlyPipelineRuns.push({
        tenantId,
        period,
        used,
        updatedAt: new Date().toISOString(),
      });
    }
    saveLedger(ledger);
    return buildUsageContext(tenantId, planId, quota, period, used);
  });
}

export function readUsageLedgerSnapshot(): {
  path: string;
  records: UsageLedgerRecord[];
} {
  const ledger = loadLedger();
  return {
    path: ledgerPath(),
    records: ledger.monthlyPipelineRuns,
  };
}

export function queryUsageLedger(filters?: {
  tenantId?: string | null;
  period?: string | null;
}): UsageLedgerRecord[] {
  const ledger = loadLedger();
  return ledger.monthlyPipelineRuns
    .filter((entry) => !filters?.tenantId || entry.tenantId === filters.tenantId)
    .filter((entry) => !filters?.period || entry.period === filters.period)
    .sort((a, b) => {
      if (a.period !== b.period) return a.period < b.period ? 1 : -1;
      if (a.used !== b.used) return b.used - a.used;
      return a.tenantId.localeCompare(b.tenantId);
    });
}

export function resetUsageMeter(): void {
  const path = ledgerPath();
  if (existsSync(path)) rmSync(path, { force: true });
}
