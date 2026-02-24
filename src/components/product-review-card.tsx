import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "@/components/confidence-badge";
import {
  Package,
  ShoppingCart,
  ExternalLink,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
} from "lucide-react";
import type { ResultsPageData } from "@/lib/types";

type ReviewItem = ResultsPageData["top10"][number];

interface ProductReviewCardProps {
  item: ReviewItem;
  queryId?: string;
}

export function ProductReviewCard({ item, queryId }: ProductReviewCardProps) {
  return (
    <Card id={`pick-${item.rank}`} className="scroll-mt-20 mb-6">
      <CardContent className="pt-6">
        {/* Header row */}
        <div className="flex items-start gap-4 mb-4">
          {/* Rank badge */}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
            {item.rank}
          </span>

          {/* Product image */}
          <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {item.product.imageUrl ? (
              <Image
                src={item.product.imageUrl}
                alt={`${item.product.brand} ${item.product.model}`}
                width={96}
                height={96}
                className="object-cover h-full w-full"
              />
            ) : (
              <Package className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          {/* Product info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                {item.rankLabel && (
                  <Badge
                    variant={item.rank === 1 ? "default" : "secondary"}
                    className="text-xs mb-1"
                  >
                    {item.rankLabel}
                  </Badge>
                )}
                {item.product.brandInfo ? (
                  <a
                    href={`https://${item.product.brandInfo.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs font-medium text-primary hover:underline uppercase tracking-wide"
                  >
                    {item.product.brandInfo.merchantName}
                  </a>
                ) : (
                  <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {item.product.brand}
                  </span>
                )}
                <Link href={`/products/${item.product.slug}`}>
                  <h3 className="text-xl font-bold hover:underline">
                    {item.product.model}
                  </h3>
                </Link>
              </div>
              <ConfidenceBadge level={item.confidenceLevel} />
            </div>

            {/* Tagline */}
            <p className="text-sm text-muted-foreground mt-1">
              {item.tagline}
            </p>

            {/* Price and buy */}
            <div className="flex items-center gap-3 mt-2">
              {item.product.price != null && (
                <span className="text-lg font-semibold">
                  ${item.product.price.toFixed(2)}
                </span>
              )}
              {item.product.buyUrl && (
                <a
                  href={item.product.buyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Buy Now
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground mb-4">{item.summary}</p>

        {/* Pros / Cons */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {item.pros.length > 0 && (
            <div className="rounded-md border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20 p-3">
              <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-1.5">
                <ThumbsUp className="h-4 w-4" /> Pros
              </h4>
              <ul className="space-y-1">
                {item.pros.map((pro, i) => (
                  <li
                    key={i}
                    className="text-sm text-muted-foreground flex items-start gap-1.5"
                  >
                    <span className="text-green-500 mt-1">+</span>
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.cons.length > 0 && (
            <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 p-3">
              <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2 flex items-center gap-1.5">
                <ThumbsDown className="h-4 w-4" /> Cons
              </h4>
              <ul className="space-y-1">
                {item.cons.map((con, i) => (
                  <li
                    key={i}
                    className="text-sm text-muted-foreground flex items-start gap-1.5"
                  >
                    <span className="text-red-500 mt-1">−</span>
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Fit criteria */}
        {item.fitCriteria.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {item.fitCriteria.map((c) => (
              <Badge key={c} variant="outline" className="text-xs">
                {c}
              </Badge>
            ))}
          </div>
        )}

        {/* Reddit evidence */}
        {item.redditEvidence.length > 0 && (
          <div className="bg-muted/50 rounded-md p-4 mb-4">
            <div className="flex items-center gap-1.5 text-xs font-medium mb-3">
              <MessageSquare className="h-3.5 w-3.5" />
              What Reddit Says
            </div>
            <div className="space-y-2">
              {item.redditEvidence.slice(0, 3).map((ev, i) => (
                <div key={i} className="text-sm text-muted-foreground">
                  &quot;{ev.quote}&quot;{" "}
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary hover:underline text-xs"
                  >
                    source <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer: platform coverage + links */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {Object.entries(item.platformCoverage).map(([platform, level]) => (
              <span key={platform} className="flex items-center gap-1">
                <span
                  className={`h-2 w-2 rounded-full ${
                    level === "high"
                      ? "bg-green-500"
                      : level === "medium"
                        ? "bg-yellow-500"
                        : level === "low"
                          ? "bg-orange-500"
                          : "bg-gray-300"
                  }`}
                />
                {platform}
              </span>
            ))}
            <span className="ml-1">{item.sourceCount} sources</span>
          </div>

          <Link
            href={`/products/${item.product.slug}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Full details <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
