import assert from "node:assert/strict";
import { test } from "node:test";
import { businessDate, businessTimezone, calendarLabel, currencyTotals, currencyTotalLabel, dateOffset, daysUntil, expectedCosts, moneyLabel, renewalBucket, tracksRenewal } from "../src/lib/renewals";

test("calendar dates follow the configured business timezone and remain stable across DST", () => {
  const instant = new Date("2026-03-28T23:30:00Z");
  assert.equal(businessTimezone(undefined), "Europe/Belgrade");
  assert.equal(businessTimezone("Invalid/Timezone"), "Europe/Belgrade");
  assert.equal(businessDate(instant, "Europe/Belgrade"), "2026-03-29");
  assert.equal(businessDate(instant, "America/New_York"), "2026-03-28");
  assert.equal(daysUntil("2026-03-30", "2026-03-29"), 1);
  assert.equal(daysUntil("2026-10-26", "2026-10-25"), 1);
  assert.equal(dateOffset("2026-12-31", 1), "2027-01-01");
  assert.equal(calendarLabel("2026-03-29"), "29 Mar 2026");
  assert.equal(calendarLabel(null), "Unknown");
});

test("renewal windows are exclusive, overdue stays overdue and today is upcoming", () => {
  assert.deepEqual([-1, 0, 7, 8, 14, 15, 30, 31, 60, 61, null].map(renewalBucket),
    ["overdue", "7", "7", "14", "14", "30", "30", "60", "60", "later", "unknown"]);
  assert.equal(daysUntil("2026-11-22", "2026-11-23"), -1);
  assert.equal(daysUntil(null, "2026-11-23"), null);
  assert.equal(tracksRenewal("archived"), false);
  assert.equal(tracksRenewal("inactive"), false);
  assert.equal(tracksRenewal("expired"), true);
});

test("upcoming costs use cents, group currencies and exclude unknown dates, overdue and later records", () => {
  const client = { id: "client", name: "Client" };
  const provider = { id: "provider", name: "Provider" };
  const rows = [
    { kind: "domains", days: 0, amount: 0.1, currency: "EUR", client, provider: null },
    { kind: "hosting", days: 60, amount: 0.2, currency: "EUR", client, provider },
    { kind: "hosting", days: 20, amount: 12, currency: "USD", client, provider },
    { kind: "domains", days: 9, amount: 2400.05, currency: "RSD", client, provider },
    { kind: "domains", days: 9, amount: null, currency: null, client, provider },
    { kind: "domains", days: -1, amount: 40, currency: "EUR", client, provider },
    { kind: "domains", days: 61, amount: 50, currency: "EUR", client, provider },
    { kind: "domains", days: null, amount: 100, currency: "EUR", client, provider },
  ] as const;
  const costs = expectedCosts([...rows]);
  assert.deepEqual(costs.total.map(currencyTotalLabel), ["EUR 0.30", "RSD 2,400.05", "USD 12.00"]);
  assert.deepEqual(costs.domains.map(currencyTotalLabel), ["EUR 0.10", "RSD 2,400.05"]);
  assert.deepEqual(costs.hosting.map(currencyTotalLabel), ["EUR 0.20", "USD 12.00"]);
  assert.deepEqual(costs.client[0].totals, costs.total);
  assert.deepEqual(costs.provider.find(({ id }) => id === "")?.totals, [{ currency: "EUR", cents: 10n }]);
  assert.equal(costs.unknownAmounts, 1);
  assert.deepEqual(currencyTotals([{ amount: 20, currency: "USD" }, { amount: null, currency: "USD" }]), [{ currency: "USD", cents: 2000n }]);
  assert.equal(moneyLabel(0, "EUR"), "EUR 0.00");
});
