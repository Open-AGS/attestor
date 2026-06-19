import { normalizeIdentifier } from './async-envelope-normalize.js';

export function digestHex(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!normalized.startsWith('sha256:')) {
    throw new Error(`Async consequence envelope ${fieldName} must use sha256:<hex> form.`);
  }
  const hex = normalized.slice('sha256:'.length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error(`Async consequence envelope ${fieldName} must contain a SHA-256 hex digest.`);
  }
  return hex;
}
