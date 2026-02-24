"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Product page error:", error);
  }, [error]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 text-center">
      <AlertCircle className="h-10 w-10 mx-auto mb-4 text-destructive" />
      <h1 className="text-2xl font-bold mb-2">Failed to load product</h1>
      <p className="text-muted-foreground mb-6">
        We couldn&apos;t load this product page. Please try again.
      </p>
      <div className="flex justify-center gap-3">
        <Button onClick={reset}>Retry</Button>
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}
