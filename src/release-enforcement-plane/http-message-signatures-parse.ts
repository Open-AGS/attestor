import type {
  HttpMessageForSignature,
  HttpMessageSignatureAlgorithm,
} from './http-message-signatures-types.js';
import {
  componentValue,
  normalizeComponentName,
  normalizeIdentifier,
} from './http-message-signatures-utils.js';

export interface ParsedSignatureInput {
  readonly label: string;
  readonly signatureParamsValue: string;
  readonly coveredComponents: readonly string[];
  readonly params: Readonly<Record<string, string | number | boolean>>;
}

function escapeSfString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function serializeParameterValue(value: string | number | boolean): string {
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '?1' : '?0';
  }
  return `"${escapeSfString(value)}"`;
}

export function signatureParamsValue(input: {
  readonly components: readonly string[];
  readonly created: number;
  readonly expires: number | null;
  readonly keyId: string;
  readonly algorithm: HttpMessageSignatureAlgorithm;
  readonly nonce: string | null;
  readonly tag: string | null;
}): string {
  const componentList = input.components
    .map((component) => `"${escapeSfString(normalizeComponentName(component))}"`)
    .join(' ');
  const params: [string, string | number | boolean][] = [
    ['created', input.created],
  ];

  if (input.expires !== null) {
    params.push(['expires', input.expires]);
  }
  params.push(['keyid', input.keyId], ['alg', input.algorithm]);
  if (input.nonce !== null) {
    params.push(['nonce', input.nonce]);
  }
  if (input.tag !== null) {
    params.push(['tag', input.tag]);
  }

  return `(${componentList})${params
    .map(([name, value]) => `;${name}=${serializeParameterValue(value)}`)
    .join('')}`;
}

export function signatureInputHeaderValue(label: string, value: string): string {
  return `${normalizeIdentifier(label, 'label')}=${value}`;
}

export function signatureHeaderValue(label: string, signature: Buffer): string {
  return `${normalizeIdentifier(label, 'label')}=:${signature.toString('base64')}:`;
}

function splitTopLevel(input: string, separator: string): readonly string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let escaped = false;
  let depth = 0;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && inQuote) {
      current += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inQuote = !inQuote;
      current += char;
      continue;
    }
    if (!inQuote && char === '(') {
      depth += 1;
      current += char;
      continue;
    }
    if (!inQuote && char === ')') {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (!inQuote && depth === 0 && char === separator) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim().length > 0) {
    parts.push(current.trim());
  }
  return Object.freeze(parts);
}

function unquoteSfString(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) {
    return trimmed;
  }

  let output = '';
  let escaped = false;
  for (const char of trimmed.slice(1, -1)) {
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    output += char;
  }
  return output;
}

function parseParameterValue(value: string): string | number | boolean {
  const trimmed = value.trim();
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  if (trimmed === '?1') {
    return true;
  }
  if (trimmed === '?0') {
    return false;
  }
  return unquoteSfString(trimmed);
}

function parseSignatureParamsValue(value: string, label: string): ParsedSignatureInput {
  const trimmed = value.trim();
  const open = trimmed.indexOf('(');
  const close = trimmed.indexOf(')');
  if (open !== 0 || close <= open) {
    throw new Error('HTTP message signature Signature-Input must contain an inner list.');
  }

  const componentSection = trimmed.slice(open + 1, close);
  const coveredComponents = Array.from(componentSection.matchAll(/"((?:\\.|[^"\\])*)"/g))
    .map((match) => normalizeComponentName(unquoteSfString(`"${match[1] ?? ''}"`)));
  if (coveredComponents.length === 0) {
    throw new Error('HTTP message signature Signature-Input must cover at least one component.');
  }

  const params: Record<string, string | number | boolean> = {};
  for (const rawPart of splitTopLevel(trimmed.slice(close + 1), ';')) {
    if (rawPart.length === 0) {
      continue;
    }
    const equals = rawPart.indexOf('=');
    if (equals <= 0) {
      continue;
    }
    const name = rawPart.slice(0, equals).trim().toLowerCase();
    params[name] = parseParameterValue(rawPart.slice(equals + 1));
  }

  return Object.freeze({
    label,
    signatureParamsValue: trimmed,
    coveredComponents: Object.freeze(coveredComponents),
    params: Object.freeze(params),
  });
}

export function parseSignatureInput(
  input: string,
  expectedLabel: string,
): ParsedSignatureInput {
  const trimmed = normalizeIdentifier(input, 'signatureInput');
  const expected = normalizeIdentifier(expectedLabel, 'label');
  const entries = splitTopLevel(trimmed, ',');

  for (const entry of entries) {
    const equals = entry.indexOf('=');
    if (equals > 0) {
      const label = entry.slice(0, equals).trim();
      if (label === expected) {
        return parseSignatureParamsValue(entry.slice(equals + 1), label);
      }
    }
  }

  if (trimmed.startsWith('(')) {
    return parseSignatureParamsValue(trimmed, expected);
  }

  throw new Error(`HTTP message signature Signature-Input does not include ${expected}.`);
}

export function parseSignatureBytes(input: string, expectedLabel: string): Buffer {
  const trimmed = normalizeIdentifier(input, 'signature');
  const expected = normalizeIdentifier(expectedLabel, 'label');
  const entries = splitTopLevel(trimmed, ',');

  for (const entry of entries) {
    const equals = entry.indexOf('=');
    if (equals > 0) {
      const label = entry.slice(0, equals).trim();
      if (label === expected) {
        return parseBinaryValue(entry.slice(equals + 1));
      }
    }
  }

  return parseBinaryValue(trimmed);
}

export function parseBinaryValue(value: string): Buffer {
  const trimmed = value.trim();
  const binary = trimmed.startsWith(':') && trimmed.endsWith(':')
    ? trimmed.slice(1, -1)
    : trimmed;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(binary)) {
    throw new Error('HTTP message signature value must be base64.');
  }
  return Buffer.from(binary, 'base64');
}

export function numericParam(
  params: Readonly<Record<string, string | number | boolean>>,
  name: string,
): number | null {
  const value = params[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function stringParam(
  params: Readonly<Record<string, string | number | boolean>>,
  name: string,
): string | null {
  const value = params[name];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function signatureBase(
  message: HttpMessageForSignature,
  components: readonly string[],
  paramsValue: string,
): string {
  const lines = components.map(
    (component) => `"${normalizeComponentName(component)}": ${componentValue(message, component)}`,
  );
  lines.push(`"@signature-params": ${paramsValue}`);
  return lines.join('\n');
}
