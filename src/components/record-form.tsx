"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues, type FieldValues, type Path, type Resolver } from "react-hook-form";
import { Save } from "lucide-react";
import type { z } from "zod";
import { saveRecord } from "@/app/(hub)/record-actions";
import type { Client, ClientOption, Project } from "@/lib/database";
import { clientSchema, clientStatuses, projectSchema, projectStatuses } from "@/lib/validation";
import { capitalize } from "./record-ui";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Option = { value: string; label: string };
type Field<T> = {
  name: Path<T>;
  label: string;
  kind?: "email" | "tel" | "url" | "textarea";
  options?: Option[];
  optional?: boolean;
  wide?: boolean;
  maxLength?: number;
  hint?: string;
};
export type FieldGroup<T> = { title: string; fields: Field<T>[] };
type ClientValues = z.input<typeof clientSchema>;
type ProjectValues = z.input<typeof projectSchema>;

const statuses = (values: readonly string[]) => values.map((value) => ({ value, label: capitalize(value) }));

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
                      <option value="" disabled>Choose {field.label.toLowerCase()}</option>
                      {field.options.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  ) : field.kind === "textarea" ? (
                    <textarea className="field-control" rows={5} maxLength={field.maxLength} {...props} />
                  ) : (
                    <Input type={field.kind ?? "text"} maxLength={field.maxLength} {...props} />
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
        <Button asChild variant="outline"><Link href={cancelUrl}>Cancel</Link></Button>
        <Button disabled={pending}><Save size={16} aria-hidden /> {pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}

const clientGroups: FieldGroup<ClientValues>[] = [
  { title: "Client information", fields: [
    { name: "name", label: "Client name", maxLength: 160 },
    { name: "company", label: "Company or business name", optional: true, maxLength: 160 },
    { name: "status", label: "Status", options: statuses(clientStatuses) },
    { name: "website", label: "Website", kind: "url", optional: true, maxLength: 2048 },
  ] },
  { title: "Contact and location", fields: [
    { name: "contact_person", label: "Contact person", optional: true, maxLength: 160 },
    { name: "email", label: "Email", kind: "email", optional: true, maxLength: 254 },
    { name: "phone", label: "Phone", kind: "tel", optional: true, maxLength: 80 },
    { name: "country", label: "Country", optional: true, maxLength: 120 },
    { name: "city", label: "City", optional: true, maxLength: 120 },
    { name: "address", label: "Address", optional: true, maxLength: 300 },
  ] },
  { title: "Notes", fields: [
    { name: "notes", label: "General notes", kind: "textarea", wide: true, optional: true, maxLength: 10000 },
  ] },
];

export function ClientForm({ client }: { client?: Client }) {
  const values: ClientValues = {
    name: client?.name ?? "", company: client?.company ?? "", contact_person: client?.contact_person ?? "",
    email: client?.email ?? "", phone: client?.phone ?? "", website: client?.website ?? "",
    country: client?.country ?? "", city: client?.city ?? "", address: client?.address ?? "",
    status: client?.status ?? "prospect", notes: client?.notes ?? "",
  };

  return <RecordForm onSave={(input) => saveRecord("clients", client?.id, input)} submitLabel="Save client" groups={clientGroups} defaultValues={values}
    resolver={zodResolver(clientSchema, undefined, { raw: true })}
    cancelUrl={client ? `/clients/${client.id}` : "/clients"} />;
}

export function ProjectForm({ project, clients, clientId }: { project?: Project; clients: ClientOption[]; clientId?: string }) {
  const groups: FieldGroup<ProjectValues>[] = [
    { title: "Project information", fields: [
      { name: "name", label: "Project name", maxLength: 160 },
      { name: "client_id", label: "Client", options: clients.map(({ id, name, status }) => ({ value: id, label: status === "archived" ? `${name} (archived)` : name })) },
      { name: "status", label: "Status", options: statuses(projectStatuses) },
      { name: "project_type", label: "Project type", optional: true, maxLength: 120 },
      { name: "technology_stack", label: "Technology stack", wide: true, optional: true, maxLength: 300 },
      { name: "description", label: "Description", kind: "textarea", wide: true, optional: true, maxLength: 10000 },
    ] },
    { title: "Project links", fields: [
      { name: "website", label: "Primary website", kind: "url", optional: true, maxLength: 2048 },
      { name: "repository_url", label: "Repository URL", kind: "url", optional: true, maxLength: 2048 },
      { name: "cms_url", label: "CMS or admin URL", kind: "url", optional: true, maxLength: 2048 },
      { name: "production_url", label: "Production URL", kind: "url", optional: true, maxLength: 2048 },
      { name: "staging_url", label: "Staging URL", kind: "url", optional: true, maxLength: 2048 },
    ] },
    { title: "Technical notes", fields: [
      { name: "technical_notes", label: "Technical notes", kind: "textarea", wide: true, optional: true, maxLength: 10000 },
    ] },
  ];
  const values: ProjectValues = {
    name: project?.name ?? "", client_id: project?.client_id ?? clientId ?? "", status: project?.status ?? "development",
    project_type: project?.project_type ?? "", technology_stack: project?.technology_stack ?? "",
    description: project?.description ?? "", website: project?.website ?? "",
    repository_url: project?.repository_url ?? "", cms_url: project?.cms_url ?? "", production_url: project?.production_url ?? "",
    staging_url: project?.staging_url ?? "", technical_notes: project?.technical_notes ?? "",
  };

  return <RecordForm onSave={(input) => saveRecord("projects", project?.id, input)} submitLabel="Save project" groups={groups} defaultValues={values}
    resolver={zodResolver(projectSchema, undefined, { raw: true })}
    cancelUrl={project ? `/projects/${project.id}` : clientId ? `/clients/${clientId}` : "/projects"} />;
}
