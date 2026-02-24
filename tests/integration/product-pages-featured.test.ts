import { describe, it, expect, vi, beforeEach } from "vitest";
import { featuredSearches } from "@/lib/featured-searches";

// ─── Mock Prisma (DB unavailable — forces featured search fallback) ───────────

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findUnique: vi.fn().mockRejectedValue(new Error("DB unavailable")),
    },
    evidence: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    rankingResult: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { generateProductPageData } from "@/lib/generators/product-page";

// ─── Product Page Generation (from featured search fallback) ──────────────────

describe("product page generation from featured searches", () => {
  // Collect all unique product slugs across all featured searches
  const allProducts = new Map<string, { brand: string; model: string; slug: string }>();
  for (const fs of featuredSearches) {
    for (const item of fs.data.top10) {
      allProducts.set(item.product.slug, {
        brand: item.product.brand,
        model: item.product.model,
        slug: item.product.slug,
      });
    }
  }

  for (const [slug, product] of allProducts) {
    describe(`${product.brand} ${product.model} (${slug})`, () => {
      it("generates a non-null product page", async () => {
        const data = await generateProductPageData(slug);
        expect(data).not.toBeNull();
      });

      it("has correct brand and model", async () => {
        const data = await generateProductPageData(slug);
        expect(data!.product.brand).toBe(product.brand);
        expect(data!.product.model).toBe(product.model);
        expect(data!.product.slug).toBe(product.slug);
      });

      it("has a non-empty category", async () => {
        const data = await generateProductPageData(slug);
        expect(data!.product.category).toBeTruthy();
      });

      it("has a score >= 0", async () => {
        const data = await generateProductPageData(slug);
        expect(data!.product.score).toBeGreaterThanOrEqual(0);
      });

      it("has verdict sections", async () => {
        const data = await generateProductPageData(slug);
        expect(data!.verdict.forWhom.length).toBeGreaterThan(0);
        expect(data!.verdict.notForWhom.length).toBeGreaterThan(0);
      });

      it("has social sentiment themes", async () => {
        const data = await generateProductPageData(slug);
        expect(data!.socialSentiment.themes.length).toBeGreaterThan(0);
      });

      it("has sources", async () => {
        const data = await generateProductPageData(slug);
        expect(data!.sources.length).toBeGreaterThan(0);
        for (const source of data!.sources) {
          expect(source.url).toBeTruthy();
          expect(source.platform).toBeTruthy();
          expect(source.capturedAt).toBeTruthy();
        }
      });

      it("has reddit data for products with reddit evidence", async () => {
        const data = await generateProductPageData(slug);
        // All featured products have reddit evidence
        expect(data!.reddit.available).toBe(true);
        expect(data!.reddit.threadClusters.length).toBeGreaterThan(0);
      });
    });
  }
});

// ─── Nonexistent Product ──────────────────────────────────────────────────────

describe("nonexistent product", () => {
  it("returns null for a slug not in DB or featured searches", async () => {
    const data = await generateProductPageData("totally-fake-product-slug-123");
    expect(data).toBeNull();
  });
});
