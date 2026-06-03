import {
  ATTESTOR_SERVICE_VERSION,
  BASE,
  COUNTERPARTY_FIXTURE,
  COUNTERPARTY_INTENT,
  COUNTERPARTY_REPORT,
  COUNTERPARTY_REPORT_CONTRACT,
  COUNTERPARTY_SQL,
  JSZip,
  cookieHeaderFromResponse,
  currentTotpStepIndex,
  generateCurrentTotpCode,
  issueTenantApiKey,
  metricSamples,
  ok,
  readAsyncDeadLetterStoreSnapshot,
  readFileSync,
  readUsageLedgerSnapshot,
  revokeTenantApiKey,
  stripe,
  unsignedBearerToken,
  waitForJobStatus,
  waitForRateLimitWindowHead,
  waitForTotpStepAfter,
} from './helpers.js';
import type { LiveApiHostedContext } from './helpers.js';

export async function runRuntimePipelineFlow(): Promise<void> {
    console.log('  [GET /api/v1/health]');
    {
      const res = await fetch(`${BASE}/api/v1/health`);
      ok(res.status === 200, 'Health: status 200');
      ok(Boolean(res.headers.get('x-attestor-trace-id')), 'Health: trace id header present');
      ok(Boolean(res.headers.get('traceparent')), 'Health: traceparent header present');
      const body = await res.json() as any;
      ok(body.status === 'healthy', 'Health: status=healthy');
      ok(body.version === ATTESTOR_SERVICE_VERSION, 'Health: version correct');
      ok(body.engine === 'attestor', 'Health: engine marker exposed');
      ok(!('domains' in body), 'Health: domain registry remains on /api/v1/domains');
      console.log(`    status=${body.status}, version=${body.version}, engine=${body.engine}`);
    }

    // ═══ DOMAINS ENDPOINT ═══
    console.log('\n  [GET /api/v1/domains]');
    {
      const res = await fetch(`${BASE}/api/v1/domains`);
      ok(res.status === 200, 'Domains: status 200');
      const body = await res.json() as any;
      ok(body.domains.length === 2, 'Domains: 2 domains');
      const finance = body.domains.find((d: any) => d.id === 'finance');
      ok(finance !== undefined, 'Domains: finance found');
      ok(finance.clauseCount === 5, 'Domains: finance has 5 clauses');
      const healthcare = body.domains.find((d: any) => d.id === 'healthcare');
      ok(healthcare !== undefined, 'Domains: healthcare found');
      ok(healthcare.clauseCount === 5, 'Domains: healthcare has 5 clauses');
      console.log(`    finance: ${finance.clauseCount} clauses, healthcare: ${healthcare.clauseCount} clauses`);
    }

    console.log('\n  [GET /api/v1/connectors]');
    {
      const res = await fetch(`${BASE}/api/v1/connectors`);
      ok(res.status === 200, 'Connectors: status 200');
      const body = await res.json() as any;
      ok(Array.isArray(body.connectors), 'Connectors: connectors is array');
      const snowflake = body.connectors.find((d: any) => d.id === 'snowflake');
      ok(snowflake !== undefined, 'Connectors: snowflake found');
      ok(typeof snowflake.displayName === 'string', 'Connectors: display name exposed');
      ok(!('configured' in snowflake), 'Connectors: configured state is not exposed on public registry');
      console.log(`    snowflake: displayName=${snowflake.displayName}`);
    }

    // ═══ PIPELINE RUN — unsigned ═══
    console.log('\n  [POST /api/v1/pipeline/run — unsigned]');
    {
      const res = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: COUNTERPARTY_INTENT,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: false,
        }),
      });
      ok(res.status === 200, 'Pipeline(unsigned): status 200');
      const body = await res.json() as any;
      ok(body.decision === 'pass', 'Pipeline(unsigned): decision=pass');
      ok(body.scoring.scorersRun === 8, 'Pipeline(unsigned): 8 scorers');
      ok(body.proofMode === 'offline_fixture', 'Pipeline(unsigned): proof=fixture');
      ok(body.auditChainIntact === true, 'Pipeline(unsigned): audit intact');
      ok(body.certificate === null, 'Pipeline(unsigned): no certificate (unsigned)');
      // Tenant context (anonymous sentinel when no ATTESTOR_TENANT_KEYS)
      ok(body.tenantContext !== undefined, 'Pipeline(unsigned): tenantContext present');
      ok(body.tenantContext.tenantId === '__attestor_anonymous__', 'Pipeline(unsigned): tenant=anonymous sentinel');
      console.log(`    decision=${body.decision}, tenant=${body.tenantContext.tenantId}, proof=${body.proofMode}`);
    }

    // ═══ PIPELINE RUN — signed with certificate ═══
    console.log('\n  [POST /api/v1/pipeline/run — signed]');
    let fullCert: any = null;
    let savedPubKey: string = '';
    let savedTrustChain: any = null;
    let savedCaPublicKeyPem: string | null = null;
    let filingRelease: any = null;
    let reviewRequiredFilingRelease: any = null;
    let reviewQueueId: string | null = null;
    let approvedReleaseToken: string | null = null;
    let breakGlassFilingRelease: any = null;
    let breakGlassReviewQueueId: string | null = null;
    let breakGlassReleaseToken: string | null = null;
    let breakGlassEvidencePackId: string | null = null;
    {
      const res = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: COUNTERPARTY_INTENT,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: true,
        }),
      });
      ok(res.status === 200, 'Pipeline(signed): status 200');
      const body = await res.json() as any;
      ok(body.decision === 'pass', 'Pipeline(signed): decision=pass');
      ok(body.certificate !== null, 'Pipeline(signed): certificate present');
      ok(body.certificate.type === 'attestor.certificate.v1', 'Pipeline(signed): full cert type');
      ok(body.certificate.signing?.algorithm === 'ed25519', 'Pipeline(signed): ed25519');
      ok(body.certificate.certificateId?.startsWith('cert_'), 'Pipeline(signed): cert ID');
      ok(body.certificate.signing?.signature?.length === 128, 'Pipeline(signed): 64-byte signature');
      ok(body.verification !== null, 'Pipeline(signed): verification present');
      ok(body.verification.cryptographic.valid === true, 'Pipeline(signed): crypto valid');
      ok(body.publicKeyPem !== null, 'Pipeline(signed): public key returned');
      fullCert = body.certificate;
      savedPubKey = body.publicKeyPem;
      savedTrustChain = body.trustChain;
      savedCaPublicKeyPem = body.caPublicKeyPem;
      ok(body.trustChain !== null, 'Pipeline(signed): trust chain present');
      ok(body.trustChain.type === 'attestor.trust_chain.v1', 'Pipeline(signed): trust chain type');
      ok(body.trustChain.ca?.type === 'attestor.ca_certificate.v1', 'Pipeline(signed): CA cert in chain');
      ok(body.trustChain.leaf?.type === 'attestor.leaf_certificate.v1', 'Pipeline(signed): leaf cert in chain');
      ok(body.filingPackage !== null, 'Pipeline(signed): filing package present');
      ok(body.filingPackage.adapterId === 'xbrl-us-gaap-2024', 'Pipeline(signed): filing package adapter');
      ok(body.filingPackage.issuedPackage.fileExtension === '.xbr', 'Pipeline(signed): filing package uses .xbr');
      ok(body.filingPackage.issuedPackage.archive.base64.length > 0, 'Pipeline(signed): filing archive base64 present');
      ok(body.release?.filingExport !== null, 'Pipeline(signed): filing release artifact present');
      ok(body.release.filingExport.targetId === 'sec.edgar.filing.prepare', 'Pipeline(signed): filing release target bound');
      ok(body.release.filingExport.introspectionRequired === true, 'Pipeline(signed): filing release requires active introspection');
      ok(typeof body.release.filingExport.token === 'string', 'Pipeline(signed): filing release token present');
      ok(typeof body.release.filingExport.outputHash === 'string', 'Pipeline(signed): filing release output hash present');
      ok(typeof body.release.filingExport.consequenceHash === 'string', 'Pipeline(signed): filing release consequence hash present');
      ok(typeof body.release.filingExport.evidencePackId === 'string', 'Pipeline(signed): durable evidence pack id present');
      ok(typeof body.release.filingExport.evidencePackPath === 'string', 'Pipeline(signed): durable evidence pack export path present');
      ok(typeof body.release.filingExport.evidencePackDigest === 'string', 'Pipeline(signed): durable evidence pack digest present');
      ok(body.release.filingExport.candidate.adapterId === 'xbrl-us-gaap-2024', 'Pipeline(signed): filing release candidate adapter');
      ok(Array.isArray(body.release.filingExport.candidate.rows), 'Pipeline(signed): filing release candidate rows present');
      ok(body.release?.communication !== null, 'Pipeline(signed): communication shadow release present');
      ok(body.release.communication.policyRolloutMode === 'dry-run', 'Pipeline(signed): communication flow launches in dry-run rollout mode');
      ok(body.release.communication.policyEvaluationMode === 'shadow', 'Pipeline(signed): communication flow evaluates in shadow mode');
      ok(body.release.communication.decisionStatus === 'accepted', 'Pipeline(signed): communication shadow path would accept the bounded reviewer summary');
      ok(body.release?.action !== null, 'Pipeline(signed): action shadow release present');
      ok(body.release.action.policyRolloutMode === 'dry-run', 'Pipeline(signed): action flow launches in dry-run rollout mode');
      ok(body.release.action.policyEvaluationMode === 'shadow', 'Pipeline(signed): action flow evaluates in shadow mode');
      ok(body.release.action.decisionStatus === 'review-required', 'Pipeline(signed): action shadow path still requires human authority');
      filingRelease = body.release.filingExport;
      console.log(`    cert=${fullCert.certificateId}, chain: CA=${body.trustChain.ca.name}, leaf=${body.trustChain.leaf.subject}`);
    }

    // ═══ PIPELINE RUN — review-required candidate ═══
    console.log('\n  [POST /api/v1/pipeline/run — review-required release candidate]');
    {
      const reviewRequiredIntent = {
        ...COUNTERPARTY_INTENT,
        materialityTier: 'high',
      };
      const res = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: reviewRequiredIntent,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: true,
        }),
      });
      ok(res.status === 200, 'Pipeline(review queue): status 200');
      const body = await res.json() as any;
      ok(body.decision === 'pending_approval', 'Pipeline(review queue): finance decision is pending approval');
      ok(body.release?.filingExport !== null, 'Pipeline(review queue): filing release artifact present');
      ok(body.release.filingExport.decisionStatus === 'hold', 'Pipeline(review queue): release decision is held pending reviewer authority');
      ok(body.release.filingExport.token === null, 'Pipeline(review queue): no release token issued yet');
      ok(typeof body.release.filingExport.reviewQueueId === 'string', 'Pipeline(review queue): reviewer queue id present');
      ok(typeof body.release.filingExport.reviewQueuePath === 'string', 'Pipeline(review queue): reviewer queue path present');
      ok(body.release.communication?.policyEvaluationMode === 'shadow', 'Pipeline(review queue): communication flow remains shadowed on held finance candidates');
      ok(body.release.action?.policyEvaluationMode === 'shadow', 'Pipeline(review queue): action flow remains shadowed on held finance candidates');
      reviewRequiredFilingRelease = body.release.filingExport;
      reviewQueueId = body.release.filingExport.reviewQueueId;
      console.log(`    reviewQueue=${reviewQueueId}, releaseDecision=${body.release.filingExport.decisionId}`);
    }

    // ═══ PIPELINE RUN — break-glass review-required candidate ═══
    console.log('\n  [POST /api/v1/pipeline/run — break-glass review-required candidate]');
    {
      const breakGlassIntent = {
        ...COUNTERPARTY_INTENT,
        materialityTier: 'high',
      };
      const res = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: breakGlassIntent,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: true,
        }),
      });
      ok(res.status === 200, 'Pipeline(break-glass queue): status 200');
      const body = await res.json() as any;
      ok(body.decision === 'pending_approval', 'Pipeline(break-glass queue): finance decision is pending approval');
      ok(body.release?.filingExport !== null, 'Pipeline(break-glass queue): filing release artifact present');
      ok(body.release.filingExport.decisionStatus === 'hold', 'Pipeline(break-glass queue): release decision is held pending reviewer authority');
      ok(body.release.filingExport.token === null, 'Pipeline(break-glass queue): no release token issued yet');
      ok(typeof body.release.filingExport.reviewQueueId === 'string', 'Pipeline(break-glass queue): reviewer queue id present');
      breakGlassFilingRelease = body.release.filingExport;
      breakGlassReviewQueueId = body.release.filingExport.reviewQueueId;
      console.log(`    breakGlassReviewQueue=${breakGlassReviewQueueId}, releaseDecision=${body.release.filingExport.decisionId}`);
    }

    // ═══ REVIEWER QUEUE — list/detail/inbox ═══
    console.log('\n  [GET /api/v1/admin/release-reviews — reviewer inbox]');
    {
      const listRes = await fetch(`${BASE}/api/v1/admin/release-reviews`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(listRes.status === 200, 'Reviewer inbox(list): status 200');
      const listBody = await listRes.json() as any;
      ok(listBody.totalPending >= 1, 'Reviewer inbox(list): at least one pending review is listed');
      ok(Array.isArray(listBody.items), 'Reviewer inbox(list): items array present');
      const listedItem = listBody.items.find((item: any) => item.id === reviewQueueId);
      ok(Boolean(listedItem), 'Reviewer inbox(list): newly queued review is discoverable');
      ok(listedItem.riskClass === 'R4', 'Reviewer inbox(list): queued review keeps R4 risk');

      const detailRes = await fetch(`${BASE}/api/v1/admin/release-reviews/${reviewQueueId}`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(detailRes.status === 200, 'Reviewer inbox(detail): status 200');
      const detailBody = await detailRes.json() as any;
      ok(detailBody.review.id === reviewQueueId, 'Reviewer inbox(detail): requested queue item returned');
      ok(detailBody.review.candidate.rowCount > 0, 'Reviewer inbox(detail): candidate preview present');
      ok(Array.isArray(detailBody.review.timeline) && detailBody.review.timeline.length >= 2, 'Reviewer inbox(detail): timeline included');

      const inboxHtmlRes = await fetch(`${BASE}/api/v1/admin/release-reviews/inbox`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(inboxHtmlRes.status === 200, 'Reviewer inbox(html): status 200');
      ok((inboxHtmlRes.headers.get('content-type') ?? '').includes('text/html'), 'Reviewer inbox(html): text/html content type');
      const inboxHtml = await inboxHtmlRes.text();
      ok(inboxHtml.includes('Human authority before consequence.'), 'Reviewer inbox(html): reviewer inbox headline rendered');
      ok(inboxHtml.includes(String(reviewQueueId)), 'Reviewer inbox(html): queued review is rendered into the inbox view');

      const detailHtmlRes = await fetch(`${BASE}/api/v1/admin/release-reviews/${reviewQueueId}/view`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(detailHtmlRes.status === 200, 'Reviewer inbox(detail html): status 200');
      const detailHtml = await detailHtmlRes.text();
      ok(detailHtml.includes('Release review packet'), 'Reviewer inbox(detail html): detail packet headline rendered');
      ok(detailHtml.includes('Candidate preview'), 'Reviewer inbox(detail html): candidate preview section rendered');
      console.log(`    pending=${listBody.totalPending}, review=${reviewQueueId}`);
    }

    // ═══ REVIEWER QUEUE — named review and dual approval ═══
    console.log('\n  [POST /api/v1/admin/release-reviews/:id/approve — named review + dual approval]');
    {
      const firstApprovalRes = await fetch(`${BASE}/api/v1/admin/release-reviews/${reviewQueueId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewerId: 'reviewer.alpha',
          reviewerName: 'Alpha Reviewer',
          reviewerRole: 'financial_reporting_manager',
          note: 'Finance target binding and row preview look correct.',
        }),
      });
      ok(firstApprovalRes.status === 200, 'Reviewer approve(first): status 200');
      const firstApprovalBody = await firstApprovalRes.json() as any;
      ok(firstApprovalBody.review.status === 'pending-review', 'Reviewer approve(first): R4 item remains pending after first approval');
      ok(firstApprovalBody.review.approvalsRecorded === 1, 'Reviewer approve(first): first approval is counted');
      ok(firstApprovalBody.releaseToken === null, 'Reviewer approve(first): no token issued before dual approval closes');

      const secondApprovalRes = await fetch(`${BASE}/api/v1/admin/release-reviews/${reviewQueueId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewerId: 'reviewer.beta',
          reviewerName: 'Beta Reviewer',
          reviewerRole: 'financial_reporting_manager',
          note: 'Second approval closes the regulated release authority path.',
        }),
      });
      ok(secondApprovalRes.status === 200, 'Reviewer approve(second): status 200');
      const secondApprovalBody = await secondApprovalRes.json() as any;
      ok(secondApprovalBody.review.status === 'approved', 'Reviewer approve(second): review queue item closes as approved');
      ok(secondApprovalBody.review.authorityState === 'approved', 'Reviewer approve(second): authority state becomes approved');
      ok(typeof secondApprovalBody.releaseToken?.token === 'string', 'Reviewer approve(second): release token is issued after dual approval');
      ok(typeof secondApprovalBody.releaseToken?.policyContext?.policyHash === 'string', 'Reviewer approve(second): release token response carries structured policy context');
      ok(typeof secondApprovalBody.evidencePack?.evidencePackId === 'string', 'Reviewer approve(second): durable evidence pack is exported after dual approval');
      ok(typeof secondApprovalBody.evidencePack?.exportPath === 'string', 'Reviewer approve(second): durable evidence pack export path returned');
      ok(typeof secondApprovalBody.evidencePack?.policyContext?.policyHash === 'string', 'Reviewer approve(second): evidence pack response carries structured policy context');
      approvedReleaseToken = secondApprovalBody.releaseToken.token;

      const listAfterApprovalRes = await fetch(`${BASE}/api/v1/admin/release-reviews`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(listAfterApprovalRes.status === 200, 'Reviewer inbox(after approval): status 200');
      const listAfterApprovalBody = await listAfterApprovalRes.json() as any;
      ok(!listAfterApprovalBody.items.some((item: any) => item.id === reviewQueueId), 'Reviewer inbox(after approval): approved item no longer appears in pending inbox');
      console.log(`    approvals=2/2, releaseTokenIssued=${Boolean(secondApprovalBody.releaseToken.tokenId)}`);
    }

    // ═══ REVIEWER QUEUE — break-glass override ═══
    console.log('\n  [POST /api/v1/admin/release-reviews/:id/override — break-glass release]');
    {
      const overrideRes = await fetch(`${BASE}/api/v1/admin/release-reviews/${breakGlassReviewQueueId}/override`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reasonCode: 'regulatory_deadline',
          ticketId: 'INC-2048',
          requestedById: 'ops.breakglass',
          requestedByName: 'Operations Override',
          requestedByRole: 'financial_reporting_manager',
          note: 'Emergency filing preparation needed before market open.',
        }),
      });
      ok(overrideRes.status === 200, 'Reviewer override: status 200');
      const overrideBody = await overrideRes.json() as any;
      ok(overrideBody.review.status === 'overridden', 'Reviewer override: queue item closes as overridden');
      ok(overrideBody.review.authorityState === 'overridden', 'Reviewer override: authority state becomes overridden');
      ok(overrideBody.review.releaseDecisionStatus === 'overridden', 'Reviewer override: release decision status becomes overridden');
      ok(overrideBody.review.overrideGrant?.reasonCode === 'regulatory_deadline', 'Reviewer override: override summary preserves reason code');
      ok(typeof overrideBody.releaseToken?.token === 'string', 'Reviewer override: short-lived release token issued');
      ok(overrideBody.releaseToken.override === true, 'Reviewer override: release token is flagged as override');
      ok(Number(overrideBody.releaseToken.ttlSeconds) <= 60, 'Reviewer override: release token is short-lived');
      ok(typeof overrideBody.releaseToken.policyContext?.policyHash === 'string', 'Reviewer override: release token response carries structured policy context');
      ok(typeof overrideBody.evidencePack?.evidencePackId === 'string', 'Reviewer override: durable evidence pack is exported after break-glass release');
      ok(typeof overrideBody.evidencePack?.exportPath === 'string', 'Reviewer override: durable evidence pack export path returned');
      ok(typeof overrideBody.evidencePack?.policyContext?.policyHash === 'string', 'Reviewer override: evidence pack response carries structured policy context');
      breakGlassReleaseToken = overrideBody.releaseToken.token;
      breakGlassEvidencePackId = overrideBody.evidencePack.evidencePackId;
      console.log(`    override=regulatory_deadline, releaseTokenIssued=${Boolean(overrideBody.releaseToken.tokenId)}`);
    }

    // ═══ RELEASE EVIDENCE PACK — exported durable bundle ═══
    console.log('\n  [GET /api/v1/admin/release-evidence/:id — durable evidence bundle]');
    {
      const res = await fetch(`${BASE}/api/v1/admin/release-evidence/${breakGlassEvidencePackId}`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(res.status === 200, 'Release evidence bundle: status 200');
      const body = await res.json() as any;
      ok(body.evidencePack.evidencePack.id === breakGlassEvidencePackId, 'Release evidence bundle: expected evidence pack returned');
      ok(body.evidencePack.statement._type === 'https://in-toto.io/Statement/v1', 'Release evidence bundle: in-toto statement type exported');
      ok(body.evidencePack.statement.predicateType === 'https://attestor.ai/attestation/release-evidence/v1', 'Release evidence bundle: Attestor release predicate exported');
      ok(body.evidencePack.statement.predicate.review.overrideReasonCode === 'regulatory_deadline', 'Release evidence bundle: override reason is preserved in the durable review summary');
      ok(body.evidencePack.statement.predicate.releaseToken.override === true, 'Release evidence bundle: override token summary is preserved');
      ok(typeof body.evidencePack.evidencePack.policyContext?.policyHash === 'string', 'Release evidence bundle: evidence pack policy context is exported');
      ok(typeof body.evidencePack.statement.predicate.decision.policyContext?.policyHash === 'string', 'Release evidence bundle: decision policy context is exported');
      ok(typeof body.evidencePack.statement.predicate.releaseToken.policyContext?.policyHash === 'string', 'Release evidence bundle: token policy context is exported');
      ok(typeof body.evidencePack.verificationKey.keyId === 'string', 'Release evidence bundle: verification key metadata exported');
      ok(typeof body.evidencePack.bundleDigest === 'string', 'Release evidence bundle: bundle digest exported');
      console.log(`    evidencePack=${body.evidencePack.evidencePack.id}, predicate=${body.evidencePack.statement.predicateType}`);
    }

    // ═══ VERIFY ENDPOINT — PKI mandatory: flat Ed25519 rejected with 422 ═══
    console.log('\n  [POST /api/v1/verify — flat Ed25519 rejected (PKI mandatory)]');
    {
      // Submit WITHOUT trust chain — should be rejected with 422
      const verifyRes = await fetch(`${BASE}/api/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificate: fullCert, publicKeyPem: savedPubKey }),
      });
      ok(verifyRes.status === 422, 'Verify(flat): status 422 (PKI required)');
      const v = await verifyRes.json() as any;
      ok(v.error.includes('PKI trust chain required'), 'Verify(flat): error says PKI required');
      ok(v.hint !== undefined, 'Verify(flat): hint present');
      ok(v.legacyEscape === undefined, 'Verify(flat): no legacy env escape is exposed');
      console.log(`    status=422, error=${v.error}`);
    }

    // ═══ VERIFY ENDPOINT — bad input ═══
    console.log('\n  [POST /api/v1/verify — bad input]');
    {
      const badRes = await fetch(`${BASE}/api/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificate: null, publicKeyPem: null }),
      });
      ok(badRes.status === 400, 'Verify(bad): status 400');
      console.log(`    bad input rejected: ${(await badRes.json() as any).error}`);
    }

    // ═══ FILING EXPORT — missing release token ═══
    console.log('\n  [POST /api/v1/filing/export — missing release token]');
    {
      const res = await fetch(`${BASE}/api/v1/filing/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filingRelease.candidate),
      });
      ok(res.status === 401, 'Filing(no token): status 401');
      ok((res.headers.get('WWW-Authenticate') ?? '').includes('invalid_token'), 'Filing(no token): RFC6750 challenge present');
      const body = await res.json() as any;
      ok(body.error === 'missing_token' || body.error === 'invalid_token', 'Filing(no token): bearer failure body returned');
      console.log('    release token required before export');
    }

    // ═══ FILING EXPORT — tampered payload ═══
    console.log('\n  [POST /api/v1/filing/export — tampered payload]');
    {
      const tampered = {
        ...filingRelease.candidate,
        rows: filingRelease.candidate.rows.map((row: Record<string, unknown>) => ({ ...row })),
      };
      (tampered.rows[0] as any).exposure_usd = Number((tampered.rows[0] as any).exposure_usd ?? 0) + 1;

      const res = await fetch(`${BASE}/api/v1/filing/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${filingRelease.token}`,
        },
        body: JSON.stringify(tampered),
      });
      ok(res.status === 403, 'Filing(tampered): status 403');
      const body = await res.json() as any;
      ok(body.error === 'insufficient_scope', 'Filing(tampered): binding mismatch rejected as insufficient scope');
      console.log('    tampered payload blocked by output/consequence hash binding');
    }

    // ═══ FILING EXPORT — approved reviewer token ═══
    console.log('\n  [POST /api/v1/filing/export — approved dual-review token]');
    {
      const res = await fetch(`${BASE}/api/v1/filing/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${approvedReleaseToken}`,
        },
        body: JSON.stringify(reviewRequiredFilingRelease.candidate),
      });
      ok(res.status === 200, 'Filing(approved dual-review token): status 200');
      const body = await res.json() as any;
      ok(body.release?.authorized === true, 'Filing(approved dual-review token): release authorization is attached');
      ok(body.release?.introspectionVerified === true, 'Filing(approved dual-review token): high-risk introspection is confirmed');
      ok(body.package?.content?.facts?.length > 0, 'Filing(approved dual-review token): filing package is still produced after human authority closes');
      console.log(`    approved review release authorized=${Boolean(body.release.tokenId)}`);
    }

    // ═══ FILING EXPORT — break-glass override token ═══
    console.log('\n  [POST /api/v1/filing/export — break-glass override token]');
    {
      const res = await fetch(`${BASE}/api/v1/filing/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${breakGlassReleaseToken}`,
        },
        body: JSON.stringify(breakGlassFilingRelease.candidate),
      });
      ok(res.status === 200, 'Filing(break-glass token): status 200');
      const body = await res.json() as any;
      ok(body.release?.authorized === true, 'Filing(break-glass token): release authorization is attached');
      ok(body.release?.introspectionVerified === true, 'Filing(break-glass token): high-risk introspection is confirmed');
      ok(body.package?.content?.facts?.length > 0, 'Filing(break-glass token): filing package is produced after override');
      console.log(`    overridden release authorized=${Boolean(body.release.tokenId)}`);
    }

    // ═══ FILING EXPORT — authorized XBRL ═══
    console.log('\n  [POST /api/v1/filing/export — authorized XBRL]');
    {
      const res = await fetch(`${BASE}/api/v1/filing/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${filingRelease.token}`,
        },
        body: JSON.stringify(filingRelease.candidate),
      });
      ok(res.status === 200, 'Filing: status 200');
      const body = await res.json() as any;
      ok(body.adapterId === 'xbrl-us-gaap-2024', 'Filing: adapter ID');
      ok(body.format === 'xbrl', 'Filing: format = xbrl');
      ok(body.taxonomyVersion === 'US-GAAP 2024', 'Filing: taxonomy version');
      ok(body.mapping.mappedCount > 0, 'Filing: has mapped fields');
      ok(body.mapping.coveragePercent > 50, 'Filing: coverage > 50%');
      ok(body.package.content.facts.length > 0, 'Filing: package has facts');
      ok(body.package.evidenceLink.runId === filingRelease.candidate.runId, 'Filing: evidence link runId');
      ok(body.package.evidenceLink.certificateId === filingRelease.candidate.certificateId, 'Filing: evidence link certId');
      ok(body.release?.authorized === true, 'Filing: release summary reports authorized');
      ok(body.release?.decisionId === filingRelease.decisionId, 'Filing: release summary preserves decision id');
      ok(body.release?.introspectionVerified === true, 'Filing: release summary reports active introspection verification');
      ok(body.release?.tokenId === filingRelease.tokenId, 'Filing: release summary preserves token id');
      ok(body.package.issuedPackage.fileExtension === '.xbr', 'Filing: report package uses .xbr');
      ok(body.package.issuedPackage.files.some((f: any) => f.path === 'META-INF/reportPackage.json'), 'Filing: includes reportPackage.json');
      const zip = await JSZip.loadAsync(Buffer.from(body.package.issuedPackage.archive.base64, 'base64'));
      ok(zip.file(`${body.package.issuedPackage.topLevelDirectory}/META-INF/reportPackage.json`) !== null, 'Filing: zip metadata exists');
      ok(zip.file(`${body.package.issuedPackage.topLevelDirectory}/${body.package.issuedPackage.reportPath}`) !== null, 'Filing: zip report exists');
      console.log(`    mapped=${body.mapping.mappedCount}, coverage=${body.mapping.coveragePercent}%, facts=${body.package.content.facts.length}`);
    }

    // ═══ FILING EXPORT — replayed release token ═══
    console.log('\n  [POST /api/v1/filing/export — replayed release token]');
    {
      const replayRes = await fetch(`${BASE}/api/v1/filing/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${filingRelease.token}`,
        },
        body: JSON.stringify(filingRelease.candidate),
      });
      ok(replayRes.status === 401, 'Filing(replay): consumed token no longer authorizes export');
      const replayBody = await replayRes.json() as any;
      ok(replayBody.error === 'invalid_token', 'Filing(replay): replay is surfaced as invalid_token');
      ok(
        String(replayBody.error_description ?? '').includes('consumed'),
        'Filing(replay): downstream verifier explains consumed-token replay rejection',
      );
      console.log('    replayed release token blocked after first successful use');
    }

    // ═══ FILING EXPORT — revoked release token ═══
    console.log('\n  [POST /api/v1/filing/export — revoked release token]');
    {
      const revokeRun = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: COUNTERPARTY_INTENT,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: true,
        }),
      });
      ok(revokeRun.status === 200, 'Filing(revoked): fresh signed pipeline run status 200');
      const revokeRunBody = await revokeRun.json() as any;
      const revokedRelease = revokeRunBody.release?.filingExport;
      ok(typeof revokedRelease?.tokenId === 'string', 'Filing(revoked): fresh release token id present');

      const revokeRes = await fetch(`${BASE}/api/v1/admin/release-tokens/${revokedRelease.tokenId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'admin-release-token-revoke-live-api',
        },
        body: JSON.stringify({
          reason: 'operator cancelled filing release',
        }),
      });
      ok(revokeRes.status === 200, 'Filing(revoked): admin revoke status 200');
      const revokeBody = await revokeRes.json() as any;
      ok(revokeBody.token.status === 'revoked', 'Filing(revoked): token status marked revoked');
      ok(revokeBody.token.revocationReason === 'operator cancelled filing release', 'Filing(revoked): revoke reason preserved');

      const revokedExportRes = await fetch(`${BASE}/api/v1/filing/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${revokedRelease.token}`,
        },
        body: JSON.stringify(revokedRelease.candidate),
      });
      ok(revokedExportRes.status === 401, 'Filing(revoked): revoked token no longer authorizes export');
      const revokedExportBody = await revokedExportRes.json() as any;
      ok(revokedExportBody.error === 'invalid_token', 'Filing(revoked): revoke is surfaced as invalid_token');
      ok(
        String(revokedExportBody.error_description ?? '').includes('revoked'),
        'Filing(revoked): revoke reason reaches the downstream verifier response',
      );
      console.log('    revoked release token blocked before export');
    }

    // ═══ FILING EXPORT — bad adapter ═══
    console.log('\n  [POST /api/v1/filing/export — unknown adapter]');
    {
      const res = await fetch(`${BASE}/api/v1/filing/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapterId: 'nonexistent', runId: 'x', rows: [] }),
      });
      ok(res.status === 404, 'Filing(bad): status 404');
      console.log(`    unknown adapter rejected`);
    }

    // ═══ ISSUE → VERIFY WITH PKI CHAIN (E2E closed loop) ═══
    console.log('\n  [Issue → Verify with PKI Chain — E2E]');
    {
      const verifyRes = await fetch(`${BASE}/api/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificate: fullCert,
          publicKeyPem: savedPubKey,
          trustChain: savedTrustChain,
          caPublicKeyPem: savedCaPublicKeyPem,
          trustedCaFingerprint: savedTrustChain?.ca?.fingerprint,
        }),
      });
      ok(verifyRes.status === 200, 'PKI-Verify: status 200');
      const pv = await verifyRes.json() as any;
      ok(pv.signatureValid === true, 'PKI-Verify: signature valid');
      ok(pv.overall === 'valid', 'PKI-Verify: cert overall valid');
      ok(pv.chainVerification !== null, 'PKI-Verify: chain verification present');
      ok(pv.chainVerification.chainIntact === true, 'PKI-Verify: chain intact');
      ok(pv.chainVerification.caValid === true, 'PKI-Verify: CA valid');
      ok(pv.chainVerification.leafValid === true, 'PKI-Verify: leaf valid');
      ok(pv.chainVerification.caExpired === false, 'PKI-Verify: CA not expired');
      ok(pv.chainVerification.leafExpired === false, 'PKI-Verify: leaf not expired');
      ok(pv.chainVerification.caName === 'Attestor Keyless CA', 'PKI-Verify: CA name');
      // Certificate-to-leaf binding
      ok(pv.chainVerification.leafMatchesCertificateKey === true, 'PKI-Verify: leaf matches cert key');
      ok(pv.chainVerification.pkiBound === true, 'PKI-Verify: PKI bound');
      // Trust binding summary
      ok(pv.trustBinding !== undefined, 'PKI-Verify: trustBinding present');
      ok(pv.trustBinding.certificateSignature === true, 'PKI-Verify: cert sig in binding');
      ok(pv.trustBinding.chainValid === true, 'PKI-Verify: chain valid in binding');
      ok(pv.trustBinding.certificateBoundToLeaf === true, 'PKI-Verify: bound to leaf');
      ok(pv.trustBinding.pkiVerified === true, 'PKI-Verify: fully PKI verified');
      // PKI mode — no deprecation
      ok(pv.verificationMode === 'pki', 'PKI-Verify: verificationMode = pki');
      ok(pv.deprecationNotice === null, 'PKI-Verify: no deprecation notice');
      console.log(`    cert=${pv.overall}, chain=${pv.chainVerification.overall}, bound=${pv.chainVerification.pkiBound}, pkiVerified=${pv.trustBinding.pkiVerified}, mode=${pv.verificationMode}`);
    }

    // ═══ PKI LEAF MISMATCH DETECTION ═══
    console.log('\n  [PKI Verify — Leaf Mismatch]');
    {
      const mismatchRes = await fetch(`${BASE}/api/v1/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificate: fullCert,
          publicKeyPem: savedPubKey,
          trustChain: { ...savedTrustChain, leaf: { ...savedTrustChain.leaf, subjectFingerprint: 'aaaa_fake_fingerprint' } },
          caPublicKeyPem: savedCaPublicKeyPem,
          trustedCaFingerprint: savedTrustChain?.ca?.fingerprint,
        }),
      });
      const mm = await mismatchRes.json() as any;
      ok(mm.chainVerification.leafMatchesCertificateKey === false || mm.chainVerification.leafMatchesCertificateFingerprint === false, 'PKI-Mismatch: leaf binding fails');
      ok(mm.chainVerification.pkiBound === false, 'PKI-Mismatch: NOT PKI bound');
      ok(mm.trustBinding.certificateBoundToLeaf === false, 'PKI-Mismatch: binding reports unbound');
      ok(mm.trustBinding.pkiVerified === false, 'PKI-Mismatch: NOT PKI verified');
      console.log(`    mismatch detected: pkiBound=${mm.chainVerification.pkiBound}, pkiVerified=${mm.trustBinding.pkiVerified}`);
    }

    // ═══ ASYNC PIPELINE ═══
    console.log('\n  [POST /api/v1/pipeline/run-async — submit]');
    let asyncJobId: string;
    {
      const res = await fetch(`${BASE}/api/v1/pipeline/run-async`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'runtime-pipeline-async-submit',
        },
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: COUNTERPARTY_INTENT,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: true,
        }),
      });
      ok(res.status === 202, 'Async: submit returns 202');
      const body = await res.json() as any;
      ok(body.jobId !== undefined, 'Async: jobId returned');
      ok(body.status === 'queued', 'Async: status=queued');
      ok(body.backendMode === 'in_process' || body.backendMode === 'bullmq', 'Async: backendMode truthful');
      ok(typeof body.asyncQueue?.tenantPendingJobs === 'number', 'Async: queue snapshot present');
      ok(typeof body.asyncQueue?.tenantActiveExecutions === 'number', 'Async: active execution snapshot present');
      ok(typeof body.asyncQueue?.tenantWeightedDispatchEnforced === 'boolean', 'Async: weighted dispatch enforcement surfaced');
      ok(typeof body.asyncQueue?.tenantWeightedDispatchWeight === 'number' || body.asyncQueue?.tenantWeightedDispatchWeight === null, 'Async: weighted dispatch weight surfaced');
      ok(body.asyncQueue?.retryPolicy?.attempts >= 1, 'Async: retry policy present');
      asyncJobId = body.jobId;
      console.log(`    jobId=${asyncJobId}, status=${body.status}, backend=${body.backendMode}`);
    }

    // Poll for completion
    console.log('\n  [GET /api/v1/pipeline/status/:jobId — poll]');
    {
      // Wait a moment for the async job to complete
      await new Promise(r => setTimeout(r, 2000));
      const res = await fetch(`${BASE}/api/v1/pipeline/status/${asyncJobId}`);
      ok(res.status === 200, 'Async: status endpoint 200');
      const body = await res.json() as any;
      ok(body.status === 'completed', 'Async: job completed');
      ok(body.backendMode === 'in_process' || body.backendMode === 'bullmq', 'Async: status shows backendMode');
      ok(body.result !== null, 'Async: result present');
      ok(body.result.decision === 'pass', 'Async: decision=pass');
      ok(body.result.certificateId !== null, 'Async: certificate issued');
      ok(body.result.certificate !== null, 'Async: full cert in result');
      ok(body.result.trustChain !== null, 'Async: trust chain in result');
      ok(typeof body.attemptsMade === 'number', 'Async: attemptsMade returned');
      ok(typeof body.maxAttempts === 'number' && body.maxAttempts >= 1, 'Async: maxAttempts returned');
      ok(body.tenantContext?.tenantId === '__attestor_anonymous__', 'Async: tenant context returned in status');
      console.log(`    status=${body.status}, backend=${body.backendMode}, decision=${body.result.decision}, cert=${body.result.certificateId}`);
    }

    // Status for non-existent job
    console.log('\n  [GET /api/v1/pipeline/status/nonexistent]');
    {
      const res = await fetch(`${BASE}/api/v1/pipeline/status/nonexistent`);
      ok(res.status === 404, 'Async: unknown job = 404');
      console.log(`    unknown job rejected`);
    }

    console.log('\n  [Async Queue Hardening — tenant cap + DLQ + retry]');
    {
      const queueTenant = issueTenantApiKey({
        tenantId: 'tenant-queue',
        tenantName: 'Queue Tenant',
        planId: 'starter',
      });
      const queueHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${queueTenant.apiKey}`,
      };

      const payload = JSON.stringify({
        candidateSql: COUNTERPARTY_SQL,
        intent: COUNTERPARTY_INTENT,
        fixtures: [COUNTERPARTY_FIXTURE],
        generatedReport: COUNTERPARTY_REPORT,
        reportContract: COUNTERPARTY_REPORT_CONTRACT,
        sign: false,
      });
      const [queueAttemptA, queueAttemptB] = await Promise.all([
        fetch(`${BASE}/api/v1/pipeline/run-async`, {
          method: 'POST',
          headers: {
            ...queueHeaders,
            'Idempotency-Key': 'runtime-pipeline-queue-cap-a',
          },
          body: payload,
        }),
        fetch(`${BASE}/api/v1/pipeline/run-async`, {
          method: 'POST',
          headers: {
            ...queueHeaders,
            'Idempotency-Key': 'runtime-pipeline-queue-cap-b',
          },
          body: payload,
        }),
      ]);
      const queueBodies = [
        { status: queueAttemptA.status, body: await queueAttemptA.json() as any },
        { status: queueAttemptB.status, body: await queueAttemptB.json() as any },
      ];
      const acceptedQueueJob = queueBodies.find((entry) => entry.status === 202);
      const rejectedQueueJob = queueBodies.find((entry) => entry.status === 429);
      ok(Boolean(acceptedQueueJob), 'Async Queue: one starter job accepted');
      ok(Boolean(rejectedQueueJob), 'Async Queue: one starter job rejected at pending cap');
      ok(acceptedQueueJob!.body.asyncQueue.tenantIsolationEnforced === true, 'Async Queue: starter tenant isolation enforced');
      ok(acceptedQueueJob!.body.asyncQueue.tenantPendingLimit === 1, 'Async Queue: starter tenant pending cap = 1');
      ok(acceptedQueueJob!.body.asyncQueue.tenantActiveExecutionLimit === 1, 'Async Queue: starter tenant active execution cap = 1');
      ok(acceptedQueueJob!.body.asyncQueue.tenantWeightedDispatchEnforced === true, 'Async Queue: starter weighted dispatch enforced');
      ok(acceptedQueueJob!.body.asyncQueue.tenantWeightedDispatchWeight === 1, 'Async Queue: starter weighted dispatch weight = 1');
      ok(acceptedQueueJob!.body.asyncQueue.tenantWeightedDispatchWindowMs === 400, 'Async Queue: starter weighted dispatch window = 400ms');
      ok(rejectedQueueJob!.body.asyncQueue.tenantPendingJobs >= 1, 'Async Queue: rejected response reports pending jobs');
      ok(rejectedQueueJob!.body.asyncQueue.tenantPendingLimit === 1, 'Async Queue: rejected response reports pending limit');

      const failedTenant = issueTenantApiKey({
        tenantId: 'tenant-dlq',
        tenantName: 'DLQ Tenant',
        planId: 'pro',
      });
      const failedSubmit = await fetch(`${BASE}/api/v1/pipeline/run-async`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${failedTenant.apiKey}`,
          'Idempotency-Key': 'runtime-pipeline-dlq-proof',
        },
        body: JSON.stringify({
          candidateSql: 123,
          intent: 'bad-intent',
          sign: false,
        }),
      });
      ok(failedSubmit.status === 202, 'Async Queue: invalid payload still reaches worker for DLQ proof');
      const failedSubmitBody = await failedSubmit.json() as any;
      const failedStatus = await waitForJobStatus(
        failedSubmitBody.jobId,
        'failed',
        6000,
        { Authorization: `Bearer ${failedTenant.apiKey}` },
      );
      ok(
        failedStatus.error.includes('candidateSql')
          || failedStatus.error.includes('intent')
          || failedStatus.error.includes('Async job payload requires')
          || failedStatus.error.includes('non-empty string')
          || failedStatus.error.includes('object'),
        `Async Queue: worker exposes validation failure (actual=${failedStatus.error})`,
      );
      ok(failedStatus.maxAttempts >= 1, 'Async Queue: failed status reports retry ceiling');
      ok(failedStatus.tenantContext?.tenantId === 'tenant-dlq', 'Async Queue: failed status keeps tenant context');

      const adminQueueNoAuth = await fetch(`${BASE}/api/v1/admin/queue`);
      ok(adminQueueNoAuth.status === 401, 'Admin Queue: auth required');

      const adminQueueRes = await fetch(`${BASE}/api/v1/admin/queue?tenantId=tenant-dlq&planId=pro`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(adminQueueRes.status === 200, 'Admin Queue: status 200');
      const adminQueueBody = await adminQueueRes.json() as any;
      ok(adminQueueBody.retryPolicy.attempts >= 1, 'Admin Queue: retry policy exposed');
      ok(adminQueueBody.tenant?.tenantId === 'tenant-dlq', 'Admin Queue: tenant snapshot returned');
      ok(adminQueueBody.counts.failed >= 1, 'Admin Queue: failed count reflected');
      ok(typeof adminQueueBody.tenant?.weightedDispatchEnforced === 'boolean', 'Admin Queue: weighted dispatch enforcement surfaced');
      ok(typeof adminQueueBody.tenant?.weightedDispatchWindowMs === 'number' || adminQueueBody.tenant?.weightedDispatchWindowMs === null, 'Admin Queue: weighted dispatch window surfaced');

      const dlqNoAuth = await fetch(`${BASE}/api/v1/admin/queue/dlq`);
      ok(dlqNoAuth.status === 401, 'Admin DLQ: auth required');

      const dlqRes = await fetch(`${BASE}/api/v1/admin/queue/dlq?tenantId=tenant-dlq&limit=10`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(dlqRes.status === 200, 'Admin DLQ: status 200');
      const dlqBody = await dlqRes.json() as any;
      ok(dlqBody.summary.recordCount >= 1, 'Admin DLQ: at least one failed job listed');
      const dlqRecord = dlqBody.records.find((record: any) => record.jobId === failedSubmitBody.jobId);
      ok(Boolean(dlqRecord), 'Admin DLQ: failed job record present');
      ok(dlqRecord.failedReason.includes('candidateSql') || dlqRecord.failedReason.includes('intent'), 'Admin DLQ: failure reason preserved');
      ok(dlqRecord.backendMode === 'bullmq', 'Admin DLQ: backendMode truthful');
      ok(typeof dlqRecord.recordedAt === 'string', 'Admin DLQ: recordedAt surfaced');
      const persistedDlq = readAsyncDeadLetterStoreSnapshot();
      ok(persistedDlq.records.some((record) => record.jobId === failedSubmitBody.jobId), 'Admin DLQ: failed job persisted to local DLQ store');

      const retryNoAuth = await fetch(`${BASE}/api/v1/admin/queue/jobs/${failedSubmitBody.jobId}/retry`, {
        method: 'POST',
      });
      ok(retryNoAuth.status === 401, 'Admin Queue Retry: auth required');

      const retryRes = await fetch(`${BASE}/api/v1/admin/queue/jobs/${failedSubmitBody.jobId}/retry`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'queue-retry-live-api',
        },
      });
      ok(retryRes.status === 202, 'Admin Queue Retry: status 202');
      const retryBody = await retryRes.json() as any;
      ok(retryBody.job.jobId === failedSubmitBody.jobId, 'Admin Queue Retry: same job retried');
      ok(!readAsyncDeadLetterStoreSnapshot().records.some((record) => record.jobId === failedSubmitBody.jobId), 'Admin Queue Retry: DLQ record removed after retry');

      const retryAuditRes = await fetch(`${BASE}/api/v1/admin/audit?action=async_job.retried`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(retryAuditRes.status === 200, 'Admin Queue Retry: audit status 200');
      const retryAuditBody = await retryAuditRes.json() as any;
      ok(retryAuditBody.summary.recordCount >= 1, 'Admin Queue Retry: retry action audited');
      console.log(`    cap=1, failedJob=${failedSubmitBody.jobId}, dlqRecords=${dlqBody.summary.recordCount}`);
    }

    // ═══ PIPELINE RUN — bad input ═══
    console.log('\n  [POST /api/v1/pipeline/run — missing fields]');
    {
      const badInputTenant = issueTenantApiKey({
        tenantId: 'tenant-bad-input',
        tenantName: 'Bad Input Tenant',
        planId: 'pro',
      });
      const res = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${badInputTenant.apiKey}`,
        },
        body: JSON.stringify({ candidateSql: null }),
      });
      ok(res.status === 400, 'Pipeline(bad): status 400');
      const body = await res.json() as any;
      ok(body.error !== undefined, 'Pipeline(bad): error message');
      console.log(`    error handled: ${body.error}`);
    }

    // ═══ READINESS PROBE ═══
    console.log('\n  [GET /api/v1/ready]');
    {
      const res = await fetch(`${BASE}/api/v1/ready`);
      ok(res.status === 200, 'Ready: status 200');
      const body = await res.json() as any;
      ok(body.ready === true, 'Ready: ready = true');
      ok(body.status === 'ready', 'Ready: status marker exposed');
      ok(body.engine === 'attestor', 'Ready: engine marker exposed');
      ok(!('checks' in body), 'Ready: internal check matrix is not exposed on public readiness route');
      console.log(`    ready=${body.ready}, status=${body.status}, engine=${body.engine}`);
    }

    // ═══ 404 for unknown route ═══
    console.log('\n  [GET /api/v1/nonexistent]');
    {
      const notFoundTenant = issueTenantApiKey({
        tenantId: 'tenant-not-found',
        tenantName: 'Not Found Tenant',
        planId: 'pro',
      });
      const res = await fetch(`${BASE}/api/v1/nonexistent`, {
        headers: { Authorization: `Bearer ${notFoundTenant.apiKey}` },
      });
      ok(res.status === 404, '404: unknown route returns 404');
      console.log(`    status=${res.status}`);
    }

    // ═══ HOSTED SHELL — plan/quota/usage first slice ═══
}
