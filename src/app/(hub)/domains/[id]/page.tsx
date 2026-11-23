import { AssetDetails, type DetailPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: "Domain details" };

export default function Page(props: DetailPageProps) {
  return <AssetDetails kind="domains" {...props} />;
}
