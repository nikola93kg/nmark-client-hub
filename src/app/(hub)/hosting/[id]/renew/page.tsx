import { RenewalEditor, type IdPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: "Record hosting service renewal" };

export default function Page(props: IdPageProps) {
  return <RenewalEditor kind="hosting" {...props} />;
}
