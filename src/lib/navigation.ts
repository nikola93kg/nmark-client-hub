const hubPath = /^\/(?:settings|(?:clients|projects)(?:\/(?:new|[0-9a-f-]{36}(?:\/edit)?))?)?$/i;

export function safeDestination(value: unknown): string {
  if (typeof value !== "string" || value.length > 2000 || /[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  return hubPath.test(value.split("?")[0]) ? value : "/";
}
