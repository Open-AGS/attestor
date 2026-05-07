import { createHash } from 'node:crypto';

const DEFAULT_FETCH_TIMEOUT_MS = 30000;
const MAX_QRDA3_XML_BYTES = 10 * 1024 * 1024;
const FORBIDDEN_XML_DECLARATION = /<!\s*(?:DOCTYPE|ENTITY)\b/i;
const REGEX_VALIDATOR_CONFUSING_XML = /<!\[CDATA\[|<!--/iu;
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/u;
const CYPRESS_PATH_CHARACTERS = new Set(
  '/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._~-'.split(''),
);

export function assertSafeQrdaXmlPayload(
  xml: string,
  label = 'QRDA3 XML payload',
  options: { readonly forbidRegexConfusingMarkup?: boolean } = {},
): void {
  if (Buffer.byteLength(xml, 'utf8') > MAX_QRDA3_XML_BYTES) {
    throw new Error(`${label} exceeds the ${MAX_QRDA3_XML_BYTES} byte size limit.`);
  }
  if (FORBIDDEN_XML_DECLARATION.test(xml)) {
    throw new Error(`${label} contains forbidden DTD/entity declarations.`);
  }
  if (options.forbidRegexConfusingMarkup && REGEX_VALIDATOR_CONFUSING_XML.test(xml)) {
    throw new Error(`${label} contains comments or CDATA that the regex validator cannot safely interpret.`);
  }
}

export function assertSchematronExternalReferencesAreLocal(
  schematronXml: string,
  allowedDocumentRefs = ['voc.xml'],
): void {
  const allowed = new Set(allowedDocumentRefs);
  const xpathExpressions = [...schematronXml.matchAll(/\b(?:test|context)\s*=\s*"([^"]*)"|\b(?:test|context)\s*=\s*'([^']*)'/giu)]
    .map((match) => match[1] ?? match[2])
    .join('\n');

  if (/\b(?:doc|collection|unparsed-text)\s*\(/iu.test(xpathExpressions)) {
    throw new Error('Schematron contains external-resource XPath functions outside the approved document() allowlist.');
  }

  const documentCallCount = xpathExpressions.match(/\bdocument\s*\(/giu)?.length ?? 0;
  const documentCallPattern = /\bdocument\s*\(\s*(['"])([^'"]+)\1\s*\)/giu;
  let literalDocumentCallCount = 0;
  let match: RegExpExecArray | null;
  while ((match = documentCallPattern.exec(xpathExpressions)) !== null) {
    literalDocumentCallCount += 1;
    const ref = match[2];
    if (!allowed.has(ref)) {
      throw new Error(`Schematron document() reference is not pinned to an allowed local artifact: ${ref}`);
    }
  }
  if (literalDocumentCallCount !== documentCallCount) {
    throw new Error('Schematron document() references must use pinned literal local artifacts.');
  }
}

export function resolvePinnedHttpsBaseUrl(
  rawBaseUrl: string,
  options: {
    readonly serviceName: string;
    readonly allowedHosts: readonly string[];
  },
): string {
  let parsed: URL;
  try {
    parsed = new URL(rawBaseUrl.trim());
  } catch {
    throw new Error(`${options.serviceName} base URL is not a valid URL.`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${options.serviceName} base URL must use HTTPS.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${options.serviceName} base URL must not contain embedded credentials.`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`${options.serviceName} base URL must not contain query or fragment components.`);
  }

  const normalizedHost = parsed.hostname.toLowerCase().replace(/\.$/u, '');
  const allowedHosts = options.allowedHosts.map((host) => host.toLowerCase());
  if (!allowedHosts.includes(normalizedHost)) {
    throw new Error(`${options.serviceName} base URL host is not allowlisted.`);
  }

  return parsed.toString().replace(/\/+$/u, '');
}

export function resolveSafeCypressValidatorUrl(baseUrl: string, path: string): string {
  const trimmed = path.trim();
  if (
    !trimmed.startsWith('/')
    || trimmed.startsWith('//')
    || trimmed.includes('://')
    || trimmed.includes('@')
    || trimmed.includes('\\')
    || trimmed.includes('..')
    || CONTROL_CHARACTER.test(trimmed)
  ) {
    throw new Error('Cypress validator path failed safety validation.');
  }
  for (const char of trimmed) {
    if (!CYPRESS_PATH_CHARACTERS.has(char)) {
      throw new Error('Cypress validator path contains unsupported characters.');
    }
  }

  const base = new URL(baseUrl);
  const resolved = new URL(trimmed, base);
  if (resolved.origin !== base.origin) {
    throw new Error('Cypress validator path resolves outside the Cypress origin.');
  }
  return resolved.toString();
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const boundedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.trunc(timeoutMs)
    : DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), boundedTimeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function publicExternalRequestError(prefix: string, err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const errorRef = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return `${prefix} errorRef=external-request:${errorRef}`;
}
