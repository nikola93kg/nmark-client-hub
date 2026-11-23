import assert from "node:assert/strict";
import { test } from "node:test";
import { safeDestination } from "../src/lib/navigation";
import { accountFilters, accountSchema, associationSchema, providerSchema, safeServiceUrl, vaultItemSchema, vaultItemUrl } from "../src/lib/service-validation";

const id = "11111111-1111-4111-8111-111111111111";
const provider = { name: "  Example  ", category: "DNS / CDN", website_url: "", dashboard_url: "https://example.test/dashboard" };
const account = { provider_id: id, label: " Example ", email: "", username: "", login_url: "", vault_item_id: "", ownership_type: "shared", notes: "" };

test("provider validation accepts the declared categories and trims names", () => {
  assert.deepEqual(providerSchema.parse(provider), {
    name: "Example", category: "DNS / CDN", website_url: null, dashboard_url: "https://example.test/dashboard",
  });
  assert.equal(providerSchema.safeParse({ ...provider, category: "Unknown" }).success, false);
  assert.equal(providerSchema.safeParse({ ...provider, name: " " }).success, false);
});

test("accounts accept blank email and username but require a provider UUID and known ownership", () => {
  const parsed = accountSchema.parse({ ...account, password: "discarded" });
  assert.equal(parsed.email, null);
  assert.equal(parsed.username, null);
  assert.equal(parsed.vault_item_id, null);
  assert.equal("password" in parsed, false);
  for (const invalid of [{ provider_id: "wrong" }, { label: "" }, { email: "wrong" }, { ownership_type: "unknown" }, { vault_item_id: "wrong" }]) {
    assert.equal(accountSchema.safeParse({ ...account, ...invalid }).success, false);
  }
});

test("service URL validation keeps sign-in links free of credentials, query parameters and fragments", () => {
  for (const url of ["javascript:alert(1)", "https://user:pass@example.test", "https://example.test/?token=demo",
    "https://example.test/#secret", "http://", "//example.test", "https://example.test/has a space"]) {
    assert.equal(accountSchema.safeParse({ ...account, login_url: url }).success, false);
    assert.equal(safeServiceUrl(url), null);
  }
  assert.equal(safeServiceUrl("https://example.test/login"), "https://example.test/login");
});

test("link validation requires an account and a meaningful purpose", () => {
  assert.deepEqual(associationSchema.parse({ service_account_id: id, purpose: "  Deployment  ", notes: " " }),
    { service_account_id: id, purpose: "Deployment", notes: null });
  assert.equal(associationSchema.safeParse({ service_account_id: id, purpose: " ", notes: "" }).success, false);
});

test("Pass Vault link uses the configured origin and an opaque UUID", () => {
  const base = "https://vault.example.test";
  assert.equal(vaultItemSchema.parse("  " + id + "  "), id);
  assert.equal(vaultItemUrl(base, id), base + "/item/" + id);
  assert.equal(vaultItemUrl(base + "/", id), base + "/item/" + id);
  assert.equal(vaultItemUrl("http://127.0.0.1:3100", id), "http://127.0.0.1:3100/item/" + id);
  for (const value of [undefined, "", "http://vault.example.test", "https://user:pass@vault.example.test", base + "/elsewhere", base + "?token=demo", base + "#entry"]) {
    assert.equal(vaultItemUrl(value, id), null);
  }
  for (const value of [null, "", "not-a-uuid", "../item/" + id, id + "?token=demo"]) assert.equal(vaultItemUrl(base, value), null);
});

test("filters and protected destinations preserve valid service routes", () => {
  assert.deepEqual(accountFilters({ q: "demo", ownership: "client", provider: id, status: "archived", page: "2" }),
    { q: "demo", ownership: "client", provider: id, status: "archived", page: 2, sort: "updated" });
  assert.equal(accountFilters({ q: " support_team+ops@example.test " }).q, "support_team+ops@example.test");
  assert.equal(accountFilters({ provider: "wrong", ownership: "bad" }).provider, "");
  const path = "/service-accounts/providers/" + id + "/edit";
  assert.equal(safeDestination(path), path);
  assert.equal(safeDestination("/service-accounts/providers/../../login"), "/");
});
