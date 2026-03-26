/** Title-case for pass field labels (e.g. `user_name` → `User Name`). */
export function titleCaseFieldLabel(raw: string): string {
  if (!raw) return raw;
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/** Capitalize the first letter of each `/`-separated path segment for display. */
export function formatEntryPathTitle(path: string): string {
  if (!path) return path;
  return path
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join("/");
}
