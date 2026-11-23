import { t } from "@/lib/localization";

export default function Loading() {
  return <div className="panel loading-state" role="status"><span className="spinner" aria-hidden /> {t("Loading workspace…")}</div>;
}
