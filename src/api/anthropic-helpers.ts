import { ApiError } from '../utils/errors.js';
import {
  ANTHROPIC_RATE_LIMIT_HEADER_NAMES,
  type AnthropicRuntimePurpose,
} from './anthropic-types.js';

export function readAnthropicResponseHeaders(headers: Headers): Readonly<Record<string, string | null>> {
  return Object.freeze(Object.fromEntries(ANTHROPIC_RATE_LIMIT_HEADER_NAMES.map((name) => {
    return [name, headers.get(name)];
  })));
}

export function errorHeaders(error: unknown): Readonly<Record<string, string | null | undefined>> {
  return isRecord(error) && isRecord(error.headers)
    ? error.headers as Readonly<Record<string, string | null | undefined>>
    : {};
}

export function isRetryableAnthropicError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.statusCode === 429 || (typeof error.statusCode === 'number' && error.statusCode >= 500);
  }
  return isAbortError(error);
}

export function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === 'AbortError';
}

export function envTruthy(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

export function trimmedEnvValue(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

export function normalizeAnthropicRuntimePurpose(
  value: string | null,
): AnthropicRuntimePurpose | null {
  if (value === 'reasoning' || value === 'structured-output' || value === 'tool-routing') {
    return value;
  }
  return null;
}

export function readBoundedIntegerEnv(input: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly name: string;
  readonly defaultValue: number;
  readonly min: number;
  readonly max: number;
  readonly blockerPrefix: string;
  readonly blockers: string[];
}): number {
  const raw = input.env[input.name]?.trim();
  if (!raw) return input.defaultValue;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < input.min || parsed > input.max) {
    input.blockers.push(`${input.blockerPrefix}:invalid-${input.name.toLowerCase()}`);
    return input.defaultValue;
  }
  return parsed;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (isRecord(value)) {
    return Object.keys(value).sort().reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortJson(value[key]);
      return acc;
    }, {});
  }
  return value;
}

export function normalizeIsoTimestamp(value: string | undefined): string {
  const raw = value ?? new Date().toISOString();
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new ApiError(
      'anthropic-live-smoke-proof',
      'anthropic',
      'Anthropic live smoke checkedAt must be an ISO timestamp.',
    );
  }
  return timestamp.toISOString();
}

export function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
