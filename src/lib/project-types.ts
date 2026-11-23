import { t, type Message } from "./localization";

const types = {
  website: "Project type website",
  store: "Project type store",
  web_app: "Project type web app",
  mobile_app: "Project type mobile app",
  software: "Project type software",
  redesign: "Project type redesign",
  maintenance: "Project type maintenance",
  landing: "Project type landing",
  cms_blog: "Project type cms",
  other: "Project type other",
} as const satisfies Record<string, Message>;

export type ProjectType = keyof typeof types;
export const projectTypeOptions = Object.entries(types).map(([value, message]) => ({ value, label: t(message) }));

function isProjectType(value: string): value is ProjectType {
  return Object.hasOwn(types, value);
}

export function projectTypeLabel(value: string | null) {
  if (!value) return null;
  if (isProjectType(value)) return t(types[value]);
  if (value === "Website") return t("Project type website");
  return value;
}

export function projectTypeSelection(value: string | null) {
  if (!value) return { choice: "", previous: "" };
  return isProjectType(value) ? { choice: value, previous: "" } : { choice: "legacy", previous: value };
}

export function projectTypeValue(choice: string, previous: string) {
  return choice === "legacy" ? previous : isProjectType(choice) ? choice : "";
}
