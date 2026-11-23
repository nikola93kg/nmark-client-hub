import { AssetIndex, type ListPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: "Hosting" };

export default function Page(props: ListPageProps) {
  return <AssetIndex kind="hosting" {...props} />;
}
