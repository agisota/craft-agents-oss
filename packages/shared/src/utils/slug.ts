/**
 * Shared slug generation (no Node.js dependencies).
 */

/**
 * Generate a URL/filesystem-safe slug from a name.
 * Falls back to `fallback` when the name reduces to empty.
 */
export function generateSlug(name: string, fallback = 'workspace'): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  return slug || fallback;
}
