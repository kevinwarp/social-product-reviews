import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowRight } from "lucide-react";
import type { ResultsPageData } from "@/lib/types";

type TopPick = ResultsPageData["top10"][number];

interface TopPicksGridProps {
  picks: TopPick[];
}

export function TopPicksGrid({ picks }: TopPicksGridProps) {
  const topPicks = picks.slice(0, 3);

  return (
    <section id="top-picks" className="mb-10 scroll-mt-20">
      <h2 className="text-2xl font-bold mb-6">Our Top Picks</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {topPicks.map((pick) => (
          <Card
            key={pick.rank}
            className={`relative overflow-hidden ${
              pick.rank === 1 ? "border-primary/50 shadow-md" : ""
            }`}
          >
            {/* Rank label badge */}
            {pick.rankLabel && (
              <div className="absolute top-3 left-3 z-10">
                <Badge
                  variant={pick.rank === 1 ? "default" : "secondary"}
                  className="text-xs font-semibold"
                >
                  {pick.rankLabel}
                </Badge>
              </div>
            )}

            <CardContent className="pt-10 pb-4">
              {/* Product image */}
              <div className="mx-auto h-32 w-32 rounded-lg bg-muted flex items-center justify-center overflow-hidden mb-4">
                {pick.product.imageUrl ? (
                  <Image
                    src={pick.product.imageUrl}
                    alt={`${pick.product.brand} ${pick.product.model}`}
                    width={128}
                    height={128}
                    className="object-cover h-full w-full"
                  />
                ) : (
                  <Package className="h-10 w-10 text-muted-foreground" />
                )}
              </div>

              {/* Product info */}
              <div className="text-center">
                {pick.product.brandInfo ? (
                  <a
                    href={`https://${pick.product.brandInfo.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary hover:underline uppercase tracking-wide"
                  >
                    {pick.product.brandInfo.merchantName}
                  </a>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {pick.product.brand}
                  </span>
                )}
                <Link href={`/products/${pick.product.slug}`}>
                  <h3 className="font-semibold text-base mt-0.5 hover:underline">
                    {pick.product.model}
                  </h3>
                </Link>

                {pick.product.price != null && (
                  <p className="text-sm font-semibold mt-1">
                    ${pick.product.price.toFixed(2)}
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {pick.tagline}
                </p>

                {/* Link to product page */}
                <Link
                  href={`/products/${pick.product.slug}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
                >
                  Full review
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
