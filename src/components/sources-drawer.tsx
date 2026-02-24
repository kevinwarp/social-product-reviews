"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText } from "lucide-react";
import type { CitationRef } from "@/lib/types";

interface SourcesDrawerProps {
  sources: CitationRef[];
  triggerLabel?: string;
}

export function SourcesDrawer({ sources, triggerLabel }: SourcesDrawerProps) {
  const grouped = sources.reduce<Record<string, CitationRef[]>>((acc, s) => {
    (acc[s.platform] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="h-4 w-4" />
          {triggerLabel ?? `${sources.length} Sources`}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Sources Used ({sources.length})</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {Object.entries(grouped).map(([platform, items]) => (
            <div key={platform}>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="text-xs capitalize">
                  {platform}
                </Badge>
                <span className="text-xs text-muted-foreground">{items.length} sources</span>
              </div>
              <div className="space-y-2">
                {items.map((src) => (
                  <a
                    key={src.sourceId}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 rounded-md border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{src.title ?? src.url}</p>
                        {src.snippet && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{src.snippet}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Captured: {src.capturedAt}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
          {sources.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No sources available.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
