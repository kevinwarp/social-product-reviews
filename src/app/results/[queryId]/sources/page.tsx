import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";

interface SourcesPageProps {
  params: Promise<{ queryId: string }>;
}

export async function generateMetadata({ params }: SourcesPageProps): Promise<Metadata> {
  const { queryId } = await params;
  const query = await prisma.query.findUnique({
    where: { id: queryId },
    select: { rawQuery: true },
  });

  if (!query) return { title: "Sources Not Found" };

  return {
    title: `Sources: ${query.rawQuery} — Social Product Reviews`,
    description: `All sources used in the analysis of "${query.rawQuery}".`,
  };
}

export default async function SourcesPage({ params }: SourcesPageProps) {
  const { queryId } = await params;

  const query = await prisma.query.findUnique({
    where: { id: queryId },
    select: { rawQuery: true },
  });

  if (!query) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Query not found</h1>
        <p className="text-muted-foreground mt-2">This search doesn&apos;t exist or has been removed.</p>
      </div>
    );
  }

  // Fetch all evidence sources for this query, deduplicated by source URL
  const evidence = await prisma.evidence.findMany({
    where: { queryId },
    include: {
      source: true,
      product: { select: { brand: true, model: true, canonicalSlug: true } },
    },
    orderBy: { source: { platform: "asc" } },
  });

  // Deduplicate sources by URL and group by platform
  const sourceMap = new Map<string, {
    id: string;
    url: string;
    platform: string;
    title: string | null;
    snippet: string | null;
    capturedAt: Date;
    products: { brand: string; model: string; slug: string }[];
  }>();

  for (const ev of evidence) {
    const src = ev.source;
    const existing = sourceMap.get(src.url);
    const product = ev.product
      ? { brand: ev.product.brand, model: ev.product.model, slug: ev.product.canonicalSlug }
      : null;

    if (existing) {
      if (product && !existing.products.some((p) => p.slug === product.slug)) {
        existing.products.push(product);
      }
    } else {
      sourceMap.set(src.url, {
        id: src.id,
        url: src.url,
        platform: src.platform,
        title: src.title,
        snippet: src.snippet,
        capturedAt: src.capturedAt,
        products: product ? [product] : [],
      });
    }
  }

  const allSources = [...sourceMap.values()];

  // Group by platform
  const grouped = allSources.reduce<Record<string, typeof allSources>>((acc, s) => {
    const key = s.platform;
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  const platformOrder = ["REDDIT", "TIKTOK", "TRUSTPILOT", "WEB", "AMAZON", "SEPHORA", "YOUTUBE", "EWG"];
  const sortedPlatforms = Object.keys(grouped).sort(
    (a, b) => platformOrder.indexOf(a) - platformOrder.indexOf(b)
  );

  const platformLabels: Record<string, string> = {
    REDDIT: "Reddit",
    TIKTOK: "TikTok",
    TRUSTPILOT: "Trustpilot",
    WEB: "Web",
    AMAZON: "Amazon",
    SEPHORA: "Sephora",
    YOUTUBE: "YouTube",
    EWG: "EWG",
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <Link
        href={`/results/${queryId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to results
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">All Sources</h1>
        <p className="text-muted-foreground mt-1">
          {allSources.length} sources used in the analysis of &quot;{query.rawQuery}&quot;
        </p>
      </div>

      {sortedPlatforms.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-16">
          No sources available for this query.
        </p>
      )}

      <div className="space-y-8">
        {sortedPlatforms.map((platform) => {
          const items = grouped[platform];
          return (
            <section key={platform}>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary" className="text-sm capitalize">
                  {platformLabels[platform] ?? platform}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {items.length} source{items.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-3">
                {items.map((src) => (
                  <Card key={src.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {src.title ?? src.url}
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          </a>
                          {src.title && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {src.url}
                            </p>
                          )}
                          {src.snippet && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {src.snippet}
                            </p>
                          )}
                          {src.products.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {src.products.map((p) => (
                                <Link key={p.slug} href={`/products/${p.slug}`}>
                                  <Badge variant="outline" className="text-xs hover:bg-accent cursor-pointer">
                                    {p.brand} {p.model}
                                  </Badge>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {src.capturedAt.toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
