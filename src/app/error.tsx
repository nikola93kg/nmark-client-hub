"use client";

import { t } from "@/lib/localization";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <section className="panel empty-state">
      <AlertCircle size={24} aria-hidden />
      <h1>{t("Something went wrong")}</h1>
      <p>{t("Retry the request to reload this page.")}</p>
      <Button onClick={reset}>{t("Try again")}</Button>
    </section>
  );
}
