export const protectedPrefixes = ["/bienvenida", "/perfil", "/admin", "/cuenta-suspendida"] as const;

export function isProtectedPath(path: string) {
  return protectedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

// Only same-origin absolute paths are accepted as post-login destinations.
export function safeNextPath(value: unknown, fallback = "/perfil") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  try {
    const url = new URL(value, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
