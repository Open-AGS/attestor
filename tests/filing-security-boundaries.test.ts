import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertSafeQrdaXmlPayload,
  assertSchematronExternalReferencesAreLocal,
  resolvePinnedHttpsBaseUrl,
  resolveSafeCypressValidatorUrl,
} from '../src/filing/filing-security.js';
import { fetchVsacCapabilityStatement, expandVsacValueSet } from '../src/filing/vsac-api-client.js';
import { validateViaCypressApi } from '../src/filing/cypress-api-client.js';
import { validateCypressLayers } from '../src/filing/qrda3-cypress-validators.js';
import { validateQrda3Schematron } from '../src/filing/qrda3-schematron.js';
import { validateCmsSchematron } from '../src/filing/qrda3-cms-schematron.js';

let passed = 0;
function ok(condition: boolean, message: string): void {
  assert.equal(condition, true, message);
  passed += 1;
}

function testQrdaPayloadGuard(): void {
  assert.throws(
    () => assertSafeQrdaXmlPayload('<!DOCTYPE foo [<!ENTITY x "boom">]><ClinicalDocument/>'),
    /forbidden DTD\/entity/,
  );
  passed += 1;
  assert.throws(
    () => assertSafeQrdaXmlPayload('<ClinicalDocument><![CDATA[<organizer code="NUMER"/>]]></ClinicalDocument>', 'QRDA regex payload', { forbidRegexConfusingMarkup: true }),
    /comments or CDATA/,
  );
  passed += 1;
}

async function testQrdaValidatorsFailClosedOnForbiddenXml(): Promise<void> {
  const xml = '<!DOCTYPE foo [<!ENTITY x "boom">]><ClinicalDocument>&x;</ClinicalDocument>';

  const saxon = await validateQrda3Schematron(xml);
  ok(!saxon.valid, 'SaxonJS QRDA validator rejects DTD/entity payloads before parse');
  ok(saxon.assertions[0]?.ruleId === 'XML_PAYLOAD_GUARD', 'SaxonJS QRDA validator reports XML payload guard');

  const cms = await validateCmsSchematron(xml);
  ok(!cms.valid, 'CMS Schematron validator rejects DTD/entity payloads before cda-schematron-validator');
  ok(cms.errors[0]?.test === 'xml_payload_guard', 'CMS Schematron reports XML payload guard');

  const cypress = validateCypressLayers('<ClinicalDocument><!-- <organizer code="NUMER"/> --></ClinicalDocument>');
  ok(!cypress.valid, 'Cypress-equivalent regex validators reject comment-bearing XML');
  ok(cypress.layers[0]?.name === 'XmlPayloadGuard', 'Cypress-equivalent validators report XML payload guard');
}

function testSchematronExternalReferenceGuard(): void {
  const vendorSchematron = readFileSync(
    join(process.cwd(), 'vendor', 'schematron', '2026-CMS-QRDA-III', '2026_CMS_QRDA_Category_III-v1.0.sch'),
    'utf8',
  );
  assertSchematronExternalReferencesAreLocal(vendorSchematron);
  passed += 1;

  assert.throws(
    () => assertSchematronExternalReferencesAreLocal('<sch:assert test="document(\'https://attacker.example/voc.xml\')"/>'),
    /not pinned/,
  );
  passed += 1;
  assert.throws(
    () => assertSchematronExternalReferencesAreLocal('<sch:assert test="unparsed-text(\'https://attacker.example/x\')"/>'),
    /external-resource/,
  );
  passed += 1;
  assert.throws(
    () => assertSchematronExternalReferencesAreLocal('<sch:assert test="document($dynamicUri)"/>'),
    /pinned literal/,
  );
  passed += 1;
}

function testExternalServiceUrlGuards(): void {
  assert.equal(
    resolvePinnedHttpsBaseUrl('https://cts.nlm.nih.gov/fhir/', {
      serviceName: 'VSAC FHIR',
      allowedHosts: ['cts.nlm.nih.gov'],
    }),
    'https://cts.nlm.nih.gov/fhir',
  );
  passed += 1;

  assert.throws(
    () => resolvePinnedHttpsBaseUrl('http://cts.nlm.nih.gov/fhir', {
      serviceName: 'VSAC FHIR',
      allowedHosts: ['cts.nlm.nih.gov'],
    }),
    /must use HTTPS/,
  );
  passed += 1;
  assert.throws(
    () => resolvePinnedHttpsBaseUrl('https://attacker.example/fhir', {
      serviceName: 'VSAC FHIR',
      allowedHosts: ['cts.nlm.nih.gov'],
    }),
    /not allowlisted/,
  );
  passed += 1;

  assert.equal(
    resolveSafeCypressValidatorUrl('https://cypressdemo.healthit.gov', '/qrda_validation/2026/qrdaIII/cms'),
    'https://cypressdemo.healthit.gov/qrda_validation/2026/qrdaIII/cms',
  );
  passed += 1;
  assert.throws(
    () => resolveSafeCypressValidatorUrl('https://cypressdemo.healthit.gov', '@attacker.example/upload'),
    /failed safety validation/,
  );
  passed += 1;
  assert.throws(
    () => resolveSafeCypressValidatorUrl('https://cypressdemo.healthit.gov', '//attacker.example/upload'),
    /failed safety validation/,
  );
  passed += 1;
}

async function testVsacHttpGuardsDoNotFetchUnsafeTargets(): Promise<void> {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('fetch should not run for unsafe base URL');
  }) as typeof fetch;
  try {
    const capability = await fetchVsacCapabilityStatement({ baseUrl: 'http://cts.nlm.nih.gov/fhir' });
    ok(!capability.reachable, 'VSAC capability rejects HTTP base URL');
    ok(fetchCalls === 0, 'VSAC capability does not fetch rejected HTTP base URL');

    const expansion = await expandVsacValueSet({
      oid: '1.2.3',
      name: 'Test ValueSet',
      category: 'population',
      measureIds: ['CMS1'],
    }, { apiKey: 'secret', baseUrl: 'https://attacker.example/fhir' });
    ok(!expansion.valid, 'VSAC expansion rejects non-allowlisted host');
    ok(fetchCalls === 0, 'VSAC expansion does not fetch rejected host');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testVsacTimeoutAndDepthGuards(): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    ok(Boolean(init?.signal), 'VSAC fetch receives an AbortSignal timeout');
    let nested: any = { code: 'leaf' };
    for (let i = 0; i < 18; i += 1) nested = { contains: [nested] };
    return new Response(JSON.stringify({ expansion: { contains: [nested] } }), {
      status: 200,
      headers: { 'content-type': 'application/fhir+json' },
    });
  }) as typeof fetch;
  try {
    const expansion = await expandVsacValueSet({
      oid: '1.2.3',
      name: 'Nested ValueSet',
      category: 'population',
      measureIds: ['CMS1'],
    }, { apiKey: 'secret' });
    ok(!expansion.valid, 'VSAC expansion fails closed on excessive contains depth');
    ok(expansion.error?.includes('errorRef=external-request:') ?? false, 'VSAC deep expansion error is sanitized');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testCypressServerControlledPathIsPinned(): Promise<void> {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify([{
      validator: 'CMS QRDA Category III validator for 2026',
      path: '@attacker.example/upload',
    }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    const result = await validateViaCypressApi('<ClinicalDocument/>', {
      email: 'user@example.test',
      password: 'secret',
    });
    ok(!result.valid, 'Cypress API rejects server-controlled path hijack');
    ok(result.errors[0]?.message.includes('Cypress validator path failed'), 'Cypress API reports path safety validation');
    ok(fetchCalls === 1, 'Cypress API does not perform upload after path rejection');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

testQrdaPayloadGuard();
await testQrdaValidatorsFailClosedOnForbiddenXml();
testSchematronExternalReferenceGuard();
testExternalServiceUrlGuards();
await testVsacHttpGuardsDoNotFetchUnsafeTargets();
await testVsacTimeoutAndDepthGuards();
await testCypressServerControlledPathIsPinned();

console.log(`Filing security boundary tests: ${passed} passed, 0 failed`);
