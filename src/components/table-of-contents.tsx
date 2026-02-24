"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ResultsPageData } from "@/lib/types";

type TocItem = ResultsPageData["top10"][number];

interface TableOfContentsProps {
  items: TocItem[];
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const sections = [
    { label: "Top Picks", href: "#top-picks" },
    { label: "How We Chose", href: "#methodology" },
  ];

  const productLinks = items.map((item) => ({
    label: `${item.rank}. ${item.product.brand} ${item.product.model}`,
    href: `/products/${item.product.slug}`,
    rankLabel: item.rankLabel,
  }));

  const bottomSections = [
    { label: "Compare", href: "#comparison" },
    { label: "Buying Advice", href: "#buying-advice" },
  ];

  const navContent = (
    <nav className="space-y-1">
      {sections.map((s) => (
        <a
          key={s.href}
          href={s.href}
          className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {s.label}
        </a>
      ))}

      <div className="pt-2 pb-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Full Reviews
        </span>
      </div>
      {productLinks.map((p) => (
        <a
          key={p.href}
          href={p.href}
          className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5 pl-2 border-l-2 border-transparent hover:border-primary"
        >
          {p.label}
          {p.rankLabel && (
            <span className="ml-1.5 text-[10px] text-primary">
              {p.rankLabel}
            </span>
          )}
        </a>
      ))}

      <div className="pt-2" />
      {bottomSections.map((s) => (
        <a
          key={s.href}
          href={s.href}
          className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {s.label}
        </a>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile: collapsible inline */}
      <div className="lg:hidden mb-6">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 w-full text-sm font-medium text-muted-foreground hover:text-foreground rounded-md border p-3"
        >
          Table of Contents
          {isOpen ? (
            <ChevronUp className="h-4 w-4 ml-auto" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-auto" />
          )}
        </button>
        {isOpen && <div className="mt-2 pl-3">{navContent}</div>}
      </div>

      {/* Desktop: sticky sidebar */}
      <aside className="hidden lg:block sticky top-20 self-start">
        <h3 className="text-sm font-semibold mb-3">Contents</h3>
        {navContent}
      </aside>
    </>
  );
}
