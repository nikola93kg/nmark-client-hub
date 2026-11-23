import { t } from "@/lib/localization";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NMark Client Hub", template: "%s | NMark Client Hub" },
  description: t("Private client and project workspace for NMark Designs."),
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="sr-Latn"><body>{children}</body></html>;
}
