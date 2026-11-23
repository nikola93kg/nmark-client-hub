import { t } from "@/lib/localization";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="panel empty-state">
      <h1>{t("Page not found")}</h1>
      <p>{t("The page or record may have moved or been deleted.")}</p>
      <Button asChild><Link href="/">{t("Go to dashboard")}</Link></Button>
    </section>
  );
}
