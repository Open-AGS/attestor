/**
 * Shared helpers for the financial operator CLI.
 */

export type SqlGenerationMetadata = {
  provider: 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
};

export function roundUsd(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function estimateOpenAICostUsd(inputTokens: number, outputTokens: number, cachedInputTokens: number): number {
  const paidInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  return roundUsd((paidInputTokens * 2.5 + outputTokens * 15) / 1_000_000);
}

export function extractSql(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:sql)?\s*([\s\S]*?)```/iu);
  const raw = fenced ? fenced[1].trim() : trimmed.replace(/^sql:\s*/iu, '').trim();
  return raw.replace(/;+\s*$/u, '');
}

export function looksCompleteSql(sql: string): boolean {
  if (!/^\s*select\b/iu.test(sql)) return false;
  return !/\b(select|from|where|join|and|or|order\s+by|group\s+by)\s*$/iu.test(sql.trim());
}


/** Format an environment variable assignment for the current shell. */
export function envSet(name: string, value: string): string {
  if (process.platform === 'win32') {
    return `$env:${name}='${value}'`;
  }
  return `export ${name}=${value}`;
}

/** Shell name for operator context. */
export function shellName(): string {
  return process.platform === 'win32' ? 'PowerShell' : 'bash/zsh';
}
