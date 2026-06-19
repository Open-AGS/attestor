function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderHostedReturnPage(options: {
  title: string;
  eyebrow: string;
  message: string;
  bullets?: string[];
  note?: string;
  actions: Array<{ href: string; label: string }>;
}): string {
  const bulletMarkup = (options.bullets ?? []).length > 0
    ? `<ul>${(options.bullets ?? [])
      .map((entry) => `<li>${escapeHtml(entry)}</li>`)
      .join('')}</ul>`
    : '';
  const noteMarkup = options.note
    ? `<p class="note">${escapeHtml(options.note)}</p>`
    : '';
  const actions = options.actions
    .map((action) => `<a class="action" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`)
    .join('');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", sans-serif;
        background: #f5f7fb;
        color: #132238;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top left, rgba(44, 123, 229, 0.12), transparent 36%),
          radial-gradient(circle at bottom right, rgba(18, 184, 134, 0.14), transparent 38%),
          #f5f7fb;
      }
      main {
        width: min(640px, calc(100vw - 32px));
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
        padding: 32px;
      }
      .eyebrow {
        margin: 0 0 12px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #2c7be5;
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(28px, 4vw, 40px);
        line-height: 1.05;
      }
      p {
        margin: 0;
        font-size: 16px;
        line-height: 1.6;
        color: #40556f;
      }
      ul {
        margin: 18px 0 0;
        padding-left: 20px;
        color: #29415e;
        line-height: 1.7;
      }
      li + li {
        margin-top: 8px;
      }
      .note {
        margin-top: 18px;
        font-size: 14px;
        color: #5c728d;
      }
      nav {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
      }
      .action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 11px 18px;
        font-weight: 600;
        text-decoration: none;
        background: #132238;
        color: #ffffff;
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">${escapeHtml(options.eyebrow)}</p>
      <h1>${escapeHtml(options.title)}</h1>
      <p>${escapeHtml(options.message)}</p>
      ${bulletMarkup}
      ${noteMarkup}
      <nav>${actions}</nav>
    </main>
  </body>
</html>`;
}
