"use client";

import { useState, useTransition, type ReactNode } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Archive, Link2, RotateCcw, Trash2, Unlink } from "lucide-react";
import { addProjectAccount, manageServiceAccount, removeProjectAccount, removeServiceProvider } from "@/app/(hub)/service-actions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function ConfirmAction({ trigger, title, description, confirm, action }: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirm: string;
  action: () => Promise<{ error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => {
      if (!pending) {
        setError(undefined);
        setOpen(next);
      }
    }}>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog-content">
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <AlertDialog.Cancel asChild><Button type="button" variant="outline" disabled={pending}>Cancel</Button></AlertDialog.Cancel>
            <Button type="button" variant="destructive" disabled={pending} onClick={() => startTransition(async () => {
              const result = await action();
              if (result.error) setError(result.error);
              else setOpen(false);
            })}>{pending ? "Working…" : confirm}</Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function ProviderDelete({ id, name }: { id: string; name: string }) {
  return <ConfirmAction title={`Delete ${name}?`} description="You can delete this provider once all its accounts have been moved or deleted."
    confirm="Delete provider" action={() => removeServiceProvider(id)}
    trigger={<Button type="button" variant="outline"><Trash2 size={16} aria-hidden /> Delete</Button>} />;
}

export function AccountControls({ id, label, archived, compact }: { id: string; label: string; archived: boolean; compact?: boolean }) {
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();
  const action = archived ? "restore" : "archive";
  const Icon = archived ? RotateCcw : Archive;
  return (
    <div>
      <div className="record-menu">
        <Button type="button" variant={compact ? "ghost" : "outline"} disabled={pending}
          aria-label={`${archived ? "Restore" : "Archive"} ${label}`} onClick={() => {
            setMessage({});
            startTransition(async () => {
              const result = await manageServiceAccount(id, action);
              setMessage(result.error ? { error: result.error } : { success: archived ? "Account restored." : "Account archived." });
            });
          }}>
          <Icon size={16} aria-hidden /> {pending ? "Saving…" : archived ? "Restore" : "Archive"}
        </Button>
        <ConfirmAction title={`Delete ${label}?`} confirm="Delete account" action={() => manageServiceAccount(id, "delete")}
          description="This permanently removes the service account. Archive it to keep its history."
          trigger={<Button type="button" variant={compact ? "ghost" : "outline"} aria-label={`Delete ${label}`} disabled={pending}><Trash2 size={16} aria-hidden /> Delete</Button>} />
      </div>
      {message.error && <p className="form-error" role="alert">{message.error}</p>}
      {message.success && <p className="service-success" role="status">{message.success}</p>}
    </div>
  );
}

export function UnlinkAccount({ projectId, associationId, label }: { projectId: string; associationId: string; label: string }) {
  return <ConfirmAction title={`Unlink ${label}?`} description="The service account will still be available to this workspace and its other projects."
    confirm="Unlink account" action={() => removeProjectAccount(projectId, associationId)}
    trigger={<Button type="button" variant="ghost"><Unlink size={16} aria-hidden /> Unlink</Button>} />;
}

export function LinkAccountForm({ projectId, accounts }: {
  projectId: string; accounts: { id: string; label: string; provider: string }[];
}) {
  const [values, setValues] = useState({ service_account_id: "", purpose: "", notes: "" });
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();
  return (
    <form className="service-link-form" onSubmit={(event) => {
      event.preventDefault();
      setMessage({});
      startTransition(async () => {
        const result = await addProjectAccount(projectId, values);
        if (result.error) setMessage({ error: result.error });
        else {
          setMessage({ success: "Account linked to this project." });
          setValues({ service_account_id: "", purpose: "", notes: "" });
        }
      });
    }}>
      <fieldset className="form-grid" disabled={pending}>
        <legend>Link an existing account</legend>
        <label className="field">Service account
          <select className="field-control" aria-label="Service account" required value={values.service_account_id}
            onChange={(e) => setValues({ ...values, service_account_id: e.target.value })}>
            <option value="">Choose an account</option>
            {accounts.map(({ id, label, provider }) => <option value={id} key={id}>{label} · {provider}</option>)}
          </select>
        </label>
        <label className="field">Purpose
          <Input required maxLength={160} value={values.purpose} onChange={(e) => setValues({ ...values, purpose: e.target.value })} />
        </label>
        <label className="field field-wide">Connection notes (optional)
          <textarea className="field-control" rows={2} maxLength={10000} value={values.notes}
            onChange={(e) => setValues({ ...values, notes: e.target.value })} />
        </label>
        <div className="field-wide form-footer">
          {message.error && <p className="form-error" role="alert">{message.error}</p>}
          {message.success && <p className="service-success" role="status">{message.success}</p>}
          <Button disabled={pending}><Link2 size={16} aria-hidden /> {pending ? "Linking…" : "Link account"}</Button>
        </div>
      </fieldset>
    </form>
  );
}
