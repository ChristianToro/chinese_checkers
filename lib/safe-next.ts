/**
 * Where to send the user after signing in. Only same-site paths are allowed:
 * "//evil.example" and "/\evil.example" are protocol-relative to browsers, so
 * an open redirect would otherwise slip through a plain startsWith("/").
 */
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
