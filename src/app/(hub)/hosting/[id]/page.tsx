import { AssetDetails, type DetailPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: "Hosting service details" };

export default function Page(props: DetailPageProps) {
  return <AssetDetails kind="hosting" {...props} />;
}
