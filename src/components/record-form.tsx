"use client";

import { optionLabel, t } from "@/lib/localization";
import Link from "next/link";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues, type FieldValues, type Path, type Resolver } from "react-hook-form";
import { Save } from "lucide-react";
import { z } from "zod";
import { saveRecord } from "@/app/(hub)/record-actions";
import type { Client, ClientOption, Project } from "@/lib/database";
import { projectTypeOptions, projectTypeSelection, projectTypeValue } from "@/lib/project-types";
import { clientSchema, clientStatuses, projectSchema, projectStatuses } from "@/lib/validation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Option = { value: string; label: string };
type Field<T> = {
  name: Path<T>;
  label: string;
  kind?: "email" | "tel" | "url" | "date" | "textarea";
  inputMode?: "decimal";
  emptyLabel?: string;
  options?: Option[];
  optional?: boolean;
  wide?: boolean;
  maxLength?: number;
  hint?: string;
};
export type FieldGroup<T> = { title: string; fields: Field<T>[] };
type ClientValues = z.input<typeof clientSchema>;
const projectFormSchema = projectSchema.extend({ project_type_choice: z.string() });
type ProjectValues = z.input<typeof projectFormSchema>;

const statuses = (values: readonly string[]) => values.map((value) => ({ value, label: optionLabel(value) }));

export function RecordForm<T extends FieldValues>({ onSave, submitLabel, groups, defaultValues, resolver, cancelUrl }: {
  onSave: (values: T) => Promise<{ error?: string }>;
  submitLabel: string;
  groups: FieldGroup<T>[];
  defaultValues: DefaultValues<T>;
  resolver: Resolver<T>;
  cancelUrl: string;
}) {
  const { register, handleSubmit, getValues, getFieldState, formState } = useForm<T>({ defaultValues, resolver });
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <form className="record-form" noValidate onSubmit={handleSubmit(() => {
      setError(undefined);
      startTransition(async () => {
        const result = await onSave(getValues());
        if (result.error) setError(result.error);
      });
    })}>
      {groups.map(({ title, fields }) => (
        <fieldset className="panel form-panel" key={title} disabled={pending}>
          <div className="panel-heading"><h2>{title}</h2></div>
          <div className="form-grid">
            {fields.map((field) => {
              const message = getFieldState(field.name, formState).error?.message;
              const errorId = field.name + "-error";
              const hintId = field.name + "-hint";
              const labelId = field.name + "-label";
              const props = {
                ...register(field.name), id: field.name, required: !field.optional,
                "aria-labelledby": labelId, "aria-invalid": !!message,
                "aria-describedby": [message && errorId, field.hint && hintId].filter(Boolean).join(" ") || undefined,
              };
              return (
                <label className={field.wide ? "field field-wide" : "field"} key={field.name} htmlFor={field.name}>
                  <span><span id={labelId}>{field.label}</span>{!field.optional && <span className="required-mark" aria-hidden> *</span>}</span>
                  {field.options ? (
                    <select className="field-control" {...props}>
                      <option value="" disabled={!field.optional}>{field.emptyLabel ?? t(field.optional ? "No selection" : "Choose an option")}</option>
                      {field.options.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  ) : field.kind === "textarea" ? (
                    <textarea className="field-control" rows={5} maxLength={field.maxLength} {...props} />
                  ) : (
                    <Input type={field.kind ?? "text"} maxLength={field.maxLength} inputMode={field.inputMode} {...props} />
                  )}
                  {field.hint && <span className="field-hint" id={hintId}>{field.hint}</span>}
                  {message && <span id={errorId} className="field-error" role="alert">{message}</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div className="form-footer">
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button asChild variant="outline"><Link href={cancelUrl}>{t("Cancel")}</Link></Button>
        <Button disabled={pending}><Save size={16} aria-hidden /> {pending ? t("Saving…") : submitLabel}</Button>
      </div>
    </form>
  );
}

const clientGroups: FieldGroup<ClientValues>[] = [
  { title: t("Client information"), fields: [
    { name: "name", label: t("Client name"), maxLength: 160 },
    { name: "company", label: t("Company or business name"), optional: true, maxLength: 160 },
    { name: "status", label: t("Status"), options: statuses(clientStatuses) },
    { name: "website", label: t("Website"), kind: "url", optional: true, maxLength: 2048 },
  ] },
  { title: t("Contact and location"), fields: [
    { name: "contact_person", label: t("Contact person"), optional: true, maxLength: 160 },
    { name: "email", label: t("Email"), kind: "email", optional: true, maxLength: 254 },
    { name: "phone", label: t("Phone"), kind: "tel", optional: true, maxLength: 80 },
    { name: "country", label: t("Country"), optional: true, maxLength: 120 },
    { name: "city", label: t("City"), optional: true, maxLength: 120 },
    { name: "address", label: t("Address"), optional: true, maxLength: 300 },
  ] },
  { title: t("Notes"), fields: [
    { name: "notes", label: t("General notes"), kind: "textarea", wide: true, optional: true, maxLength: 10000 },
  ] },
];

export function ClientForm({ client }: { client?: Client }) {
  const values: ClientValues = {
    name: client?.name ?? "", company: client?.company ?? "", contact_person: client?.contact_person ?? "",
    email: client?.email ?? "", phone: client?.phone ?? "", website: client?.website ?? "",
    country: client?.country ?? "", city: client?.city ?? "", address: client?.address ?? "",
    status: client?.status ?? "prospect", notes: client?.notes ?? "",
  };

  return <RecordForm onSave={(input) => saveRecord("clients", client?.id, input)} submitLabel={t("Save client")} groups={clientGroups} defaultValues={values}
    resolver={zodResolver(clientSchema, undefined, { raw: true })}
    cancelUrl={client ? `/clients/${client.id}` : "/clients"} />;
}

export function ProjectForm({ project, clients, clientId }: { project?: Project; clients: ClientOption[]; clientId?: string }) {
  const { choice, previous } = projectTypeSelection(project?.project_type ?? null);
  const typeOptions = previous
    ? [...projectTypeOptions, { value: "legacy", label: t("Project type previous") }]
    : projectTypeOptions;
  const groups: FieldGroup<ProjectValues>[] = [
    { title: t("Project information"), fields: [
      { name: "name", label: t("Project name"), maxLength: 160 },
      { name: "client_id", label: t("Client"), options: clients.map(({ id, name, status }) => ({ value: id, label: status === "archived" ? t("{name} (archived)", { name }) : name })) },
      { name: "status", label: t("Status"), options: statuses(projectStatuses) },
      { name: "project_type_choice", label: t("Project type"), optional: true, emptyLabel: t("Project type not set"), options: typeOptions },
      ...(previous ? [{
        name: "project_type" as const, label: t("Change previous type"), optional: true, maxLength: 120,
        hint: t("Previous project type hint"),
      }] : []),
      { name: "technology_stack", label: t("Technology stack"), wide: true, optional: true, maxLength: 300 },
      { name: "description", label: t("Description"), kind: "textarea", wide: true, optional: true, maxLength: 10000 },
    ] },
    { title: t("Project links"), fields: [
      { name: "website", label: t("Primary website"), kind: "url", optional: true, maxLength: 2048 },
      { name: "repository_url", label: t("Repository URL"), kind: "url", optional: true, maxLength: 2048 },
      { name: "cms_url", label: t("CMS or admin URL"), kind: "url", optional: true, maxLength: 2048 },
      { name: "production_url", label: t("Production URL"), kind: "url", optional: true, maxLength: 2048 },
      { name: "staging_url", label: t("Staging URL"), kind: "url", optional: true, maxLength: 2048 },
    ] },
    { title: t("Technical notes"), fields: [
      { name: "technical_notes", label: t("Technical notes"), kind: "textarea", wide: true, optional: true, maxLength: 10000 },
    ] },
  ];
  const values: ProjectValues = {
    name: project?.name ?? "", client_id: project?.client_id ?? clientId ?? "", status: project?.status ?? "development",
    project_type_choice: choice, project_type: previous, technology_stack: project?.technology_stack ?? "",
    description: project?.description ?? "", website: project?.website ?? "",
    repository_url: project?.repository_url ?? "", cms_url: project?.cms_url ?? "", production_url: project?.production_url ?? "",
    staging_url: project?.staging_url ?? "", technical_notes: project?.technical_notes ?? "",
  };

  return <RecordForm onSave={(input) => saveRecord("projects", project?.id, {
      ...input, project_type: projectTypeValue(input.project_type_choice, input.project_type ?? ""),
    })} submitLabel={t("Save project")} groups={groups} defaultValues={values}
    resolver={zodResolver(projectFormSchema, undefined, { raw: true })}
    cancelUrl={project ? `/projects/${project.id}` : clientId ? `/clients/${clientId}` : "/projects"} />;
}
