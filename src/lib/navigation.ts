const servicesPath = /^\/service-accounts(?:\/(?:new|[0-9a-f-]{36}(?:\/edit)?|providers(?:\/(?:new|[0-9a-f-]{36}(?:\/edit)?))?))?$/i;
const hubPath = /^\/(?:settings|(?:clients|projects)(?:\/(?:new|[0-9a-f-]{36}(?:\/edit)?))?)?$/i;

export function safeDestination(value: unknown): string {
  if (typeof value !== "string" || value.length > 2000 || /[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  const path = value.split("?")[0];
  return hubPath.test(path) || servicesPath.test(path) ? value : "/";
}
