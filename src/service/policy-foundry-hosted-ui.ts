import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
  type PolicyFoundryHostedReviewSurface,
  type PolicyFoundryHostedReviewSurfaceTaskPriority,
} from '../consequence-admission/index.js';

export const POLICY_FOUNDRY_HOSTED_UI_FLOW_VERSION =
  'attestor.policy-foundry-hosted-ui-flow.v1';

export interface PolicyFoundryHostedUiFlowDescriptor {
  readonly version: typeof POLICY_FOUNDRY_HOSTED_UI_FLOW_VERSION;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-hosted-ui-flow';
  readonly rendersFromReviewSurfaceOnly: true;
  readonly rawPayloadStored: false;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly appliesPatches: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly executesProductionTraffic: false;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusLabel(status: PolicyFoundryHostedReviewSurfaceTaskPriority): string {
  switch (status) {
    case 'blocked':
      return 'Blocked';
    case 'currently-due':
      return 'Needs attention';
    case 'eventually-due':
      return 'Later';
    case 'satisfied':
      return 'Done';
  }
}

function statusClass(status: PolicyFoundryHostedReviewSurfaceTaskPriority): string {
  switch (status) {
    case 'blocked':
      return 'blocked';
    case 'currently-due':
      return 'due';
    case 'eventually-due':
      return 'later';
    case 'satisfied':
      return 'done';
  }
}

function renderTaskCards(surface: PolicyFoundryHostedReviewSurface): string {
  if (surface.taskCards.length === 0) {
    return '<p class="empty">No onboarding tasks are available yet.</p>';
  }
  return `<ol class="task-list">${surface.taskCards
    .map((task) => `
      <li class="task ${statusClass(task.priority)}">
        <div>
          <h3>${escapeHtml(task.title)}</h3>
          <p>${escapeHtml(task.safeInstruction)}</p>
          <p class="codes">${task.reasonCodes.map(escapeHtml).join(' / ')}</p>
        </div>
        <span class="tag ${statusClass(task.priority)}">${escapeHtml(statusLabel(task.priority))}</span>
      </li>
    `)
    .join('')}</ol>`;
}

function renderNoGoCards(surface: PolicyFoundryHostedReviewSurface): string {
  if (surface.noGoCards.length === 0) {
    return '<p class="empty">No no-go blocker is present in this review surface.</p>';
  }
  return `<ul class="no-go-list">${surface.noGoCards
    .map((card) => `
      <li>
        <strong>${escapeHtml(card.reason)}</strong>
        <span>${escapeHtml(card.severity)}</span>
        <p>${escapeHtml(card.safeInstruction)}</p>
      </li>
    `)
    .join('')}</ul>`;
}

function renderEvidenceCards(surface: PolicyFoundryHostedReviewSurface): string {
  if (surface.evidenceCards.length === 0) {
    return '<p class="empty">No digest-bound evidence card is present yet.</p>';
  }
  return `<ul class="evidence-list">${surface.evidenceCards
    .map((card) => `
      <li>
        <span>${escapeHtml(card.label)}</span>
        <code>${escapeHtml(card.digest)}</code>
      </li>
    `)
    .join('')}</ul>`;
}

function renderAutomationBoundary(surface: PolicyFoundryHostedReviewSurface): string {
  const safe = surface.safeAutomations.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('');
  const gated = surface.approvalGatedAutomations.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('');
  const prohibited = surface.prohibitedAutomations.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('');

  return `
    <div class="automation-grid">
      <section>
        <h3>Safe automation</h3>
        <ul>${safe || '<li>none</li>'}</ul>
      </section>
      <section>
        <h3>Approval-gated</h3>
        <ul>${gated || '<li>none</li>'}</ul>
      </section>
      <section>
        <h3>Prohibited</h3>
        <ul>${prohibited || '<li>none</li>'}</ul>
      </section>
    </div>
  `;
}

export function renderPolicyFoundryHostedUiFlow(
  surface: PolicyFoundryHostedReviewSurface,
): string {
  const statusRole = surface.noGoCount > 0 ? 'alert' : 'status';
  const statusLive = surface.noGoCount > 0 ? 'assertive' : 'polite';
  const taskCards = renderTaskCards(surface);
  const noGoCards = renderNoGoCards(surface);
  const evidenceCards = renderEvidenceCards(surface);
  const automationBoundary = renderAutomationBoundary(surface);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Attestor Policy Foundry onboarding</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #172033;
        --muted: #5a667a;
        --paper: #f7f9fc;
        --panel: #ffffff;
        --line: #d8e0ec;
        --accent: #2457d6;
        --due: #7a4f00;
        --blocked: #9f1d2a;
        --done: #17643a;
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
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      h1 {
        margin: 0;
        font-size: 40px;
        line-height: 1.08;
      }
      h2, h3 { margin: 0; }
      p { line-height: 1.6; }
      h1, h2, h3, p, li, code { overflow-wrap: anywhere; }
      .summary {
        margin: 18px 0 24px;
        color: var(--muted);
        max-width: 780px;
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
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .metric strong {
        display: block;
        margin-top: 8px;
        font-size: 24px;
      }
      .task-list, .no-go-list, .evidence-list {
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
      .codes {
        margin: 8px 0 0;
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
      }
      .tag[aria-label] { white-space: nowrap; }
      .tag.blocked { background: #ffe4e8; color: var(--blocked); }
      .tag.due { background: #fff0c2; color: var(--due); }
      .tag.later { background: #edf2ff; color: var(--accent); }
      .tag.done { background: #def7e8; color: var(--done); }
      .no-go-list li, .evidence-list li {
        border-top: 1px solid var(--line);
        padding: 14px 0;
      }
      .no-go-list li:first-child, .evidence-list li:first-child { border-top: 0; }
      .no-go-list span {
        display: inline-block;
        margin-left: 8px;
        color: var(--blocked);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }
      code {
        display: block;
        margin-top: 6px;
        overflow-wrap: anywhere;
        color: #26364f;
      }
      .automation-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
        margin-top: 16px;
      }
      .automation-grid section {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 14px;
      }
      .empty { color: var(--muted); }
      .boundary {
        color: var(--muted);
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
    <a class="skip-link" href="#tasks">Skip to onboarding tasks</a>
    <main id="main-content">
      <p class="eyebrow">Policy Foundry hosted onboarding</p>
      <h1>${escapeHtml(surface.headline)}</h1>
      <p class="summary">${escapeHtml(surface.nextSafeStep)}</p>

      <section class="status-panel ${surface.noGoCount > 0 ? 'alert' : ''}" role="${statusRole}" aria-live="${statusLive}" aria-atomic="true" aria-labelledby="current-state-heading" data-testid="policy-foundry-status-panel">
        <h2 id="current-state-heading">Current state</h2>
        <p>${escapeHtml(surface.headline)}. ${surface.noGoCount} no-go item(s), ${surface.currentTaskCount} current task(s).</p>
      </section>

      <section class="metrics" aria-label="Onboarding summary">
        <div class="metric"><span>Surfaces</span><strong>${surface.surfaceCount}</strong></div>
        <div class="metric"><span>Shadow events</span><strong>${surface.shadowEventCount}</strong></div>
        <div class="metric"><span>Blockers</span><strong>${surface.blockerCount}</strong></div>
        <div class="metric"><span>No-go</span><strong>${surface.noGoCount}</strong></div>
      </section>

      <section class="panel" id="tasks" data-testid="policy-foundry-task-list">
        <h2>Tasks</h2>
        ${taskCards}
      </section>

      <section class="panel" data-testid="policy-foundry-no-go-list">
        <h2>No-go conditions</h2>
        ${noGoCards}
      </section>

      <section class="panel" data-testid="policy-foundry-evidence-list">
        <h2>Evidence digests</h2>
        ${evidenceCards}
      </section>

      <section class="panel" data-testid="policy-foundry-automation-boundary">
        <h2>Automation boundary</h2>
        ${automationBoundary}
      </section>

      <section class="panel boundary" data-testid="policy-foundry-boundary-statement">
        <h2>Boundary</h2>
        <p>Review material only. Full digest-bound packet required for implementation. No raw payload storage, patch application, credential issuance, infrastructure deployment, production traffic execution, enforcement activation, or production-readiness claim.</p>
        <p>Review surface digest: <code>${escapeHtml(surface.digest)}</code></p>
        <p>Workflow digest: <code>${escapeHtml(surface.workflowDigest)}</code></p>
      </section>
    </main>
  </body>
</html>`;
}

export function policyFoundryHostedUiFlowDescriptor():
PolicyFoundryHostedUiFlowDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_HOSTED_UI_FLOW_VERSION,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-hosted-ui-flow',
    rendersFromReviewSurfaceOnly: true,
    rawPayloadStored: false,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    appliesPatches: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    executesProductionTraffic: false,
  });
}
