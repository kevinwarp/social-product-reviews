"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, AlertCircle } from "lucide-react";

interface SearchBoxProps {
  size?: "default" | "large";
  placeholder?: string;
}

export function SearchBox({ size = "default", placeholder }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/results/${data.queryId}`);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Search failed. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const isLarge = size === "large";

  return (
    <div className="w-full">
      <form onSubmit={handleSearch} className="flex w-full gap-2">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${isLarge ? "h-5 w-5" : "h-4 w-4"}`} />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setError(null); }}
            placeholder={placeholder ?? "What product are you looking for?"}
            className={`${isLarge ? "h-14 pl-12 text-lg" : "h-10 pl-10"}`}
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()} className={isLarge ? "h-14 px-8 text-lg" : ""}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>
      {error && (
        <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
