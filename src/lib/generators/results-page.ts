import { prisma } from "@/lib/db";
import type { ResultsPageData, ParsedIntent, ScoringDimensions, CitationRef, BrandInfo } from "@/lib/types";

/**
 * Generate display-ready data for the Top 10 results page.
 */
export async function generateResultsPageData(
  queryId: string
): Promise<ResultsPageData | null> {
  const query = await prisma.query.findUnique({
    where: { id: queryId },
    include: {
      rankingResults: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!query || query.rankingResults.length === 0) return null;

  const ranking = query.rankingResults[0];
  const top10Raw = ranking.top10 as unknown as RankedProductEntry[];

  // Fetch product details + evidence for each top-10 product
  const top10 = await Promise.all(
    top10Raw.map(async (entry) => {
      const product = entry.productId
        ? await prisma.product.findUnique({
            where: { id: entry.productId },
            include: { brandRef: true },
          })
        : null;

      // Get Reddit evidence for this product
      const evidence = entry.productId
        ? await prisma.evidence.findMany({
            where: { productId: entry.productId, queryId },
            include: { source: true },
            take: 10,
          })
        : [];

      const redditEvidence = evidence
        .filter((e) => e.source.platform === "REDDIT")
        .slice(0, 3)
        .map((e) => ({
          quote: e.quote ?? "",
          url: e.source.url,
        }));

      // Platform coverage
      const platforms = new Set(evidence.map((e) => e.source.platform));
      const platformCoverage: Record<string, "high" | "medium" | "low" | "none"> = {
        Reddit: platforms.has("REDDIT")
          ? evidence.filter((e) => e.source.platform === "REDDIT").length >= 5
            ? "high"
            : evidence.filter((e) => e.source.platform === "REDDIT").length >= 2
            ? "medium"
            : "low"
          : "none",
        TikTok: platforms.has("TIKTOK") ? "low" : "none",
        Trustpilot: platforms.has("TRUSTPILOT") ? "medium" : "none",
        Web: platforms.has("WEB") ? "medium" : "none",
      };

      // Confidence level
      const scores = entry.scores as unknown as ScoringDimensions;
      const confidenceLevel: "high" | "medium" | "low" =
        scores.confidenceScore >= 70 ? "high" : scores.confidenceScore >= 40 ? "medium" : "low";

      // Cast to access new schema fields (brandUrl, price, buyUrl) added in migration
      const productData = product as (typeof product & {
        brandUrl?: string | null;
        price?: number | null;
        buyUrl?: string | null;
      });

      // Extract first image from images JSON array
      const images = (product?.images as unknown as string[]) ?? [];
      const imageUrl = images.length > 0 ? images[0] : undefined;

      // Build sources list for this product
      const productSources: CitationRef[] = evidence.map((e) => ({
        sourceId: e.source.id,
        url: e.source.url,
        platform: e.source.platform.toLowerCase() as CitationRef["platform"],
        title: e.source.title ?? undefined,
        snippet: e.source.snippet ?? undefined,
        capturedAt: e.source.capturedAt.toISOString(),
      }));

      // Derive pros from positive evidence
      const pros = evidence
        .filter((e) => e.sentiment === "POSITIVE" && e.quote)
        .slice(0, 4)
        .map((e) => e.quote!);

      // Derive cons from negative evidence
      const cons = evidence
        .filter((e) => e.sentiment === "NEGATIVE" && e.quote)
        .slice(0, 3)
        .map((e) => e.quote!);

      // Tagline: first sentence of rationale
      const tagline = entry.rationale.split(/\. /)[0] + ".";

      // Rank label
      const rankLabel = getRankLabel(entry.rank);

      // Build brand info from the related Brand record
      const brandRef = product?.brandRef;
      const brandInfo: BrandInfo | undefined =
        brandRef?.merchantName && brandRef?.tld1
          ? {
              merchantName: brandRef.merchantName,
              domain: brandRef.tld1,
              description: brandRef.description ?? undefined,
              icon: brandRef.icon ?? undefined,
              countryCode: brandRef.countryCode ?? undefined,
              platform: brandRef.platform ?? undefined,
              estimatedSalesYearly: brandRef.estimatedSalesYearly ?? undefined,
              employeeCount: brandRef.employeeCount ?? undefined,
            }
          : undefined;

      return {
        rank: entry.rank,
        product: {
          brand: product?.brand ?? "Unknown",
          model: product?.model ?? "Product",
          slug: product?.canonicalSlug ?? "unknown",
          category: product?.category ?? "",
          imageUrl,
          brandUrl: productData?.brandUrl ?? undefined,
          price: productData?.price ?? undefined,
          buyUrl: productData?.buyUrl ?? undefined,
          brandInfo,
        },
        summary: entry.rationale,
        tagline,
        rankLabel,
        pros,
        cons,
        fitCriteria: (entry.scores as unknown as ScoringDimensions).queryFit >= 60
          ? extractFitCriteria(evidence)
          : [],
        redditEvidence,
        confidenceLevel,
        platformCoverage,
        sourceCount: evidence.length,
        scores: entry.scores as unknown as ScoringDimensions,
        sources: productSources,
      };
    })
  );

  // Generate methodology from parsed intent
  const parsedIntent = (query.parsedIntent as unknown as ParsedIntent) ?? {
    useCase: query.rawQuery,
    constraints: [],
    mustHaves: [],
    niceToHaves: [],
  };
  const methodology = `We analyzed ${ranking.candidateCount}+ products for "${query.rawQuery}" by gathering real user opinions from Reddit, TikTok, Trustpilot, and review sites. Products were scored on query fit, social proof coverage, Reddit endorsement strength, and risk factors.${parsedIntent.mustHaves.length > 0 ? ` Key criteria: ${parsedIntent.mustHaves.join(", ")}.` : ""}`;

  const buyingAdvice = `When shopping for ${parsedIntent.useCase || query.rawQuery}, prioritize ${parsedIntent.mustHaves.slice(0, 2).join(" and ") || "quality and value"}.${parsedIntent.constraints.length > 0 ? ` Keep in mind: ${parsedIntent.constraints.join(", ")}.` : ""} Our top picks balance real-world user satisfaction with objective performance.`;

  return {
    queryId,
    rawQuery: query.rawQuery,
    parsedIntent,
    candidateCount: ranking.candidateCount,
    methodology,
    buyingAdvice,
    top10,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface RankedProductEntry {
  productId: string;
  rank: number;
  scores: Record<string, number>;
  rationale: string;
  citations: { url: string; platform: string; snippet?: string }[];
}

function getRankLabel(rank: number): string | undefined {
  switch (rank) {
    case 1: return "Our Pick";
    case 2: return "Runner-Up";
    case 3: return "Also Great";
    default: return undefined;
  }
}

function extractFitCriteria(
  evidence: { themes: unknown; claimTags: unknown }[]
): string[] {
  const allTags = evidence.flatMap((e) => [
    ...((e.themes as string[]) ?? []),
    ...((e.claimTags as string[]) ?? []),
  ]);

  // Count occurrences and return top 4
  const counts = new Map<string, number>();
  for (const tag of allTags) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag]) => tag.replace(/_/g, " "));
}
