"use client";

import { t } from "@/lib/localization";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Archive, Trash2 } from "lucide-react";
import { manageRecord } from "@/app/(hub)/record-actions";
import { Button } from "./ui/button";

export function RecordMenu({ collection, id, name, archived, compact }: {
  collection: "clients" | "projects"; id: string; name: string; archived: boolean; compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const isClient = collection === "clients";

  function run(action: "archive" | "delete") {
    setError(undefined);
    setDeleteError(undefined);
    startTransition(async () => {
      const result = await manageRecord(collection, id, action);
      if (result.error) {
        if (action === "delete") setDeleteError(result.error);
        else setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="record-menu">
        {!archived && (
          <Button type="button" variant={compact ? "ghost" : "outline"} disabled={pending} onClick={() => run("archive")}
            className={compact ? "icon-button" : undefined} aria-label={t("Archive {name}", { name })} title={t("Archive {name}", { name })}>
            <Archive size={16} aria-hidden />{!compact && t("Archive")}
          </Button>
        )}
        <AlertDialog.Root open={open} onOpenChange={(next) => {
          if (pending) return;
          setDeleteError(undefined);
          setOpen(next);
        }}>
          <AlertDialog.Trigger asChild>
            <Button type="button" variant={compact ? "ghost" : "outline"} disabled={pending}
              className={compact ? "icon-button" : undefined} aria-label={t("Delete {name}", { name })} title={t("Delete {name}", { name })}>
              <Trash2 size={16} aria-hidden />{!compact && t("Delete")}
            </Button>
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="dialog-overlay" />
            <AlertDialog.Content className="dialog-content">
              <AlertDialog.Title>{t("Delete {name}?", { name })}</AlertDialog.Title>
              <AlertDialog.Description>
                {t(isClient ? "Client deletion permanently removes the record. Archive it to keep its history." : "Project deletion permanently removes the record. Archive it to keep its history.")}
              </AlertDialog.Description>
              {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
              <div className="dialog-actions">
                <AlertDialog.Cancel asChild><Button variant="outline" disabled={pending}>{t("Cancel")}</Button></AlertDialog.Cancel>
                <Button variant="destructive" disabled={pending} onClick={() => run("delete")}>
                  {pending ? t("Deleting…") : t(isClient ? "Delete client" : "Delete project")}
                </Button>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
