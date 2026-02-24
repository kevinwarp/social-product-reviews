import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockQueryFindUnique = vi.fn();
const mockProductFindUnique = vi.fn();
const mockEvidenceFindMany = vi.fn();
const mockRankingResultFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    query: {
      findUnique: (...args: unknown[]) => mockQueryFindUnique(...args),
    },
    product: {
      findUnique: (...args: unknown[]) => mockProductFindUnique(...args),
    },
    evidence: {
      findMany: (...args: unknown[]) => mockEvidenceFindMany(...args),
    },
    rankingResult: {
      findFirst: (...args: unknown[]) => mockRankingResultFindFirst(...args),
    },
  },
}));

import { generateResultsPageData } from "@/lib/generators/results-page";
import { generateProductPageData } from "@/lib/generators/product-page";

// ─── Results Page Generator ───────────────────────────────────────────────────

describe("generateResultsPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when query not found", async () => {
    mockQueryFindUnique.mockResolvedValue(null);
    const result = await generateResultsPageData("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when no ranking results exist", async () => {
    mockQueryFindUnique.mockResolvedValue({
      id: "q1",
      rawQuery: "test query",
      parsedIntent: { useCase: "test", constraints: [], mustHaves: [], niceToHaves: [] },
      rankingResults: [],
    });

    const result = await generateResultsPageData("q1");
    expect(result).toBeNull();
  });

  it("returns structured results page data", async () => {
    mockQueryFindUnique.mockResolvedValue({
      id: "q1",
      rawQuery: "headphones for sleeping",
      parsedIntent: {
        useCase: "sleeping",
        constraints: ["comfortable"],
        mustHaves: ["wireless"],
        niceToHaves: [],
      },
      rankingResults: [
        {
          id: "r1",
          candidateCount: 50,
          top10: [
            {
              productId: "prod-1",
              rank: 1,
              scores: { queryFit: 80, redditEndorsement: 70, socialProofCoverage: 60, riskScore: 85, confidenceScore: 75, overall: 74 },
              rationale: "Great for sleeping due to comfort.",
              citations: [],
            },
          ],
          createdAt: new Date(),
        },
      ],
    });

    mockProductFindUnique.mockResolvedValue({
      id: "prod-1",
      brand: "Sony",
      model: "WF-1000XM5",
      canonicalSlug: "sony-wf-1000xm5",
      category: "earbuds",
    });

    mockEvidenceFindMany.mockResolvedValue([
      {
        id: "ev-1",
        sentiment: "POSITIVE",
        themes: ["comfort"],
        claimTags: ["wireless"],
        quote: "So comfortable for sleeping",
        source: {
          id: "src-1",
          platform: "REDDIT",
          url: "https://reddit.com/1",
          title: "Thread about sleep earbuds",
          capturedAt: new Date(),
        },
      },
    ]);

    const result = await generateResultsPageData("q1");

    expect(result).not.toBeNull();
    expect(result!.queryId).toBe("q1");
    expect(result!.rawQuery).toBe("headphones for sleeping");
    expect(result!.candidateCount).toBe(50);
    expect(result!.top10).toHaveLength(1);
    expect(result!.top10[0].rank).toBe(1);
    expect(result!.top10[0].product.brand).toBe("Sony");
    expect(result!.top10[0].product.slug).toBe("sony-wf-1000xm5");
    expect(result!.top10[0].confidenceLevel).toBeDefined();
    expect(["high", "medium", "low"]).toContain(result!.top10[0].confidenceLevel);
    expect(result!.top10[0].redditEvidence.length).toBeGreaterThanOrEqual(0);
    expect(result!.parsedIntent.useCase).toBe("sleeping");
  });
});

// ─── Product Page Generator ───────────────────────────────────────────────────

describe("generateProductPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when product not found", async () => {
    mockProductFindUnique.mockResolvedValue(null);
    const result = await generateProductPageData("nonexistent-slug");
    expect(result).toBeNull();
  });

  it("returns structured product page data", async () => {
    mockProductFindUnique.mockResolvedValue({
      id: "prod-1",
      brand: "Sony",
      model: "WF-1000XM5",
      canonicalSlug: "sony-wf-1000xm5",
      category: "earbuds",
      images: [],
      specs: { driver: "6mm", battery: "8h" },
    });

    mockEvidenceFindMany.mockResolvedValue([
      {
        id: "ev-1",
        productId: "prod-1",
        sentiment: "POSITIVE",
        themes: ["comfort", "sound_quality"],
        claimTags: ["wireless"],
        quote: "Amazing comfort for sleeping",
        source: {
          id: "src-1",
          platform: "REDDIT",
          url: "https://reddit.com/1",
          title: "Sleep earbuds thread",
          snippet: "Short snippet",
          capturedAt: new Date("2025-01-15"),
        },
      },
      {
        id: "ev-2",
        productId: "prod-1",
        sentiment: "NEGATIVE",
        themes: ["connectivity"],
        claimTags: [],
        quote: "Bluetooth drops sometimes",
        source: {
          id: "src-2",
          platform: "REDDIT",
          url: "https://reddit.com/2",
          title: "Problems with XM5",
          snippet: null,
          capturedAt: new Date("2025-02-01"),
        },
      },
    ]);

    mockRankingResultFindFirst.mockResolvedValue({
      top10: [
        { productId: "prod-1", scores: { overall: 74 } },
      ],
    });

    const result = await generateProductPageData("sony-wf-1000xm5");

    expect(result).not.toBeNull();
    expect(result!.product.brand).toBe("Sony");
    expect(result!.product.model).toBe("WF-1000XM5");
    expect(result!.product.slug).toBe("sony-wf-1000xm5");
    expect(result!.product.score).toBe(74);
    expect(result!.product.specs).toEqual({ driver: "6mm", battery: "8h" });

    // Verdict
    expect(result!.verdict.forWhom.length).toBeGreaterThan(0);
    expect(result!.verdict.notForWhom.length).toBeGreaterThan(0);

    // Social sentiment
    expect(result!.socialSentiment.themes.length).toBeGreaterThan(0);
    expect(result!.socialSentiment.pros.length).toBeGreaterThan(0);
    expect(result!.socialSentiment.cons.length).toBeGreaterThan(0);

    // Reddit
    expect(result!.reddit.available).toBe(true);

    // TikTok (no evidence)
    expect(result!.tiktok.available).toBe(false);

    // Sources
    expect(result!.sources.length).toBeGreaterThan(0);
    expect(result!.sources[0].platform).toBe("reddit");
    expect(result!.sources[0].url).toBeTruthy();
  });

  it("handles product with no evidence", async () => {
    mockProductFindUnique.mockResolvedValue({
      id: "prod-2",
      brand: "Unknown",
      model: "Product",
      canonicalSlug: "unknown-product",
      category: "general",
      images: [],
      specs: {},
    });

    mockEvidenceFindMany.mockResolvedValue([]);
    mockRankingResultFindFirst.mockResolvedValue(null);

    const result = await generateProductPageData("unknown-product");

    expect(result).not.toBeNull();
    expect(result!.product.score).toBe(0);
    expect(result!.socialSentiment.themes).toHaveLength(0);
    expect(result!.reddit.available).toBe(false);
    expect(result!.tiktok.available).toBe(false);
    expect(result!.trustpilot.available).toBe(false);
    expect(result!.sources).toHaveLength(0);
    expect(result!.verdict.forWhom.length).toBeGreaterThan(0); // Should have fallback
  });

  it("deduplicates sources by URL", async () => {
    mockProductFindUnique.mockResolvedValue({
      id: "prod-1",
      brand: "Sony",
      model: "XM5",
      canonicalSlug: "sony-xm5",
      category: "earbuds",
      images: [],
      specs: {},
    });

    // Two evidence items from the same source URL
    const sharedSource = {
      id: "src-1",
      platform: "REDDIT",
      url: "https://reddit.com/same-thread",
      title: "Thread",
      snippet: null,
      capturedAt: new Date(),
    };

    mockEvidenceFindMany.mockResolvedValue([
      { id: "ev-1", productId: "prod-1", sentiment: "POSITIVE", themes: ["comfort"], claimTags: [], quote: "Quote 1", source: sharedSource },
      { id: "ev-2", productId: "prod-1", sentiment: "POSITIVE", themes: ["comfort"], claimTags: [], quote: "Quote 2", source: sharedSource },
    ]);

    mockRankingResultFindFirst.mockResolvedValue(null);

    const result = await generateProductPageData("sony-xm5");

    // Sources should be deduplicated
    expect(result!.sources).toHaveLength(1);
  });
});
