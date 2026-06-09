import { createHash } from 'node:crypto';
import {
  ATTESTOR_REVIEW_SURFACE_VERSION,
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
  type AttestorReviewSurface,
  type ReviewCaseDetail,
} from '../../consequence-admission/index.js';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../../release-layer/index.js';

export const ATTESTOR_REVIEW_SURFACE_EXPORT_VERSION =
  'attestor.review-surface-export.v1';

export const ATTESTOR_REVIEW_SURFACE_EXPORT_FILENAME =
  'attestor-review-surface-export.json';

export interface AttestorReviewSurfaceExportDescriptor {
  readonly version: typeof ATTESTOR_REVIEW_SURFACE_EXPORT_VERSION;
  readonly reviewSurfaceVersion: typeof ATTESTOR_REVIEW_SURFACE_VERSION;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly mediaType: 'application/json';
  readonly disposition: 'attachment';
  readonly dataMinimizationSurfaceKind: 'attestor-review-surface';
  readonly includesCaseDetails: true;
  readonly rendersFromReviewSurfaceOnly: true;
  readonly rawPayloadStored: false;
  readonly rawCaseMaterialStored: false;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly complianceClaimed: false;
  readonly customerPepNoBypassProven: false;
  readonly activatesEnforcement: false;
  readonly mutatesPolicyBundle: false;
  readonly grantsAuthority: false;
}

export interface AttestorReviewSurfaceExportArtifact {
  readonly version: typeof ATTESTOR_REVIEW_SURFACE_EXPORT_VERSION;
  readonly exportKind: 'attestor-review-surface-json';
  readonly mediaType: 'application/json';
  readonly filename: typeof ATTESTOR_REVIEW_SURFACE_EXPORT_FILENAME;
  readonly generatedAt: string;
  readonly sourceReviewSurfaceDigest: string;
  readonly sourceDigests: readonly string[];
  readonly tenantDigest: string | null;
  readonly environment: string | null;
  readonly timeWindow: AttestorReviewSurface['timeWindow'];
  readonly reviewSurface: AttestorReviewSurface;
  readonly caseDetails: readonly ReviewCaseDetail[];
  readonly boundary: {
    readonly rawPayloadStored: false;
    readonly rawCaseMaterialStored: false;
    readonly decisionSupportOnly: true;
    readonly autoEnforce: false;
    readonly productionReady: false;
    readonly complianceClaimed: false;
    readonly customerPepNoBypassProven: false;
    readonly reviewMaterialOnly: true;
  };
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateAttestorReviewSurfaceExportArtifactInput {
  readonly reviewSurface: AttestorReviewSurface;
  readonly caseDetails: readonly ReviewCaseDetail[];
  readonly generatedAt?: string | null;
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

function normalizeGeneratedAt(
  value: string | null | undefined,
  fallback: string,
): string {
  const candidate = value ?? fallback;
  const timestamp = new Date(candidate);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Attestor review surface export generatedAt must be an ISO timestamp.');
  }
  return timestamp.toISOString();
}

export function createAttestorReviewSurfaceExportArtifact(
  input: CreateAttestorReviewSurfaceExportArtifactInput,
): AttestorReviewSurfaceExportArtifact {
  const generatedAt = normalizeGeneratedAt(input.generatedAt, input.reviewSurface.generatedAt);
  const payload = {
    version: ATTESTOR_REVIEW_SURFACE_EXPORT_VERSION,
    exportKind: 'attestor-review-surface-json',
    mediaType: 'application/json',
    filename: ATTESTOR_REVIEW_SURFACE_EXPORT_FILENAME,
    generatedAt,
    sourceReviewSurfaceDigest: input.reviewSurface.digest,
    sourceDigests: input.reviewSurface.sourceDigests,
    tenantDigest: input.reviewSurface.tenantDigest,
    environment: input.reviewSurface.environment,
    timeWindow: input.reviewSurface.timeWindow,
    reviewSurface: input.reviewSurface,
    caseDetails: Object.freeze([...input.caseDetails]),
    boundary: Object.freeze({
      rawPayloadStored: false,
      rawCaseMaterialStored: false,
      decisionSupportOnly: true,
      autoEnforce: false,
      productionReady: false,
      complianceClaimed: false,
      customerPepNoBypassProven: false,
      reviewMaterialOnly: true,
    }),
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function serializeAttestorReviewSurfaceExportArtifact(
  artifact: AttestorReviewSurfaceExportArtifact,
): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

export function attestorReviewSurfaceExportHeaders(
  filename = ATTESTOR_REVIEW_SURFACE_EXPORT_FILENAME,
): Record<string, string> {
  if (!/^[A-Za-z0-9._-]+$/u.test(filename)) {
    throw new Error('Attestor review surface export filename must be static and header-safe.');
  }
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-disposition': `attachment; filename="${filename}"`,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  };
}

export function attestorReviewSurfaceExportDescriptor():
AttestorReviewSurfaceExportDescriptor {
  return Object.freeze({
    version: ATTESTOR_REVIEW_SURFACE_EXPORT_VERSION,
    reviewSurfaceVersion: ATTESTOR_REVIEW_SURFACE_VERSION,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    mediaType: 'application/json',
    disposition: 'attachment',
    dataMinimizationSurfaceKind: 'attestor-review-surface',
    includesCaseDetails: true,
    rendersFromReviewSurfaceOnly: true,
    rawPayloadStored: false,
    rawCaseMaterialStored: false,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    complianceClaimed: false,
    customerPepNoBypassProven: false,
    activatesEnforcement: false,
    mutatesPolicyBundle: false,
    grantsAuthority: false,
  });
}
