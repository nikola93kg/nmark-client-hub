import type { AssetKind } from "./infrastructure-validation";

export const defaultBusinessTimezone = "Europe/Belgrade";
const dayMs = 86400000;

export function businessTimezone(setting: string | undefined) {
  const zone = setting?.trim() || defaultBusinessTimezone;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return zone;
  } catch {
    return defaultBusinessTimezone;
  }
}

export function businessDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone, calendar: "iso8601", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (part: Intl.DateTimeFormatPartTypes) => parts.find(({ type }) => type === part)?.value ?? "";
  return `${get("year").padStart(4, "0")}-${get("month")}-${get("day")}`;
}

const dateTimestamp = (date: string) => Date.parse(date + "T00:00:00Z");
export function daysUntil(date: string | null, today: string) {
  if (!date) return null;
  const days = (dateTimestamp(date) - dateTimestamp(today)) / dayMs;
  return Number.isFinite(days) ? days : null;
}
export const dateOffset = (date: string, days: number) => new Date(dateTimestamp(date) + days * dayMs).toISOString().slice(0, 10);

export function calendarLabel(date: string | null) {
  const timestamp = date ? dateTimestamp(date) : NaN;
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", dateStyle: "medium" }).format(timestamp) : "Unknown";
}

export const renewalBuckets = [
  ["overdue", "Overdue"],
  ["7", "Due within 7 days"],
  ["14", "Due in 8–14 days"],
  ["30", "Due in 15–30 days"],
  ["60", "Due in 31–60 days"],
  ["later", "Upcoming later"],
  ["unknown", "Unknown renewal dates"],
] as const;
export type RenewalBucket = (typeof renewalBuckets)[number][0];

export function renewalBucket(days: number | null): RenewalBucket {
  if (days === null) return "unknown";
  if (days < 0) return "overdue";
  if (days <= 7) return "7";
  if (days <= 14) return "14";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  return "later";
}

export const tracksRenewal = (status: string) => status !== "archived" && status !== "inactive";

export function renewalTiming(days: number | null) {
  if (days === null) return "Unknown date";
  if (days === 0) return "Due today";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${-days} days overdue`;
  return days === 1 ? "Due in 1 day" : `Due in ${days} days`;
}

type Money = { amount: number | null; currency: string | null };
export type CurrencyTotal = { currency: string; cents: bigint };

export function currencyTotals(values: Iterable<Money>): CurrencyTotal[] {
  const totals = new Map<string, bigint>();
  for (const { amount, currency } of values) {
    if (amount === null || !Number.isFinite(amount) || !currency) continue;
    const cents = BigInt(Math.round(amount * 100));
    totals.set(currency, (totals.get(currency) ?? 0n) + cents);
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, cents]) => ({ currency, cents }));
}

export function moneyLabel(amount: number | null, currency: string | null) {
  return amount === null || !Number.isFinite(amount) || !currency ? "Unknown" : currencyTotalLabel({ currency, cents: BigInt(Math.round(amount * 100)) });
}

export function currencyTotalLabel({ currency, cents }: CurrencyTotal) {
  return `${currency} ${(cents / 100n).toLocaleString("en-GB")}.${String(cents % 100n).padStart(2, "0")}`;
}

type Target = { id: string; name: string };
type CostRow = Money & { kind: AssetKind; days: number | null; client: Target; provider: Target | null };

export function expectedCosts(rows: CostRow[]) {
  const upcoming = rows.filter(({ days }) => days !== null && days >= 0 && days <= 60);
  const by = (key: "client" | "provider") => {
    const groups = new Map<string, { name: string; rows: CostRow[] }>();
    for (const row of upcoming) {
      const { id, name } = row[key] ?? { id: "", name: "Provider unknown" };
      const group = groups.get(id) ?? { name, rows: [] };
      group.rows.push(row);
      groups.set(id, group);
    }
    return [...groups].map(([id, { name, rows }]) => ({ id, name, totals: currencyTotals(rows) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };
  return {
    total: currencyTotals(upcoming),
    domains: currencyTotals(upcoming.filter(({ kind }) => kind === "domains")),
    hosting: currencyTotals(upcoming.filter(({ kind }) => kind === "hosting")),
    client: by("client"),
    provider: by("provider"),
    unknownAmounts: upcoming.filter(({ amount, currency }) => amount === null || !Number.isFinite(amount) || !currency).length,
  };
}
