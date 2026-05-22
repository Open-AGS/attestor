import type { Hono } from 'hono';
import type { DecisionEnvelope, FilingAdapterRegistry } from '../../../filing/filing-adapter.js';
import type {
  FinanceFilingReleaseCandidate,
  FinanceFilingReleaseMaterial,
} from '../../../release-layer/finance.js';
import type {
  FinanceFilingRow,
  FinanceFilingRowValue,
} from '../../../release-kernel/finance-record-release.js';
import type {
  ReleaseVerificationContext,
  ReleaseVerificationErrorConstructor,
  ReleaseVerificationInput,
  ReleaseTokenIntrospector,
  ReleaseTokenVerificationKey,
} from '../../../release-layer/index.js';
import { logger } from '../../../utils/logger.js';
import type { RequestPathReleaseTokenIntrospectionStore } from '../../release-authority-request-path.js';
import {
  clientSafeInternalError,
  clientSafeProblemDetail,
  routeErrorKind,
  safeAuthenticateDescription,
} from '../route-response-helpers.js';

export interface PipelineFilingRoutesDeps {
  FINANCE_FILING_ADAPTER_ID: string;
  buildFinanceFilingReleaseMaterial(candidate: FinanceFilingReleaseCandidate): FinanceFilingReleaseMaterial;
  apiReleaseIntrospectionStore: RequestPathReleaseTokenIntrospectionStore;
  filingRegistry: Pick<FilingAdapterRegistry, 'get' | 'list'>;
  buildCounterpartyEnvelope(
    runId: string,
    decision: string,
    certificateId: string | null,
    evidenceChainTerminal: string,
    rows: readonly Record<string, unknown>[],
    proofMode: string,
  ): DecisionEnvelope;
  apiReleaseVerificationKeyPromise: Promise<ReleaseTokenVerificationKey>;
  resolveReleaseTokenFromRequest(request: Request): string;
  verifyReleaseAuthorization(input: ReleaseVerificationInput): Promise<ReleaseVerificationContext>;
  apiReleaseIntrospector: ReleaseTokenIntrospector;
  ReleaseVerificationError: ReleaseVerificationErrorConstructor;
}

export function isReleaseBoundFilingAdapter(
  adapterId: string,
  financeFilingAdapterId: string,
): boolean {
  return adapterId === financeFilingAdapterId;
}

function isFinanceFilingRowValue(value: unknown): value is FinanceFilingRowValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function parseFinanceFilingRows(rows: unknown): readonly FinanceFilingRow[] | null {
  if (!Array.isArray(rows)) return null;
  const normalized: FinanceFilingRow[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) return null;
    const entries = Object.entries(row);
    if (!entries.every(([, value]) => isFinanceFilingRowValue(value))) return null;
    normalized.push(Object.freeze(Object.fromEntries(entries)) as FinanceFilingRow);
  }
  return Object.freeze(normalized);
}

export function registerPipelineFilingRoutes(app: Hono, deps: PipelineFilingRoutesDeps): void {
  const {
    FINANCE_FILING_ADAPTER_ID,
    buildFinanceFilingReleaseMaterial,
    apiReleaseIntrospectionStore,
    filingRegistry,
    buildCounterpartyEnvelope,
    apiReleaseVerificationKeyPromise,
    resolveReleaseTokenFromRequest,
    verifyReleaseAuthorization,
    apiReleaseIntrospector,
    ReleaseVerificationError,
  } = deps;


// Filing Export

app.post('/api/v1/filing/export', async (c) => {
  try {
    let body: Record<string, unknown>;
    try {
      const parsed = await c.req.json();
      body = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return c.json(clientSafeProblemDetail(
        'invalid_request',
        'Request body must be valid JSON.',
      ), 400);
    }
    const { adapterId, runId, decision, certificateId, evidenceChainTerminal, rows, proofMode } = body;
    if (!adapterId || !runId || !rows) {
      return c.json({ error: 'adapterId, runId, and rows are required' }, 400);
    }
    const rowsArray = parseFinanceFilingRows(rows);
    if (!rowsArray) {
      return c.json({
        error: 'rows must be an array of JSON objects with string, number, boolean, or null values',
      }, 400);
    }
    const adapterIdString = String(adapterId);
    const runIdString = String(runId);
    const decisionString = typeof decision === 'string' ? decision : 'unknown';
    const certificateIdString = typeof certificateId === 'string' ? certificateId : null;
    const evidenceChainTerminalString =
      typeof evidenceChainTerminal === 'string' ? evidenceChainTerminal : '';
    const proofModeString = typeof proofMode === 'string' ? proofMode : 'unknown';

    const adapter = filingRegistry.get(adapterIdString);
    if (!adapter) {
      return c.json({ error: `Filing adapter '${adapterId}' not registered. Available: ${filingRegistry.list().map((a) => a.id).join(', ')}` }, 404);
    }

    if (!isReleaseBoundFilingAdapter(adapterIdString, FINANCE_FILING_ADAPTER_ID)) {
      return c.json(
        {
          error: 'filing_adapter_not_release_bound',
          error_description:
            `Filing adapter '${adapterId}' is registered but not release-bound for this export route. Add an explicit release material and token verification binding before enabling it.`,
        },
        403,
      );
    }

    let verifiedRelease: ReleaseVerificationContext | null = null;
    const material = buildFinanceFilingReleaseMaterial({
      adapterId: adapterIdString,
      runId: runIdString,
      decision: decisionString,
      certificateId: certificateIdString,
      evidenceChainTerminal: evidenceChainTerminalString,
      rows: rowsArray,
      proofMode: proofModeString,
    });

    try {
      const verificationKey = await apiReleaseVerificationKeyPromise;
      const token = resolveReleaseTokenFromRequest(c.req.raw);
      verifiedRelease = await verifyReleaseAuthorization({
        token,
        verificationKey,
        audience: material.target.id,
        expectedTargetId: material.target.id,
        expectedOutputHash: material.hashBundle.outputHash,
        expectedConsequenceHash: material.hashBundle.consequenceHash,
        introspector: apiReleaseIntrospector,
        usageStore: apiReleaseIntrospectionStore,
        consumeOnSuccess: true,
        tokenTypeHint: 'attestor_release_token',
        resourceServerId: 'attestor.api.finance.filing-export',
      });
    } catch (error) {
      if (error instanceof ReleaseVerificationError) {
        c.header('WWW-Authenticate', error.challenge);
        return c.json(error.toResponseBody(), error.status);
      }

      logger.warn('api.filingExport', 'Release verification failed with a redacted client response', {
        route: '/api/v1/filing/export',
        errorKind: routeErrorKind(error),
      });
      const description = 'Release verification failed.';
      c.header(
        'WWW-Authenticate',
        `Bearer realm="attestor-release", error="invalid_token", error_description="${safeAuthenticateDescription(description)}"`,
      );
      return c.json(
        {
          error: 'invalid_token',
          error_description: description,
        },
        401,
      );
    }

    // Build decision envelope from provided data
    const envelope = buildCounterpartyEnvelope(
      runIdString, decisionString, certificateIdString,
      evidenceChainTerminalString, rowsArray, proofModeString,
    );

    const mapping = adapter.mapToTaxonomy(envelope);
    const pkg = adapter.generatePackage(mapping);
    pkg.evidenceLink = {
      runId: runIdString,
      certificateId: certificateIdString,
      evidenceChainTerminal: evidenceChainTerminalString,
    };
    const { issueFilingPackage } = await import('../../../filing/report-package.js');
    pkg.issuedPackage = await issueFilingPackage(pkg);

    return c.json({
      adapterId: adapter.id,
      format: adapter.format,
      taxonomyVersion: adapter.taxonomyVersion,
      mapping: {
        mappedCount: mapping.mapped.length,
        unmappedCount: mapping.unmapped.length,
        coveragePercent: mapping.coveragePercent,
      },
      package: pkg,
      release: verifiedRelease
        ? {
            authorized: true,
            decisionId: verifiedRelease.verification.claims.decision_id,
            tokenId: verifiedRelease.verification.claims.jti,
            targetId: verifiedRelease.verification.claims.aud,
            introspectionVerified: verifiedRelease.introspection?.active ?? false,
          }
        : null,
    });
  } catch (err) {
    logger.error('api.filingExport', 'Filing export failed with a redacted client response', {
      route: '/api/v1/filing/export',
      errorKind: routeErrorKind(err),
    });
    return c.json(clientSafeInternalError('Filing export failed.'), 500);
  }
});
}
