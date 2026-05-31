import {
  ATTESTOR_REVIEW_SURFACE_VERSION,
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from '../../consequence-admission/index.js';
import { ATTESTOR_REVIEW_SURFACE_EXPORT_VERSION } from './attestor-review-surface-export.js';
import { ATTESTOR_REVIEW_SURFACE_HTML_PREVIEW_VERSION } from './attestor-review-surface-html-preview.js';

export const ATTESTOR_REVIEW_SURFACE_ROUTE_HARDENING_VERSION =
  'attestor.review-surface-route-hardening.v1';

export type AttestorReviewSurfaceHostedRouteKind =
  | 'json-review-surface'
  | 'html-preview'
  | 'json-export'
  | 'json-case-detail';

export interface AttestorReviewSurfaceHostedRouteHardening {
  readonly method: 'GET';
  readonly path: string;
  readonly kind: AttestorReviewSurfaceHostedRouteKind;
  readonly cacheControl: 'no-store';
  readonly sourceSurfaceOnly: true;
  readonly rawPayloadStored: false;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly complianceClaimed: false;
  readonly requiredHeaders: readonly string[];
}

export interface AttestorReviewSurfaceRouteHardeningDescriptor {
  readonly version: typeof ATTESTOR_REVIEW_SURFACE_ROUTE_HARDENING_VERSION;
  readonly reviewSurfaceVersion: typeof ATTESTOR_REVIEW_SURFACE_VERSION;
  readonly htmlPreviewVersion: typeof ATTESTOR_REVIEW_SURFACE_HTML_PREVIEW_VERSION;
  readonly exportVersion: typeof ATTESTOR_REVIEW_SURFACE_EXPORT_VERSION;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly routeCount: number;
  readonly routes: readonly AttestorReviewSurfaceHostedRouteHardening[];
  readonly prohibitedRawClasses: readonly string[];
  readonly sourceAnchors: readonly string[];
  readonly authorityBoundary: {
    readonly canAdmit: false;
    readonly canBlockAction: false;
    readonly canGrantAuthority: false;
    readonly canReduceEvidenceRequirements: false;
    readonly canActivateEnforcement: false;
    readonly canMutatePolicyBundle: false;
    readonly reviewMaterialOnly: true;
  };
  readonly rawPayloadStored: false;
  readonly rawCaseMaterialStored: false;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly complianceClaimed: false;
  readonly customerPepNoBypassProven: false;
  readonly hostedUiProductReady: false;
}

export const ATTESTOR_REVIEW_SURFACE_HOSTED_ROUTES = Object.freeze([
  Object.freeze({
    method: 'GET',
    path: '/api/v1/shadow/review-surface',
    kind: 'json-review-surface',
    cacheControl: 'no-store',
    sourceSurfaceOnly: true,
    rawPayloadStored: false,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    complianceClaimed: false,
    requiredHeaders: Object.freeze(['cache-control']),
  }),
  Object.freeze({
    method: 'GET',
    path: '/api/v1/shadow/review-surface/view',
    kind: 'html-preview',
    cacheControl: 'no-store',
    sourceSurfaceOnly: true,
    rawPayloadStored: false,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    complianceClaimed: false,
    requiredHeaders: Object.freeze([
      'cache-control',
      'content-security-policy',
      'x-content-type-options',
      'referrer-policy',
      'x-frame-options',
    ]),
  }),
  Object.freeze({
    method: 'GET',
    path: '/api/v1/shadow/review-surface/export',
    kind: 'json-export',
    cacheControl: 'no-store',
    sourceSurfaceOnly: true,
    rawPayloadStored: false,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    complianceClaimed: false,
    requiredHeaders: Object.freeze([
      'cache-control',
      'content-disposition',
      'x-content-type-options',
      'referrer-policy',
    ]),
  }),
  Object.freeze({
    method: 'GET',
    path: '/api/v1/shadow/review-surface/cases/:caseDigest',
    kind: 'json-case-detail',
    cacheControl: 'no-store',
    sourceSurfaceOnly: true,
    rawPayloadStored: false,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    complianceClaimed: false,
    requiredHeaders: Object.freeze(['cache-control']),
  }),
] satisfies readonly AttestorReviewSurfaceHostedRouteHardening[]);

export function attestorReviewSurfaceRouteHardeningDescriptor():
AttestorReviewSurfaceRouteHardeningDescriptor {
  return Object.freeze({
    version: ATTESTOR_REVIEW_SURFACE_ROUTE_HARDENING_VERSION,
    reviewSurfaceVersion: ATTESTOR_REVIEW_SURFACE_VERSION,
    htmlPreviewVersion: ATTESTOR_REVIEW_SURFACE_HTML_PREVIEW_VERSION,
    exportVersion: ATTESTOR_REVIEW_SURFACE_EXPORT_VERSION,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    routeCount: ATTESTOR_REVIEW_SURFACE_HOSTED_ROUTES.length,
    routes: ATTESTOR_REVIEW_SURFACE_HOSTED_ROUTES,
    prohibitedRawClasses: Object.freeze([
      'raw-prompts',
      'raw-payloads',
      'raw-provider-bodies',
      'raw-customer-identifiers',
      'payment-details',
      'wallet-material',
      'credentials',
      'private-thresholds',
      'replay-keys',
      'downstream-responses',
      'provider-error-bodies',
    ]),
    sourceAnchors: Object.freeze([
      'RFC 9111 Cache-Control no-store',
      'RFC 8259 JSON',
      'RFC 6266 Content-Disposition attachment',
      'OWASP XSS Prevention Cheat Sheet output encoding',
      'OWASP API3:2023 Broken Object Property Level Authorization',
    ]),
    authorityBoundary: Object.freeze({
      canAdmit: false,
      canBlockAction: false,
      canGrantAuthority: false,
      canReduceEvidenceRequirements: false,
      canActivateEnforcement: false,
      canMutatePolicyBundle: false,
      reviewMaterialOnly: true,
    }),
    rawPayloadStored: false,
    rawCaseMaterialStored: false,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    complianceClaimed: false,
    customerPepNoBypassProven: false,
    hostedUiProductReady: false,
  });
}
