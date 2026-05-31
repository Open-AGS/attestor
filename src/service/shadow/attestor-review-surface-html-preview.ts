import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
  type AttestorReviewSurface,
  type AttestorReviewSurfaceStatusLabel,
} from '../../consequence-admission/index.js';

export const ATTESTOR_REVIEW_SURFACE_HTML_PREVIEW_VERSION =
  'attestor.review-surface-html-preview.v1';

export interface AttestorReviewSurfaceHtmlPreviewDescriptor {
  readonly version: typeof ATTESTOR_REVIEW_SURFACE_HTML_PREVIEW_VERSION;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'attestor-review-surface';
  readonly rendersFromReviewSurfaceOnly: true;
  readonly rawPayloadStored: false;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly mutatesPolicyBundle: false;
  readonly grantsAuthority: false;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusLabel(status: AttestorReviewSurfaceStatusLabel): string {
  switch (status) {
    case 'blocked':
      return 'Blocked';
    case 'missing-evidence':
      return 'Missing evidence';
    case 'ready-to-approve':
      return 'Ready to approve';
    case 'monitoring':
      return 'Monitoring';
    case 'stale':
      return 'Stale';
    case 'verified':
      return 'Verified';
    case 'needs-review':
      return 'Needs review';
  }
}

function statusClass(status: AttestorReviewSurfaceStatusLabel): string {
  switch (status) {
    case 'blocked':
    case 'missing-evidence':
      return 'blocked';
    case 'ready-to-approve':
      return 'ready';
    case 'verified':
      return 'verified';
    case 'monitoring':
      return 'monitoring';
    case 'stale':
      return 'stale';
    case 'needs-review':
      return 'review';
  }
}

function caseHref(caseDigest: string): string {
  return `/api/v1/shadow/review-surface/cases/${encodeURIComponent(caseDigest)}`;
}

function renderReviewQueue(surface: AttestorReviewSurface): string {
  if (surface.reviewQueue.length === 0) {
    return '<p class="empty">No review queue item is available yet.</p>';
  }
  return `<ol class="task-list">${surface.reviewQueue
    .map((item) => `
      <li class="task ${statusClass(item.statusLabel)}">
        <a href="${escapeHtml(caseHref(item.caseDigest))}">
          <span class="task-title">${escapeHtml(item.nextSafeStep)}</span>
          <span class="task-meta">${escapeHtml(item.queueItemId)} / ${escapeHtml(item.evidenceState)}</span>
        </a>
        <span class="tag ${statusClass(item.statusLabel)}">${escapeHtml(statusLabel(item.statusLabel))}</span>
      </li>
    `)
    .join('')}</ol>`;
}

function renderDigestList(title: string, values: readonly string[]): string {
  if (values.length === 0) {
    return `
      <section class="panel">
        <h2>${escapeHtml(title)}</h2>
        <p class="empty">No digest is available yet.</p>
      </section>
    `;
  }
  return `
    <section class="panel">
      <h2>${escapeHtml(title)}</h2>
      <ul class="digest-list">
        ${values.map((value) => `<li><code>${escapeHtml(value)}</code></li>`).join('')}
      </ul>
    </section>
  `;
}

function renderBoundary(surface: AttestorReviewSurface): string {
  return `
    <section class="panel boundary" data-testid="attestor-review-surface-boundary">
      <h2>Boundary</h2>
      <p>Review material only. No raw payload storage, policy mutation, authority grant, enforcement activation, compliance certification, customer PEP no-bypass proof, or production readiness claim.</p>
      <p>Review surface digest: <code>${escapeHtml(surface.digest)}</code></p>
      <p>Audit evidence digest: <code>${escapeHtml(surface.sourceAuditExportDigest)}</code></p>
      <p>Dashboard summary digest: <code>${escapeHtml(surface.sourceDashboardSummaryDigest)}</code></p>
    </section>
  `;
}

export function renderAttestorReviewSurfaceHtmlPreview(
  surface: AttestorReviewSurface,
): string {
  const hasBlocker =
    surface.overview.blockedCount > 0 ||
    surface.overview.noGoReasons.length > 0 ||
    surface.policy.promotionBlocked;
  const statusRole = hasBlocker ? 'alert' : 'status';
  const statusLive = hasBlocker ? 'assertive' : 'polite';
  const reviewQueue = renderReviewQueue(surface);
  const evidence = renderDigestList('Evidence digests', surface.evidenceLibrary.artifactDigests);
  const sourceDigests = renderDigestList('Source digests', surface.sourceDigests.slice(0, 12));
  const boundary = renderBoundary(surface);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Attestor review surface</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #172033;
        --muted: #5a667a;
        --paper: #f7f9fc;
        --panel: #ffffff;
        --line: #d8e0ec;
        --accent: #2457d6;
        --blocked: #9f1d2a;
        --ready: #17643a;
        --review: #7a4f00;
        --stale: #5f5468;
      }
      * { box-sizing: border-box; }
      .skip-link {
        position: absolute;
        left: 16px;
        top: 8px;
        transform: translateY(-140%);
        background: var(--ink);
        color: #ffffff;
        padding: 8px 12px;
        border-radius: 6px;
        z-index: 10;
      }
      .skip-link:focus { transform: translateY(0); }
      body {
        margin: 0;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        background: var(--paper);
      }
      main {
        max-width: 1180px;
        margin: 0 auto;
        padding: 40px 24px 64px;
      }
      .eyebrow {
        margin: 0 0 10px;
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font-size: 40px;
        line-height: 1.08;
      }
      h2, h3 { margin: 0; }
      p { line-height: 1.6; }
      h1, h2, h3, p, li, code, a { overflow-wrap: anywhere; }
      a { color: var(--accent); }
      .summary {
        margin: 18px 0 24px;
        color: var(--muted);
        max-width: 820px;
      }
      .status-panel, .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 20px;
        margin-top: 18px;
      }
      .status-panel.alert {
        border-color: rgba(159, 29, 42, 0.36);
        background: #fff7f7;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin: 20px 0;
      }
      .metric {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 16px;
      }
      .metric span {
        display: block;
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .metric strong {
        display: block;
        margin-top: 8px;
        font-size: 24px;
      }
      .task-list, .digest-list {
        list-style: none;
        margin: 16px 0 0;
        padding: 0;
      }
      .task {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        align-items: start;
        padding: 16px 0;
        border-top: 1px solid var(--line);
      }
      .task:first-child { border-top: 0; }
      .task a {
        display: block;
        text-decoration-thickness: 1px;
        text-underline-offset: 3px;
      }
      .task-title {
        display: block;
        font-weight: 700;
      }
      .task-meta {
        display: block;
        margin-top: 6px;
        color: var(--muted);
        font-size: 13px;
      }
      .tag {
        display: inline-flex;
        align-items: center;
        min-width: 118px;
        justify-content: center;
        border-radius: 999px;
        padding: 7px 10px;
        font-weight: 700;
        font-size: 12px;
        white-space: nowrap;
      }
      .tag.blocked { background: #ffe4e8; color: var(--blocked); }
      .tag.ready, .tag.verified { background: #def7e8; color: var(--ready); }
      .tag.review { background: #fff0c2; color: var(--review); }
      .tag.monitoring { background: #edf2ff; color: var(--accent); }
      .tag.stale { background: #eee8f5; color: var(--stale); }
      .digest-list li {
        border-top: 1px solid var(--line);
        padding: 12px 0;
      }
      .digest-list li:first-child { border-top: 0; }
      code {
        display: block;
        color: #26364f;
        overflow-wrap: anywhere;
      }
      .empty, .boundary {
        color: var(--muted);
      }
      .boundary {
        font-size: 14px;
      }
      @media (max-width: 640px) {
        main { padding: 28px 16px 48px; }
        h1 { font-size: 30px; }
        .task { grid-template-columns: 1fr; }
        .tag { width: fit-content; }
      }
    </style>
  </head>
  <body>
    <a class="skip-link" href="#review-queue">Skip to review queue</a>
    <main id="main-content">
      <p class="eyebrow">Attestor review surface</p>
      <h1>${escapeHtml(surface.decisionPosture)}</h1>
      <p class="summary">${escapeHtml(surface.overview.nextSafeStep)}</p>

      <section class="status-panel ${hasBlocker ? 'alert' : ''}" role="${statusRole}" aria-live="${statusLive}" aria-atomic="true" aria-labelledby="current-state-heading" data-testid="attestor-review-surface-status">
        <h2 id="current-state-heading">Current state</h2>
        <p>${surface.overview.blockedCount} blocked, ${surface.overview.reviewCount} needs review, ${surface.overview.staleCount} stale, ${surface.overview.attentionCount} attention item(s).</p>
      </section>

      <section class="metrics" aria-label="Review surface summary">
        <div class="metric"><span>Queue</span><strong>${surface.reviewQueue.length}</strong></div>
        <div class="metric"><span>Cases</span><strong>${surface.caseDigests.length}</strong></div>
        <div class="metric"><span>Evidence</span><strong>${surface.evidenceLibrary.artifactDigests.length}</strong></div>
        <div class="metric"><span>Policy candidates</span><strong>${surface.policy.candidateDigests.length}</strong></div>
      </section>

      <section class="panel" id="review-queue" data-testid="attestor-review-surface-queue">
        <h2>Review queue</h2>
        ${reviewQueue}
      </section>

      ${evidence}
      ${sourceDigests}
      ${boundary}
    </main>
  </body>
</html>`;
}

export function attestorReviewSurfaceHtmlPreviewDescriptor():
AttestorReviewSurfaceHtmlPreviewDescriptor {
  return Object.freeze({
    version: ATTESTOR_REVIEW_SURFACE_HTML_PREVIEW_VERSION,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'attestor-review-surface',
    rendersFromReviewSurfaceOnly: true,
    rawPayloadStored: false,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
    mutatesPolicyBundle: false,
    grantsAuthority: false,
  });
}
