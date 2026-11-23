import { AssetIndex, type ListPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: "Domains" };

export default function Page(props: ListPageProps) {
  return <AssetIndex kind="domains" {...props} />;
}
