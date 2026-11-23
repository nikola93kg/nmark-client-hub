"use client";

import { t } from "@/lib/localization";
import { useState, useTransition, type ReactNode } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Archive, RotateCcw, Trash2, Unlink } from "lucide-react";
import { manageServiceAccount, removeProjectAccount, removeServiceProvider } from "@/app/(hub)/service-actions";
import { Button } from "./ui/button";

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
            <AlertDialog.Cancel asChild><Button type="button" variant="outline" disabled={pending}>{t("Cancel")}</Button></AlertDialog.Cancel>
            <Button type="button" variant="destructive" disabled={pending} onClick={() => startTransition(async () => {
              const result = await action();
              if (result.error) setError(result.error);
              else setOpen(false);
            })}>{pending ? t("Working…") : confirm}</Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function ProviderDelete({ id, name }: { id: string; name: string }) {
  return <ConfirmAction title={t("Delete {name}?", { name })} description={t("You can delete this provider once all its accounts have been moved or deleted.")}
    confirm={t("Delete provider")} action={() => removeServiceProvider(id)}
    trigger={<Button type="button" variant="outline"><Trash2 size={16} aria-hidden /> {t("Delete")}</Button>} />;
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
          aria-label={t(archived ? "Restore {name}" : "Archive {name}", { name: label })} onClick={() => {
            setMessage({});
            startTransition(async () => {
              const result = await manageServiceAccount(id, action);
              setMessage(result.error ? { error: result.error } : { success: archived ? t("Account restored.") : t("Account archived.") });
            });
          }}>
          <Icon size={16} aria-hidden /> {pending ? t("Saving…") : archived ? t("Restore") : t("Archive")}
        </Button>
        <ConfirmAction title={t("Delete {name}?", { name: label })} confirm={t("Delete account")} action={() => manageServiceAccount(id, "delete")}
          description={t("This permanently removes the service account. Archive it to keep its history.")}
          trigger={<Button type="button" variant={compact ? "ghost" : "outline"} aria-label={t("Delete {name}", { name: label })} disabled={pending}><Trash2 size={16} aria-hidden /> {t("Delete")}</Button>} />
      </div>
      {message.error && <p className="form-error" role="alert">{message.error}</p>}
      {message.success && <p className="service-success" role="status">{message.success}</p>}
    </div>
  );
}

export function UnlinkAccount({ projectId, associationId, label, service }: { projectId: string; associationId: string; label: string; service?: boolean }) {
  return <ConfirmAction title={t("Unlink {name}?", { name: label })} description={t(service ? "This removes the project connection and keeps the provider and any reusable account." : "The service account will still be available to this workspace and its other projects.")}
    confirm={t(service ? "Unlink service" : "Unlink account")} action={() => removeProjectAccount(projectId, associationId)}
    trigger={<Button type="button" variant="ghost"><Unlink size={16} aria-hidden /> {t("Unlink")}</Button>} />;
}
