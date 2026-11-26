import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="font-mono text-5xl font-bold text-text-3">404</p>
      <p className="text-sm text-text-2">This route does not exist in Founda Dock.</p>
      <Link href="/dashboard"><Button variant="primary">Back to Dashboard</Button></Link>
    </div>
  );
}
