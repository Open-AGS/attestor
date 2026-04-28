import { timingSafeEqual } from 'node:crypto';

const HEX_PATTERN = /^[0-9a-f]+$/i;

export function timingSafeEqualHex(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left || !right) return false;
  if (left.length !== right.length || left.length % 2 !== 0) return false;
  if (!HEX_PATTERN.test(left) || !HEX_PATTERN.test(right)) return false;

  const leftBytes = Buffer.from(left, 'hex');
  const rightBytes = Buffer.from(right, 'hex');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
