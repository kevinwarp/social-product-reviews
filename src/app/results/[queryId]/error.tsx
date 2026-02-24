"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/search-box";
import { AlertCircle } from "lucide-react";

export default function ResultsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Results page error:", error);
  }, [error]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <SearchBox placeholder="Try a different search..." />
      </div>
      <div className="text-center py-16">
        <AlertCircle className="h-10 w-10 mx-auto mb-4 text-destructive" />
        <h1 className="text-2xl font-bold mb-2">Failed to load results</h1>
        <p className="text-muted-foreground mb-6">
          We hit an error loading this search. The pipeline may have encountered an issue.
        </p>
        <Button onClick={reset}>Retry</Button>
      </div>
    </div>
  );
}
