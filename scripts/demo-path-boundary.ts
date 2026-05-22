import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

export interface DemoPathBoundaryOptions {
  readonly allowedRootDescriptions: readonly string[];
  readonly allowedRoots: readonly string[];
  readonly allowOutsideRoot: boolean;
  readonly overrideFlagName: string;
  readonly purpose: string;
}

function canonicalPath(path: string): string {
  return existsSync(path) ? realpathSync(path) : resolve(path);
}

function isInsideOrEqual(path: string, root: string): boolean {
  const delta = relative(root, path);
  return delta === '' || (delta !== '..' && !delta.startsWith(`..\\`) && !delta.startsWith('../') && !isAbsolute(delta));
}

export function resolveExistingPathInsideAllowedRoots(
  inputPath: string,
  options: DemoPathBoundaryOptions,
): string {
  const requested = resolve(inputPath);
  if (!existsSync(requested)) {
    throw new Error(`${options.purpose} path does not exist: ${inputPath}`);
  }

  const realRequested = canonicalPath(requested);
  const realAllowedRoots = options.allowedRoots.map((root) => canonicalPath(resolve(root)));
  const allowed = realAllowedRoots.some((root) => isInsideOrEqual(realRequested, root));

  if (allowed) return realRequested;

  if (options.allowOutsideRoot) {
    const roots = options.allowedRootDescriptions.join(', ');
    console.warn(
      `${options.overrideFlagName} accepted an out-of-basedir ${options.purpose} path. ` +
      `This is operator-local only and must not be used for public demo artifacts without redaction review. ` +
      `Approved roots: ${roots}.`,
    );
    return realRequested;
  }

  throw new Error(
    `${options.purpose} path is outside approved demo roots. ` +
    `Move it under ${options.allowedRootDescriptions.join(', ')} or pass ${options.overrideFlagName} for an operator-local override.`,
  );
}
