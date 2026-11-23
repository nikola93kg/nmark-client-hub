import { RenewalEditor, type IdPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: "Record domain renewal" };

export default function Page(props: IdPageProps) {
  return <RenewalEditor kind="domains" {...props} />;
}
