import { strict as assert } from 'node:assert';
import { Hono } from 'hono';
import { registerPublicSiteRoutes } from '../src/service/http/routes/public-site-routes.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function contentTypeFor(path: string): string {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function assertSecureHtmlHeaders(response: Response, label: string): void {
  equal(response.headers.get('content-type'), 'text/html; charset=utf-8', `${label}: content type is HTML`);
  equal(response.headers.get('cache-control'), 'no-store', `${label}: response is no-store`);
  equal(response.headers.get('x-content-type-options'), 'nosniff', `${label}: MIME sniffing is disabled`);
  equal(response.headers.get('x-frame-options'), 'DENY', `${label}: frame denial header is set`);
  equal(response.headers.get('referrer-policy'), 'no-referrer', `${label}: referrer policy is strict`);
  const csp = response.headers.get('content-security-policy') ?? '';
  ok(csp.includes("default-src 'none'"), `${label}: CSP denies default loads`);
  ok(csp.includes("frame-ancestors 'none'"), `${label}: CSP denies framing`);
  ok(csp.includes("object-src 'none'"), `${label}: CSP denies plugin objects`);
}

function assertEvidenceAssetHeaders(response: Response, contentType: string, label: string): void {
  equal(response.headers.get('content-type'), contentType, `${label}: content type is explicit`);
  equal(response.headers.get('cache-control'), 'no-store', `${label}: asset response is no-store`);
  equal(response.headers.get('x-content-type-options'), 'nosniff', `${label}: MIME sniffing is disabled`);
  equal(response.headers.get('referrer-policy'), 'no-referrer', `${label}: referrer policy is strict`);
}

async function testPublicSiteHeaders(): Promise<void> {
  const app = new Hono();
  registerPublicSiteRoutes(app, {
    committedFinancialPacket: { id: 'packet' },
    renderFinancialReportingLandingPage: () => '<!doctype html><html><body>landing</body></html>',
    renderFinancialReportingProofPage: () => '<!doctype html><html><body>proof</body></html>',
    renderHostedReturnPage: (input) => `<!doctype html><html><body>${input.title}</body></html>`,
    readCommittedEvidence: (relativePath) => ({
      path: relativePath,
      content: relativePath.endsWith('.json') ? '{"ok":true}' : '<!doctype html><html><body>asset</body></html>',
    }),
    committedEvidenceContentType: contentTypeFor,
  });

  for (const path of [
    '/',
    '/financial-reporting-acceptance',
    '/proof/financial-reporting-acceptance',
    '/billing/success',
    '/billing/cancel',
    '/settings/billing',
  ]) {
    const response = await app.request(path);
    equal(response.status, 200, `Public site route security: ${path} returns 200`);
    assertSecureHtmlHeaders(response, `Public site route security: ${path}`);
  }

  const packet = await app.request('/proof/financial-reporting-acceptance/packet.json');
  equal(packet.status, 200, 'Public site route security: packet evidence returns 200');
  assertEvidenceAssetHeaders(
    packet,
    'application/json; charset=utf-8',
    'Public site route security: packet evidence',
  );

  const proofIndex = await app.request('/proof/financial-reporting-acceptance/index.html');
  equal(proofIndex.status, 200, 'Public site route security: proof index returns 200');
  assertSecureHtmlHeaders(proofIndex, 'Public site route security: proof index evidence');

  const kit = await app.request('/proof/financial-reporting-acceptance/evidence/kit.json');
  equal(kit.status, 200, 'Public site route security: nested evidence returns 200');
  assertEvidenceAssetHeaders(
    kit,
    'application/json; charset=utf-8',
    'Public site route security: nested evidence',
  );

  const redirect = await app.request('/app', { redirect: 'manual' });
  equal(redirect.status, 302, 'Public site route security: legacy app route redirects');
  equal(redirect.headers.get('cache-control'), 'no-store', 'Public site route security: redirect is no-store');
}

async function main(): Promise<void> {
  await testPublicSiteHeaders();
  console.log(`Public site route security tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
