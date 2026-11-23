import assert from "node:assert/strict";
import { test } from "node:test";
import { assetFilters, canonicalDomain, domainSchema, hostingSchema, renewalSchema } from "../src/lib/infrastructure-validation";
import { safeDestination } from "../src/lib/navigation";

const id = "11111111-1111-4111-8111-111111111111";
const shared = { project_id: id, renewal_price: "", currency: "", auto_renew: "no", renewal_responsibility: "client", notes: "" };
const domain = { ...shared, name: "NEW.Example.", registrar_account_id: "", registered_on: "", expires_on: "", status: "active" };
const hosting = { ...shared, hosting_account_id: id, hosting_type: "VPS", plan_name: "  Project plan ", server_notes: "",
  billing_cycle: "Monthly", renews_on: "", status: "active" };
const renewal = { renewed_on: "2026-11-23", period_start: "", period_end: "", paid_amount: "", currency: "", paid_on: "",
  payment_status: "unpaid", next_renewal_on: "", notes: "" };

test("domain forms normalize DNS names, accept IDNs and reject URLs, IPs and invalid labels", () => {
  assert.equal(domainSchema.parse(domain).name, "new.example");
  assert.equal(canonicalDomain("bücher.example"), "xn--bcher-kva.example");
  for (const input of ["https://foo.example", "foo.example/path", "foo@example.com", "foo.example:80", "127.0.0.1",
    "localhost", "-a.example", "foo..example", "a".repeat(64) + ".example"]) {
    assert.equal(canonicalDomain(input), null);
  }
  assert.equal(domainSchema.parse(domain).registrar_account_id, null);
  assert.equal(domainSchema.safeParse({ ...domain, registered_on: "2026-12-01", expires_on: "2026-11-30" }).success, false);
  assert.equal(domainSchema.safeParse({ ...domain, expires_on: "2026-02-29" }).success, false);
  assert.equal(domainSchema.parse({ ...domain, expires_on: "2028-02-29" }).expires_on, "2028-02-29");
});

test("hosting forms require existing IDs, supported types, billing cycle and responsibility", () => {
  const value = hostingSchema.parse({ ...hosting, renewal_price: "20,50", currency: "eur", auto_renew: "yes" });
  assert.deepEqual([value.plan_name, value.renewal_price, value.currency, value.auto_renew], ["Project plan", 20.5, "EUR", true]);
  for (const invalid of [{ hosting_account_id: "" }, { project_id: "wrong" }, { hosting_type: "Unknown" },
    { billing_cycle: "" }, { renewal_responsibility: "" }, { renewal_price: "100" }, { renewal_price: "-1", currency: "EUR" },
    { renewal_price: "50.005", currency: "EUR" }]) {
    assert.equal(hostingSchema.safeParse({ ...hosting, ...invalid }).success, false);
  }
});

test("renewal inputs validate dates, paid amounts and optional schedule changes independently", () => {
  assert.equal(renewalSchema.parse(renewal).next_renewal_on, null);
  assert.equal(renewalSchema.parse({ ...renewal, payment_status: "paid", paid_amount: "0", currency: "RSD" }).paid_amount, 0);
  assert.equal(renewalSchema.parse({ ...renewal, renewed_on: "2026-11-23", next_renewal_on: "2027-11-23" }).next_renewal_on, "2027-11-23");
  for (const invalid of [{ renewed_on: "2026-11-31" }, { renewed_on: "0000-01-01" }, { paid_on: "2026-11-23" },
    { payment_status: "paid" }, { paid_amount: "5", currency: "" }, { next_renewal_on: "2026-11-23" },
    { period_start: "2026-11-24", period_end: "2026-11-23" }]) {
    assert.equal(renewalSchema.safeParse({ ...renewal, ...invalid }).success, false);
  }
});

test("filters retain literal search text and protected infrastructure deep links", () => {
  assert.deepEqual(assetFilters({ q: " test.example ", project: id, sort: "name", status: "expired", page: "2" }, "domains"),
    { q: "test.example", status: "expired", sort: "name", page: 2, project: id });
  assert.equal(assetFilters({ status: "expired" }, "hosting").status, "");
  const valid = "/hosting/" + id + "/renew";
  assert.equal(safeDestination(valid), valid);
  assert.equal(safeDestination("/renewals?window=overdue"), "/renewals?window=overdue");
  assert.equal(safeDestination("/domains/../../login"), "/");
});
