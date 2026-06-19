export function normalizeGeneratedAt(
  value: string | null | undefined,
  fallback: string,
): string {
  const timestamp = new Date(value ?? fallback);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Shadow runtime pipeline generatedAt must be an ISO timestamp.');
  }
  return timestamp.toISOString();
}

export function normalizeReviewCapacity(value: number | null | undefined): number {
  if (value === null || value === undefined) return 20;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      'Shadow runtime pipeline reviewerCapacityPerHour must be a non-negative integer.',
    );
  }
  return value;
}

export function normalizeReviewRate(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      'Shadow runtime pipeline currentReviewRatePerMinute must be a non-negative number.',
    );
  }
  return value;
}
