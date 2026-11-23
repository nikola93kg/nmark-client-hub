import assert from "node:assert/strict";
import { test } from "node:test";
import { safeDestination } from "../src/lib/navigation";
import { clientSchema, clientStatuses, listFilters, projectSchema } from "../src/lib/validation";

const client = {
  name: "  Example Studio  ", company: "", contact_person: "", email: "", phone: "",
  website: "https://example.test", country: "", city: "", address: "", status: "prospect", notes: "  ",
};
const project = {
  client_id: "6c8ac63c-0f57-4f42-a532-c0afc06ccbf4", name: "Demo site", website: "",
  project_type: "", description: "", status: "development", technology_stack: "",
  repository_url: "", cms_url: "", production_url: "", staging_url: "", technical_notes: "",
};

test("client validation trims names and stores blank optional fields as null", () => {
  const parsed = clientSchema.parse({ ...client, unexpected: "discarded" });
  assert.equal(parsed.name, "Example Studio");
  assert.equal(parsed.notes, null);
  assert.equal(parsed.email, null);
  assert.equal(parsed.website, "https://example.test");
  assert.equal("unexpected" in parsed, false);
});

test("client validation rejects malformed fields and unsafe URLs", () => {
  for (const change of [
    { name: "   " }, { email: "invalid" }, { status: "deleted" },
    { website: "javascript:alert(1)" }, { website: "https://name:password@example.test" },
  ]) assert.equal(clientSchema.safeParse({ ...client, ...change }).success, false);
});

test("project validation requires a client UUID and an allowed project status", () => {
  assert.equal(projectSchema.safeParse(project).success, true);
  for (const change of [{ client_id: "foo" }, { status: "prospect" }, { staging_url: "//example.test" }]) {
    assert.equal(projectSchema.safeParse({ ...project, ...change }).success, false);
  }
});

test("list filters preserve valid navigation and normalize invalid values", () => {
  assert.deepEqual(listFilters({ q: "  Studio  ", status: "archived", sort: "name", page: "2" }, clientStatuses),
    { q: "Studio", status: "archived", sort: "name", page: 2 });
  assert.deepEqual(listFilters({ q: ["a", "b"], status: "invalid", sort: "invalid", page: "-1" }, clientStatuses),
    { q: "", status: "", sort: "updated", page: 1 });
  assert.equal(listFilters({ q: "100%*" }, clientStatuses).q, "100");
});

test("authentication redirects preserve internal deep links only", () => {
  for (const path of ["/", "/clients?status=active", `/projects/${project.client_id}/edit`]) {
    assert.equal(safeDestination(path), path);
  }
  for (const path of ["//example.test", "https://example.test", "/\\example.test", "/clients/../../login",
    "/%2fexample.test", "/login", "/clients?\nLocation:https://example.test"]) {
    assert.equal(safeDestination(path), "/");
  }
});
