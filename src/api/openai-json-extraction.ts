import { ParseError } from '../utils/errors.js';

/**
 * Extract JSON from a GPT response that may contain markdown code fences.
 */
export function extractJson<T>(content: string, stage: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]) as T;
      } catch (e) {
        throw new ParseError(
          stage,
          `JSON inside code fence is malformed: ${e instanceof Error ? e.message : String(e)}`,
          content,
        );
      }
    }

    const objStart = content.indexOf('{');
    const arrStart = content.indexOf('[');
    const start = objStart >= 0 && (arrStart < 0 || objStart < arrStart) ? objStart : arrStart;
    if (start >= 0) {
      const sub = content.slice(start);
      try {
        return JSON.parse(sub) as T;
      } catch {
        if (content[start] === '{') {
          let depth = 0;
          let end = -1;
          for (let i = start; i < content.length; i++) {
            if (content[i] === '{') depth++;
            if (content[i] === '}') {
              depth--;
              if (depth === 0) {
                end = i;
                break;
              }
            }
          }
          if (end > start) {
            try {
              return JSON.parse(content.slice(start, end + 1)) as T;
            } catch {
              // Fall through to the consistent parse error below.
            }
          }
        }
      }
    }

    throw new ParseError(stage, 'No valid JSON found in response', content.slice(0, 500));
  }
}

/**
 * Extract JSON from a tagged wrapper first, then fall back to generic extraction.
 */
export function extractTaggedJson<T>(content: string, stage: string, tagName: string): T {
  const taggedMatch = content.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'));
  if (taggedMatch) {
    const body = taggedMatch[1].trim();
    try {
      return JSON.parse(body) as T;
    } catch (err) {
      throw new ParseError(
        stage,
        `Malformed JSON inside <${tagName}>: ${err instanceof Error ? err.message : String(err)}`,
        body.slice(0, 500),
      );
    }
  }

  return extractJson<T>(content, stage);
}
