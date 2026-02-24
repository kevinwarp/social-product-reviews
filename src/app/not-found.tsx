import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/search-box";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container mx-auto max-w-lg px-4 py-24 text-center">
      <SearchX className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
      <h1 className="text-3xl font-bold mb-2">Page Not Found</h1>
      <p className="text-muted-foreground mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="max-w-md mx-auto mb-6">
        <SearchBox placeholder="Search for a product instead..." />
      </div>
      <Link href="/">
        <Button variant="outline">Back to Home</Button>
      </Link>
    </div>
  );
}
