import assert from "node:assert/strict";
import { test } from "node:test";
import { optionLabel, t } from "../src/lib/localization";
import { safeDestination } from "../src/lib/navigation";
import { guidedServiceSchema, isMailPurpose, purposeCategory, serviceKindFor, servicePurposeLabel } from "../src/lib/project-services";
import { projectTypeLabel, projectTypeOptions, projectTypeSelection, projectTypeValue } from "../src/lib/project-types";
import { providerSchema } from "../src/lib/service-validation";

const uuid = "11111111-1111-4111-8111-111111111111";
const service = {
  service_kind: "contact_form", provider_id: uuid, service_account_id: "", destination_email: " kontakt@ilic.example ",
  custom_purpose: "", routing_notes: "  Prosledi klijentu.  ", notes: "",
};

test("Serbian interface translates sidebar, validation, and statuses without changing enum values", () => {
  assert.deepEqual(["Dashboard", "Clients", "Projects", "Service Accounts", "Domains & Hosting", "Renewals", "Settings"].map(
    (label) => t(label as Parameters<typeof t>[0])),
  ["Kontrolna tabla", "Klijenti", "Projekti", "Servisi i pristupi", "Domeni i hosting", "Obnove i troškovi", "Podešavanja"]);
  assert.equal(optionLabel("archived"), "Arhiviran");
  assert.equal(optionLabel("Monthly"), "Mesečno");
  assert.equal(optionLabel("Web3Forms"), "Web3Forms");
  const provider = providerSchema.parse({ name: "Web3Forms", category: "Other", website_url: "", dashboard_url: "" });
  assert.deepEqual([provider.name, provider.category, optionLabel(provider.category)], ["Web3Forms", "Other", "Ostalo"]);
  const invalid = providerSchema.safeParse({ name: "Web3Forms", category: "bad", website_url: "", dashboard_url: "" });
  assert.equal(invalid.error?.issues[0].message, "Izaberi važeću opciju.");
});

test("project type catalog offers ten types and keeps editable legacy text intact", () => {
  assert.deepEqual(projectTypeOptions.map(({ label }) => label), [
    "Web sajt", "Online prodavnica", "Web aplikacija", "Mobilna aplikacija", "Softversko rešenje",
    "Redizajn sajta", "Održavanje sajta", "Landing stranica", "CMS / Blog", "Ostalo",
  ]);
  const legacy = projectTypeSelection("Legacy internal tool");
  assert.deepEqual(legacy, { choice: "legacy", previous: "Legacy internal tool" });
  assert.equal(projectTypeValue(legacy.choice, legacy.previous), "Legacy internal tool");
  assert.equal(projectTypeValue(legacy.choice, "Migrirani interni alat"), "Migrirani interni alat");
  assert.equal(projectTypeLabel("Legacy internal tool"), "Legacy internal tool");
  assert.equal(projectTypeLabel("Website"), "Web sajt");
  assert.equal(projectTypeValue("store", legacy.previous), "store");
  assert.equal(projectTypeLabel("store"), "Online prodavnica");
  assert.equal(projectTypeValue("", legacy.previous), "");
});

test("guided services support provider-only or reusable accounts with validated routing", () => {
  const config = guidedServiceSchema.parse({ ...service, access_key: "discarded-extra-field" });
  assert.equal(config.service_account_id, null);
  assert.equal(config.provider_id, uuid);
  assert.equal(config.destination_email, "kontakt@ilic.example");
  assert.equal(config.routing_notes, "Prosledi klijentu.");
  assert.equal("access_key" in config, false);
  assert.equal(isMailPurpose(config.service_kind), true);
  assert.equal(servicePurposeLabel(config.service_kind, config.purpose), "Kontakt forma");
  assert.equal(purposeCategory("contact_form"), "Other");
  assert.equal(serviceKindFor(null, "Website hosting"), "hosting");
  assert.equal(serviceKindFor(null, "Project email"), "mailbox");
  assert.equal(guidedServiceSchema.parse({ ...service, service_account_id: uuid }).service_account_id, uuid);
  assert.equal(guidedServiceSchema.safeParse({ ...service, provider_id: "" }).success, false);
  assert.equal(guidedServiceSchema.safeParse({ ...service, destination_email: "not-an-email" }).success, false);
  assert.equal(guidedServiceSchema.safeParse({ ...service, service_kind: "analytics" }).success, false);
  const custom = guidedServiceSchema.parse({ ...service, service_kind: "other", custom_purpose: "Mapa sajta", destination_email: "", routing_notes: "" });
  assert.equal(servicePurposeLabel(custom.service_kind, custom.purpose), "Mapa sajta");
  assert.equal(safeDestination("/projects/" + uuid + "/services/new?kind=contact_form"),
    "/projects/" + uuid + "/services/new?kind=contact_form");
});
