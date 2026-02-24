import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { MessageSquare, ExternalLink, ShoppingCart, Package } from "lucide-react";
import type { BrandInfo } from "@/lib/types";

interface ProductCardProps {
  rank: number;
  product: {
    brand: string;
    model: string;
    slug: string;
    category: string;
    imageUrl?: string;
    brandUrl?: string;
    price?: number;
    buyUrl?: string;
    brandInfo?: BrandInfo;
  };
  summary: string;
  fitCriteria: string[];
  redditEvidence: { quote: string; url: string }[];
  confidenceLevel: "high" | "medium" | "low";
  platformCoverage: Record<string, "high" | "medium" | "low" | "none">;
  sourceCount: number;
  queryId?: string;
}

export function ProductCard({
  rank,
  product,
  summary,
  fitCriteria,
  redditEvidence,
  confidenceLevel,
  platformCoverage,
  sourceCount,
  queryId,
}: ProductCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          {/* Rank badge */}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0 mt-1">
            {rank}
          </span>

          {/* Product image */}
          <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={`${product.brand} ${product.model}`}
                width={80}
                height={80}
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
                {/* Brand name — prefer merchantName linked to domain */}
                {product.brandInfo ? (
                  <a
                    href={`https://${product.brandInfo.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary hover:underline uppercase tracking-wide"
                  >
                    {product.brandInfo.merchantName}
                  </a>
                ) : product.brandUrl ? (
                  <a
                    href={product.brandUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary hover:underline uppercase tracking-wide"
                  >
                    {product.brand}
                  </a>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {product.brand}
                  </span>
                )}
                <Link href={`/products/${product.slug}`}>
                  <CardTitle className="text-lg hover:underline">
                    {product.model}
                  </CardTitle>
                </Link>
              </div>
              <ConfidenceBadge level={confidenceLevel} />
            </div>

            {/* Price and Buy link */}
            <div className="flex items-center gap-3 mt-1">
              {product.price != null && (
                <span className="text-sm font-semibold">
                  ${product.price.toFixed(2)}
                </span>
              )}
              {product.buyUrl && (
                <a
                  href={product.buyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Buy Now
                </a>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{summary}</p>

        {/* Fit criteria */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {fitCriteria.map((c) => (
            <Badge key={c} variant="outline" className="text-xs">
              {c}
            </Badge>
          ))}
        </div>

        {/* Reddit evidence */}
        {redditEvidence.length > 0 && (
          <div className="bg-muted/50 rounded-md p-3 mb-3">
            <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
              <MessageSquare className="h-3.5 w-3.5" />
              Reddit Evidence
            </div>
            {redditEvidence.slice(0, 2).map((ev, i) => (
              <div key={i} className="text-xs text-muted-foreground mb-1 last:mb-0">
                &quot;{ev.quote}&quot;{" "}
                <a href={ev.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                  source <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Platform coverage */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {Object.entries(platformCoverage).map(([platform, level]) => (
            <span key={platform} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${
                level === "high" ? "bg-green-500" :
                level === "medium" ? "bg-yellow-500" :
                level === "low" ? "bg-orange-500" : "bg-gray-300"
              }`} />
              {platform}
            </span>
          ))}
          {queryId ? (
            <Link
              href={`/results/${queryId}/sources`}
              className="ml-auto text-primary hover:underline"
            >
              {sourceCount} sources
            </Link>
          ) : (
            <span className="ml-auto">{sourceCount} sources</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
