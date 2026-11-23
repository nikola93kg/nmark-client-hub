import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="panel empty-state">
      <h1>Page not found</h1>
      <p>The page or record may have moved or been deleted.</p>
      <Button asChild><Link href="/">Go to dashboard</Link></Button>
    </section>
  );
}
