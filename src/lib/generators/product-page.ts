import { prisma } from "@/lib/db";
import { featuredSearches } from "@/lib/featured-searches";
import { scrapeProductImage } from "@/lib/scraper/product-image";
import type { ProductPageData, CitationRef, BrandInfo } from "@/lib/types";

/**
 * Generate display-ready data for an individual product landing page.
 */
export async function generateProductPageData(
  slug: string
): Promise<ProductPageData | null> {
  let product;
  try {
    product = await prisma.product.findUnique({
      where: { canonicalSlug: slug },
      include: { brandRef: true },
    });
  } catch {
    // DB schema mismatch or connection error — fall back to featured search data
    return buildFromFeaturedSearch(slug);
  }

  if (!product) {
    // Product not in DB — fall back to featured search entries
    return buildFromFeaturedSearch(slug);
  }

  // Fetch all evidence for this product
  const evidence = await prisma.evidence.findMany({
    where: { productId: product.id },
    include: { source: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Group evidence by platform
  const redditEvidence = evidence.filter((e) => e.source.platform === "REDDIT");
  const tiktokEvidence = evidence.filter((e) => e.source.platform === "TIKTOK");
  const trustpilotEvidence = evidence.filter((e) => e.source.platform === "TRUSTPILOT");

  // Build themes from all evidence
  const allThemes = evidence.flatMap((e) => (e.themes as string[]) ?? []);
  const themeCounts = new Map<string, { pos: number; neg: number; neu: number }>();
  for (const ev of evidence) {
    for (const theme of (ev.themes as string[]) ?? []) {
      const entry = themeCounts.get(theme) ?? { pos: 0, neg: 0, neu: 0 };
      if (ev.sentiment === "POSITIVE") entry.pos++;
      else if (ev.sentiment === "NEGATIVE") entry.neg++;
      else entry.neu++;
      themeCounts.set(theme, entry);
    }
  }

  // Pros and cons
  const pros = evidence
    .filter((e) => e.sentiment === "POSITIVE" && e.quote)
    .slice(0, 8)
    .map((e) => e.quote!);

  const cons = evidence
    .filter((e) => e.sentiment === "NEGATIVE" && e.quote)
    .slice(0, 5)
    .map((e) => e.quote!);

  // Verdict: who it's for / not for
  const positiveThemes = [...themeCounts.entries()]
    .filter(([, c]) => c.pos > c.neg)
    .sort((a, b) => b[1].pos - a[1].pos)
    .slice(0, 5)
    .map(([theme]) => theme.replace(/_/g, " "));

  const negativeThemes = [...themeCounts.entries()]
    .filter(([, c]) => c.neg > c.pos)
    .sort((a, b) => b[1].neg - a[1].neg)
    .slice(0, 3)
    .map(([theme]) => theme.replace(/_/g, " "));

  // Reddit thread clusters
  const redditThreadClusters = buildRedditClusters(redditEvidence);

  // Compute overall score from latest ranking
  const latestRanking = await prisma.rankingResult.findFirst({
    where: {
      query: {
        evidence: { some: { productId: product.id } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let score = 0;
  let bestForTags: string[] = [];
  if (latestRanking) {
    const top10 = latestRanking.top10 as { productId: string; scores: { overall: number }; rationale: string }[];
    const thisProduct = top10.find((p) => p.productId === product.id);
    score = thisProduct?.scores?.overall ?? 0;
  }
  bestForTags = positiveThemes.slice(0, 3);

  // All sources as citations
  const sources: CitationRef[] = evidence.map((e) => ({
    sourceId: e.source.id,
    url: e.source.url,
    platform: e.source.platform.toLowerCase() as CitationRef["platform"],
    title: e.source.title ?? undefined,
    snippet: e.source.snippet ?? undefined,
    capturedAt: e.source.capturedAt.toISOString(),
  }));

  // Dedupe sources by URL
  const seenUrls = new Set<string>();
  const uniqueSources = sources.filter((s) => {
    if (seenUrls.has(s.url)) return false;
    seenUrls.add(s.url);
    return true;
  });

  // Cast to access new schema fields (brandUrl, price, buyUrl) added in migration
  const productData = product as (typeof product & {
    brandUrl?: string | null;
    price?: number | null;
    buyUrl?: string | null;
  });

  // Enrich images: if DB has none, try featured search data, then scrape
  let productImages = (product.images as string[]) ?? [];
  if (productImages.length === 0) {
    // Check featured search data for a known imageUrl
    for (const fs of featuredSearches) {
      const entry = fs.data.top10.find((item) => item.product.slug === product.canonicalSlug);
      if (entry?.product.imageUrl) {
        productImages = [entry.product.imageUrl];
        break;
      }
    }
  }
  if (productImages.length === 0) {
    try {
      const scraped = await scrapeProductImage(product.brand, product.model);
      if (scraped) productImages = [scraped];
    } catch {
      // scrape failed — continue without image
    }
  }

  // Build brand info from the related Brand record
  const brandRef = product.brandRef;
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
    product: {
      brand: product.brand,
      model: product.model,
      slug: product.canonicalSlug,
      category: product.category,
      images: productImages,
      specs: (product.specs as Record<string, string>) ?? {},
      score,
      bestForTags,
      brandUrl: productData.brandUrl ?? undefined,
      price: productData.price ?? undefined,
      buyUrl: productData.buyUrl ?? undefined,
      brandInfo,
    },
    verdict: {
      forWhom: positiveThemes.length > 0
        ? positiveThemes.map((t) => `People who value ${t}`)
        : ["General users looking for this product type"],
      notForWhom: negativeThemes.length > 0
        ? negativeThemes.map((t) => `Those sensitive to ${t} issues`)
        : ["No significant complaints found"],
    },
    socialSentiment: {
      themes: [...themeCounts.entries()].map(([name, counts]) => ({
        name: name.replace(/_/g, " "),
        sentiment: counts.pos > counts.neg ? "positive" : counts.neg > counts.pos ? "negative" : "mixed",
        mentionCount: counts.pos + counts.neg + counts.neu,
      })).sort((a, b) => b.mentionCount - a.mentionCount),
      pros,
      cons,
    },
    tiktok: {
      available: tiktokEvidence.length > 0,
      themes: [...new Set(tiktokEvidence.flatMap((e) => (e.themes as string[]) ?? []))],
      topAngles: [],
      sourcePosts: tiktokEvidence.slice(0, 5).map((e) => ({
        url: e.source.url,
        description: e.quote ?? "",
      })),
    },
    reddit: {
      available: redditEvidence.length > 0,
      threadClusters: redditThreadClusters,
      commonComplaints: redditEvidence
        .filter((e) => e.sentiment === "NEGATIVE" && e.quote)
        .slice(0, 5)
        .map((e) => e.quote!),
      defendedBenefits: redditEvidence
        .filter((e) => e.sentiment === "POSITIVE" && e.quote)
        .slice(0, 5)
        .map((e) => e.quote!),
    },
    trustpilot: {
      available: trustpilotEvidence.length > 0,
      // Trustpilot data would come from the retriever, stored differently
      // For now, basic info from evidence
    },
    sources: uniqueSources,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a basic ProductPageData from a featured search entry when the product
 * is not yet in the database.
 */
async function buildFromFeaturedSearch(slug: string): Promise<ProductPageData | null> {
  for (const fs of featuredSearches) {
    const entry = fs.data.top10.find((item) => item.product.slug === slug);
    if (!entry) continue;

    const p = entry.product;

    // Scrape an image if the static data doesn't have one
    let images: string[] = p.imageUrl ? [p.imageUrl] : [];
    if (images.length === 0) {
      try {
        const scraped = await scrapeProductImage(p.brand, p.model);
        if (scraped) images = [scraped];
      } catch {
        // Image scrape failed — continue without image
      }
    }

    // Derive TikTok availability from platformCoverage
    const tiktokCoverage = entry.platformCoverage.TikTok ?? "none";
    const tiktokAvailable = tiktokCoverage !== "none";

    // Build richer Reddit thread clusters grouped by subreddit
    const subredditGroups = new Map<string, { url: string; title: string; quote: string }[]>();
    for (const ev of entry.redditEvidence) {
      const sub = ev.subreddit ?? inferSubreddit(ev.url);
      const list = subredditGroups.get(sub) ?? [];
      list.push({ url: ev.url, title: `${sub} discussion`, quote: ev.quote });
      subredditGroups.set(sub, list);
    }
    const threadClusters = [...subredditGroups.entries()].map(([theme, threads]) => ({
      theme,
      threads: threads.slice(0, 5),
    }));

    // Build Trustpilot section from pre-seeded data or platformCoverage flag
    const tp = entry.trustpilotData;
    const trustpilot = tp
      ? {
          available: true,
          rating: tp.rating,
          reviewCount: tp.reviewCount,
          scope: "brand" as const,
          capturedAt: new Date().toISOString(),
          url: tp.url,
        }
      : {
          available: (entry.platformCoverage.Trustpilot ?? "none") !== "none",
        };

    return {
      product: {
        brand: p.brand,
        model: p.model,
        slug: p.slug,
        category: p.category,
        images,
        specs: entry.specs ?? {},
        score: entry.scores.overall,
        bestForTags: entry.fitCriteria.slice(0, 3),
        brandUrl: p.brandUrl,
        price: p.price,
        buyUrl: p.buyUrl,
        brandInfo: p.brandInfo,
      },
      verdict: {
        forWhom: entry.pros.map((pro) => `People who value ${pro.toLowerCase()}`),
        notForWhom: entry.cons.map((con) => `Those sensitive to ${con.toLowerCase()}`),
      },
      socialSentiment: {
        themes: entry.fitCriteria.map((c) => ({
          name: c,
          sentiment: "positive",
          mentionCount: 1,
        })),
        pros: entry.redditEvidence.map((e) => e.quote),
        cons: entry.cons,
      },
      tiktok: {
        available: tiktokAvailable,
        themes: tiktokAvailable ? entry.fitCriteria.slice(0, 3) : [],
        topAngles: [],
        sourcePosts: [],
      },
      reddit: {
        available: entry.redditEvidence.length > 0,
        threadClusters: threadClusters.length > 0 ? threadClusters : [],
        commonComplaints: entry.cons,
        defendedBenefits: entry.pros,
      },
      trustpilot,
      sources: entry.redditEvidence.map((e, i) => ({
        sourceId: `featured-${i}`,
        url: e.url,
        platform: "reddit" as const,
        title: e.subreddit ? `${e.subreddit} discussion` : "Reddit discussion",
        capturedAt: new Date().toISOString(),
      })),
    };
  }
  return null;
}

/** Extract subreddit name from a Reddit URL */
function inferSubreddit(url: string): string {
  const match = url.match(/reddit\.com\/r\/([^/]+)/);
  return match ? `r/${match[1]}` : "Reddit";
}

function buildRedditClusters(
  evidence: { source: { url: string; title: string | null }; themes: unknown; quote: string | null }[]
): { theme: string; threads: { url: string; title: string; quote: string }[] }[] {
  // Group by theme
  const themeMap = new Map<string, { url: string; title: string; quote: string }[]>();

  for (const ev of evidence) {
    const themes = (ev.themes as string[]) ?? ["general"];
    for (const theme of themes) {
      const list = themeMap.get(theme) ?? [];
      list.push({
        url: ev.source.url,
        title: ev.source.title ?? "Reddit thread",
        quote: ev.quote ?? "",
      });
      themeMap.set(theme, list);
    }
  }

  return [...themeMap.entries()]
    .map(([theme, threads]) => ({
      theme: theme.replace(/_/g, " "),
      threads: threads.slice(0, 5),
    }))
    .slice(0, 6);
}
