import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PlatformSection } from "@/components/platform-section";
import { SourcesDrawer } from "@/components/sources-drawer";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { ProductImage } from "@/components/product-image";
import { generateProductPageData } from "@/lib/generators/product-page";
import { ComplianceNotice } from "@/components/compliance-notice";
import { prisma } from "@/lib/db";
import {
  ExternalLink, MessageSquare, Star, ThumbsUp, ThumbsDown,
  Package, ShoppingCart, BarChart3, FileText, CheckCircle, XCircle,
} from "lucide-react";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;

  let product: { brand: string; model: string; category: string } | null = null;
  try {
    product = await prisma.product.findUnique({
      where: { canonicalSlug: slug },
      select: { brand: true, model: true, category: true },
    });
  } catch {
    // DB schema mismatch or connection error — try featured search data
    const { getFeaturedSearch } = await import("@/lib/featured-searches");
    const { featuredSearches } = await import("@/lib/featured-searches");
    for (const fs of featuredSearches) {
      const entry = fs.data.top10.find((item) => item.product.slug === slug);
      if (entry) {
        product = { brand: entry.product.brand, model: entry.product.model, category: entry.product.category };
        break;
      }
    }
  }

  if (!product) return { title: "Product Not Found" };

  const title = `${product.brand} ${product.model} — Social Product Reviews`;
  const description = `Real user opinions on the ${product.brand} ${product.model} (${product.category}). Sentiment analysis from Reddit, TikTok, and Trustpilot.`;

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const data = await generateProductPageData(slug);

  if (!data) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <p className="text-muted-foreground mt-2">
          We don&apos;t have data for this product yet.
        </p>
      </div>
    );
  }

  const { product, verdict, socialSentiment, tiktok, reddit, trustpilot, sources } = data;
  const scoreLevel: "high" | "medium" | "low" =
    product.score >= 75 ? "high" : product.score >= 50 ? "medium" : "low";

  // Compliance: compute capture date range and missing platforms
  const capturedDates = sources.map((s) => new Date(s.capturedAt));
  const capturedRange = capturedDates.length > 0
    ? {
        earliest: new Date(Math.min(...capturedDates.map((d) => d.getTime()))).toLocaleDateString(),
        latest: new Date(Math.max(...capturedDates.map((d) => d.getTime()))).toLocaleDateString(),
      }
    : undefined;
  const presentPlatforms = new Set(sources.map((s) => s.platform));
  const allPlatforms = ["reddit", "tiktok", "trustpilot", "web"] as const;
  const missingPlatforms = allPlatforms
    .filter((p) => !presentPlatforms.has(p))
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));

  // Compute sentiment stats for Quick Glance
  const positiveCount = socialSentiment.pros.length;
  const negativeCount = socialSentiment.cons.length;
  const totalSentiment = positiveCount + negativeCount;
  const positivePercent = totalSentiment > 0 ? Math.round((positiveCount / totalSentiment) * 100) : 50;
  const topThemes = socialSentiment.themes.slice(0, 3);
  const platformsAvailable = [
    { name: "Reddit", available: reddit.available },
    { name: "TikTok", available: tiktok.available },
    { name: "Trustpilot", available: trustpilot.available },
  ];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* 1. Hero */}
      <section className="mb-8">
        <div className="flex items-start gap-6">
          {/* Product image */}
          <div className="h-32 w-32 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {product.images.length > 0 ? (
              <ProductImage
                src={product.images[0]}
                alt={`${product.brand} ${product.model}`}
                width={128}
                height={128}
                className="object-cover h-full w-full"
              />
            ) : (
              <Package className="h-12 w-12 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
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
            <h1 className="text-3xl font-bold">
              {product.model}
            </h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary">{product.category}</Badge>
              {product.bestForTags.map((tag) => (
                <Badge key={tag} variant="outline">{tag}</Badge>
              ))}
            </div>
            {/* Price and Buy link */}
            {(product.price != null || product.buyUrl) && (
              <div className="flex items-center gap-3 mt-2">
                {product.price != null && (
                  <span className="text-lg font-semibold">
                    ${product.price.toFixed(2)}
                  </span>
                )}
                {product.buyUrl && (
                  <a
                    href={product.buyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Buy Now
                  </a>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 mt-3">
              <ConfidenceBadge level={scoreLevel} />
              <span className="text-sm text-muted-foreground">
                Score: {product.score}/100
              </span>
              <SourcesDrawer sources={sources} />
            </div>
          </div>
        </div>

        {/* Image gallery thumbnails */}
        {product.images.length > 1 && (
          <div className="flex gap-2 mt-4 ml-[152px]">
            {product.images.slice(1, 5).map((img, i) => (
              <div key={i} className="h-16 w-16 rounded-md bg-muted overflow-hidden shrink-0">
                <ProductImage
                  src={img}
                  alt={`${product.brand} ${product.model} image ${i + 2}`}
                  width={64}
                  height={64}
                  className="object-cover h-full w-full"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Brand description */}
      {product.brandInfo?.description && (
        <p className="text-sm text-muted-foreground mt-4 max-w-2xl">
          {product.brandInfo.description}
        </p>
      )}

      <Separator className="my-8" />

      {/* 1.5. Quick Glance */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Glance</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Sentiment ratio */}
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
                  <BarChart3 className="h-4 w-4" />
                  Sentiment
                </div>
                {totalSentiment > 0 ? (
                  <>
                    <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                      <div
                        className="bg-green-500 transition-all"
                        style={{ width: `${positivePercent}%` }}
                      />
                      <div
                        className="bg-red-400 transition-all"
                        style={{ width: `${100 - positivePercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {positiveCount} positive
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-red-400" />
                        {negativeCount} negative
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not enough data</p>
                )}
              </div>

              {/* Top themes */}
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
                  Top Themes
                </div>
                {topThemes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {topThemes.map((t) => (
                      <Badge
                        key={t.name}
                        variant={t.sentiment === "positive" ? "default" : t.sentiment === "negative" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {t.name} ({t.mentionCount})
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No themes detected</p>
                )}
              </div>

              {/* Platform availability + source count */}
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
                  <FileText className="h-4 w-4" />
                  {sources.length} Sources
                </div>
                <div className="flex flex-wrap gap-2">
                  {platformsAvailable.map((p) => (
                    <span
                      key={p.name}
                      className={`inline-flex items-center gap-1 text-xs ${
                        p.available ? "text-foreground" : "text-muted-foreground line-through"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${
                        p.available ? "bg-green-500" : "bg-gray-300"
                      }`} />
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 2. Verdict */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Verdict</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-green-600 mb-2 flex items-center gap-1.5">
                  <ThumbsUp className="h-4 w-4" /> Good for
                </h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {verdict.forWhom.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-red-600 mb-2 flex items-center gap-1.5">
                  <ThumbsDown className="h-4 w-4" /> Not ideal for
                </h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {verdict.notForWhom.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. Social Sentiment Breakdown */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Social Sentiment</h2>
        <Card>
          <CardContent className="pt-6">
            {/* Themes */}
            {socialSentiment.themes.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">Key Themes</h3>
                <div className="flex flex-wrap gap-2">
                  {socialSentiment.themes.map((t) => (
                    <Badge
                      key={t.name}
                      variant={t.sentiment === "positive" ? "default" : t.sentiment === "negative" ? "destructive" : "secondary"}
                    >
                      {t.name} ({t.mentionCount})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {/* Pros */}
            {socialSentiment.pros.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-green-600 mb-2">What people love</h3>
                <ul className="space-y-1.5">
                  {socialSentiment.pros.map((p, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      &quot;{p}&quot;
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Cons */}
            {socialSentiment.cons.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-red-600 mb-2">Common complaints</h3>
                <ul className="space-y-1.5">
                  {socialSentiment.cons.map((c, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      &quot;{c}&quot;
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {socialSentiment.themes.length === 0 && socialSentiment.pros.length === 0 && (
              <p className="text-sm text-muted-foreground">No sentiment data available yet.</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 4. TikTok */}
      <PlatformSection platform="TikTok" available={tiktok.available}>
        <div className="space-y-3">
          {tiktok.themes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Conversation Themes</h3>
              <div className="flex flex-wrap gap-1.5">
                {tiktok.themes.map((theme) => (
                  <Badge key={theme} variant="outline" className="text-xs">{theme}</Badge>
                ))}
              </div>
            </div>
          )}
          {tiktok.sourcePosts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Featured Posts</h3>
              {tiktok.sourcePosts.map((post, i) => (
                <a
                  key={i}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-muted-foreground hover:text-foreground mb-1"
                >
                  {post.description || post.url}
                  <ExternalLink className="inline h-3 w-3 ml-1" />
                </a>
              ))}
            </div>
          )}
        </div>
      </PlatformSection>

      {/* 5. Reddit */}
      <PlatformSection platform="Reddit" available={reddit.available}>
        <div className="space-y-4">
          {/* Thread clusters */}
          {reddit.threadClusters.map((cluster) => (
            <div key={cluster.theme}>
              <h3 className="text-sm font-medium mb-2 capitalize">{cluster.theme}</h3>
              <div className="space-y-2">
                {cluster.threads.map((thread, i) => (
                  <div key={i} className="bg-muted/50 rounded-md p-3">
                    <a
                      href={thread.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline flex items-center gap-1"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {thread.title}
                    </a>
                    {thread.quote && (
                      <p className="text-xs text-muted-foreground mt-1">
                        &quot;{thread.quote}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Defended benefits */}
          {reddit.defendedBenefits.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-green-600 mb-2">Defended Benefits</h3>
              <ul className="space-y-1">
                {reddit.defendedBenefits.map((b, i) => (
                  <li key={i} className="text-sm text-muted-foreground">&quot;{b}&quot;</li>
                ))}
              </ul>
            </div>
          )}

          {/* Common complaints */}
          {reddit.commonComplaints.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-red-600 mb-2">Common Complaints</h3>
              <ul className="space-y-1">
                {reddit.commonComplaints.map((c, i) => (
                  <li key={i} className="text-sm text-muted-foreground">&quot;{c}&quot;</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </PlatformSection>

      {/* 6. Trustpilot */}
      <PlatformSection platform="Trustpilot" available={trustpilot.available}>
        <div className="flex items-center gap-4">
          {trustpilot.rating !== undefined && (
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              <span className="text-2xl font-bold">{trustpilot.rating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/5</span>
            </div>
          )}
          {trustpilot.reviewCount !== undefined && (
            <span className="text-sm text-muted-foreground">
              {trustpilot.reviewCount.toLocaleString()} reviews
            </span>
          )}
          {trustpilot.scope && (
            <Badge variant="outline" className="text-xs">
              {trustpilot.scope === "brand" ? "Brand-level" : "Product-level"}
            </Badge>
          )}
          {trustpilot.url && (
            <a
              href={trustpilot.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1 ml-auto"
            >
              View on Trustpilot <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </PlatformSection>

      {/* 7. Specs & Details */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Specs &amp; Details</h2>
        <Card>
          <CardContent className="pt-6">
            {Object.keys(product.specs).length > 0 ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                {Object.entries(product.specs).map(([key, val]) => (
                  <div key={key} className="flex justify-between border-b pb-1">
                    <dt className="text-sm font-medium capitalize">
                      {key.replace(/_/g, " ")}
                    </dt>
                    <dd className="text-sm text-muted-foreground">{val}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No detailed specifications available yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 8. Sources Used */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Sources Used</h2>
        <Card>
          <CardContent className="pt-6">
            {sources.length > 0 ? (
              <div className="space-y-3">
                {["reddit", "tiktok", "trustpilot", "web"].map((platform) => {
                  const items = sources.filter((s) => s.platform === platform);
                  if (items.length === 0) return null;
                  return (
                    <div key={platform}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {platform}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {items.length} source{items.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {items.map((src) => (
                          <li key={src.sourceId}>
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {src.title ?? src.url}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <span className="text-xs text-muted-foreground ml-2">
                              {new Date(src.capturedAt).toLocaleDateString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sources available yet.</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Compliance Notice */}
      <ComplianceNotice
        capturedRange={capturedRange}
        sourceCount={sources.length}
        missingPlatforms={missingPlatforms}
      />
    </div>
  );
}
