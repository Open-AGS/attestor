const FORWARD_SLASH_CODE_POINT = 47;

export function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === FORWARD_SLASH_CODE_POINT) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

export function trimAndStripTrailingSlashes(value: string): string {
  return stripTrailingSlashes(value.trim());
}
