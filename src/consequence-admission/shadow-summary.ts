import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { GenericAdmissionMode } from './index.js';
import {
  summarizeShadowAdmissionEvents,
  type ShadowAdmissionEvent,
  type ShadowAdmissionEventSummary,
} from './shadow-events.js';
import {
  createShadowPolicySimulationReport,
  type ShadowPolicyRecommendation,
  type ShadowPolicySimulationReport,
} from './shadow-simulation.js';

export const SHADOW_SUMMARY_SURFACE_VERSION =
  'attestor.shadow-summary-surface.v1';

export interface CreateShadowSummarySurfaceInput {
  readonly events: readonly ShadowAdmissionEvent[];
  readonly simulations?: readonly ShadowPolicySimulationReport[] | null;
  readonly generatedAt?: string | null;
  readonly proposedMode?: GenericAdmissionMode | null;
}

export interface ShadowSummarySurface {
  readonly version: typeof SHADOW_SUMMARY_SURFACE_VERSION;
  readonly generatedAt: string;
  readonly storageMode: 'runtime-supplied';
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly eventCount: number;
  readonly summary: ShadowAdmissionEventSummary;
  readonly latestSimulation: ShadowPolicySimulationReport | null;
  readonly recommendations: readonly ShadowPolicyRecommendation[];
  readonly canonical: string;
  readonly digest: string;
}

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Shadow summary ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function latestSimulationFor(
  events: readonly ShadowAdmissionEvent[],
  simulations: readonly ShadowPolicySimulationReport[],
  generatedAt: string,
  proposedMode: GenericAdmissionMode | null | undefined,
): ShadowPolicySimulationReport | null {
  if (simulations.length > 0) {
    return [...simulations].sort((left, right) =>
      right.generatedAt.localeCompare(left.generatedAt),
    )[0] ?? null;
  }

  if (events.length === 0) return null;

  return createShadowPolicySimulationReport({
    events,
    proposedMode: proposedMode ?? 'review',
    generatedAt,
  });
}

export function createShadowSummarySurface(
  input: CreateShadowSummarySurfaceInput,
): ShadowSummarySurface {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const summary = summarizeShadowAdmissionEvents(input.events);
  const latestSimulation = latestSimulationFor(
    input.events,
    input.simulations ?? [],
    generatedAt,
    input.proposedMode,
  );
  const payload = {
    version: SHADOW_SUMMARY_SURFACE_VERSION,
    generatedAt,
    storageMode: 'runtime-supplied',
    productionReady: false,
    rawPayloadStored: false,
    eventCount: input.events.length,
    summary,
    latestSimulation,
    recommendations: latestSimulation?.recommendations ?? Object.freeze([]),
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
