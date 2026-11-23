"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <section className="panel empty-state">
      <AlertCircle size={24} aria-hidden />
      <h1>Something went wrong</h1>
      <p>Retry the request to reload this page.</p>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
