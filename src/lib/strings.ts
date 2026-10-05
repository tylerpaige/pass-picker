/** Title-case for pass field labels (e.g. `user_name` → `User Name`). */
export function titleCaseFieldLabel(raw: string): string {
  if (!raw) return raw;
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
