import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function testGlossaryKeepsCoreBoundaries(): void {
  const doc = readProjectFile('docs', '02-architecture', 'glossary.md');

  includes(doc, '# Glossary', 'Glossary: title is present');
  includes(doc, 'This is a navigation reference, not a production-readiness claim.', 'Glossary: no-claim is explicit');
  includes(doc, 'decision is not enforcement', 'Glossary: decision/enforcement split is visible');
  includes(doc, 'evidence is not approval', 'Glossary: evidence/approval split is visible');
  includes(doc, 'proof is not certification', 'Glossary: proof/certification split is visible');
  includes(doc, 'shadow is not production', 'Glossary: shadow/production split is visible');
  includes(doc, 'pack is not product', 'Glossary: pack/product split is visible');
}

function testGlossaryDefinesDecisionAndAuthorityVocabulary(): void {
  const doc = readProjectFile('docs', '02-architecture', 'glossary.md');

  for (const expected of [
    '| `admit` |',
    '| `narrow` |',
    '| `review` |',
    '| `block` |',
    '| PDP |',
    '| PEP |',
    '| Customer PEP / gate |',
    '| Approval provenance |',
  ]) {
    includes(doc, expected, `Glossary: defines ${expected}`);
  }

  includes(doc, 'A free-text "approved" note.', 'Glossary: approval provenance does not accept free-text authority');
  includes(doc, 'A repo-side fact or local test by itself.', 'Glossary: customer PEP no-claim is explicit');
}

function testGlossaryDefinesEvidenceReadinessAndPackVocabulary(): void {
  const doc = readProjectFile('docs', '02-architecture', 'glossary.md');

  for (const expected of [
    '| Evidence |',
    '| Audit proof |',
    '| Live proof |',
    '| Deployment proof |',
    '| Production-ready |',
    '| Enterprise-ready |',
    '| Domain pack |',
    '| Programmable Money |',
  ]) {
    includes(doc, expected, `Glossary: defines ${expected}`);
  }

  includes(doc, 'A wallet, custodian, signer, broadcaster, or exchange.', 'Glossary: crypto no-claim is explicit');
  includes(doc, 'Evaluation release readiness.', 'Glossary: production-ready boundary is explicit');
}

function testGlossaryKeepsAntiCollapseLanguage(): void {
  const doc = readProjectFile('docs', '02-architecture', 'glossary.md');

  includes(doc, '## Do Not Collapse These', 'Glossary: anti-collapse section is present');
  includes(doc, '"The API enforces the action."', 'Glossary: blocks API enforcement overclaim');
  includes(doc, '"The crypto pack executes transactions."', 'Glossary: blocks crypto execution overclaim');
  includes(doc, '"Policy Foundry writes policy."', 'Glossary: blocks Policy Foundry auto-policy overclaim');
  includes(doc, '"A pack is a product."', 'Glossary: blocks pack/product collapse');
}

function testGlossaryLinksResolveAndUsesPrimaryAnchors(): void {
  const docPath = join(process.cwd(), 'docs', '02-architecture', 'glossary.md');
  const doc = readFileSync(docPath, 'utf8');
  const docDir = dirname(docPath);
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  const missing: string[] = [];

  for (const match of doc.matchAll(linkPattern)) {
    const href = match[1];
    if (/^https?:\/\//iu.test(href) || href.startsWith('#')) continue;
    const pathOnly = href.split('#')[0];
    const resolved = normalize(join(docDir, pathOnly));
    if (!existsSync(resolved)) missing.push(href);
  }

  assert.deepEqual(missing, [], 'Glossary: all relative links resolve');
  passed += 1;

  includes(doc, 'https://csrc.nist.gov/glossary/term/policy_enforcement_point', 'Glossary: links NIST PEP glossary');
  includes(doc, 'https://www.nist.gov/publications/zero-trust-architecture', 'Glossary: links NIST SP 800-207 page');
  includes(doc, 'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/', 'Glossary: links OWASP Agentic AI source');
  includes(doc, 'https://diataxis.fr/reference/', 'Glossary: links Diataxis reference source');
}

function testNavigationSurfacesLinkGlossary(): void {
  const readme = readProjectFile('README.md');
  const navigator = readProjectFile('docs', '01-overview', 'repository-navigator.md');

  includes(readme, '[Glossary](docs/02-architecture/glossary.md)', 'Glossary: README maintainer reference links glossary');
  includes(navigator, '[Glossary](../02-architecture/glossary.md)', 'Glossary: repository navigator links glossary');
}

function testGlossaryAvoidsVendorLanguage(): void {
  const doc = readProjectFile('docs', '02-architecture', 'glossary.md');

  excludes(doc, /\bempower\b/iu, 'Glossary: avoids vendor copy');
  excludes(doc, /\btransform\b/iu, 'Glossary: avoids vendor copy');
  excludes(doc, /\brevolutionize\b/iu, 'Glossary: avoids vendor copy');
  excludes(doc, /\bbest[- ]in[- ]class\b/iu, 'Glossary: avoids vendor copy');
  excludes(doc, /\benterprise[- ]grade\b/iu, 'Glossary: avoids vendor copy');
  excludes(doc, /\bmission[- ]critical\b/iu, 'Glossary: avoids vendor copy');
}

testGlossaryKeepsCoreBoundaries();
testGlossaryDefinesDecisionAndAuthorityVocabulary();
testGlossaryDefinesEvidenceReadinessAndPackVocabulary();
testGlossaryKeepsAntiCollapseLanguage();
testGlossaryLinksResolveAndUsesPrimaryAnchors();
testNavigationSurfacesLinkGlossary();
testGlossaryAvoidsVendorLanguage();

console.log(`Glossary docs tests: ${passed} passed, 0 failed`);
