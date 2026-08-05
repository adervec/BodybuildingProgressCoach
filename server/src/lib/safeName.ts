/**
 * Media file names are generated as `<uuid><ext>`. Anything else is refused.
 *
 * These names arrive inside a sync file fetched from cloud storage and are used to build a path on
 * disk, so this is the path-traversal gate: no separators, no "..", no absolute or UNC paths, no
 * drive letters, no NUL. Kept dependency-free so it can be unit-tested on its own.
 */
export function safeMediaName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,5}$/i.test(name) ? name : null;
}
