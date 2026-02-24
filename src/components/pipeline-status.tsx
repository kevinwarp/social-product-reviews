"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PipelineStatusProps {
  queryId: string;
}

const steps = [
  "Parsing your query...",
  "Searching Reddit, web, and social platforms...",
  "Analyzing 100+ candidate products...",
  "Extracting evidence and sentiment...",
  "Ranking and selecting Top 10...",
  "Generating results...",
];

export function PipelineStatus({ queryId }: PipelineStatusProps) {
  const [status, setStatus] = useState("PENDING");
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/search/${queryId}`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);

        if (data.status === "COMPLETED") {
          clearInterval(interval);
          router.refresh();
        } else if (data.status === "FAILED") {
          clearInterval(interval);
          setError("Pipeline failed. Please try again.");
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [queryId, router]);

  // Animate through steps
  useEffect(() => {
    if (status !== "PROCESSING" && status !== "PENDING") return;
    const timer = setInterval(() => {
      setStepIndex((i) => (i + 1) % steps.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [status]);

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Try refining your search query or retry.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="font-medium text-lg mb-2">Analyzing products...</p>
        <p className="text-sm text-muted-foreground animate-pulse">
          {steps[stepIndex]}
        </p>
        <div className="flex justify-center gap-1 mt-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                i <= stepIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
