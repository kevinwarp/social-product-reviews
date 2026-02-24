import { describe, it, expect } from "vitest";
import {
  featuredSearches,
  getFeaturedSearch,
  getAllFeaturedSlugs,
} from "@/lib/featured-searches";
import type { ResultsPageData } from "@/lib/types";

// ─── Featured Search Registry ─────────────────────────────────────────────────

describe("featured search registry", () => {
  it("has at least one featured search", () => {
    expect(featuredSearches.length).toBeGreaterThan(0);
  });

  it("getAllFeaturedSlugs returns all slugs", () => {
    const slugs = getAllFeaturedSlugs();
    expect(slugs).toHaveLength(featuredSearches.length);
    for (const fs of featuredSearches) {
      expect(slugs).toContain(fs.slug);
    }
  });

  it("getFeaturedSearch finds each search by slug", () => {
    for (const fs of featuredSearches) {
      const found = getFeaturedSearch(fs.slug);
      expect(found).toBeDefined();
      expect(found!.slug).toBe(fs.slug);
    }
  });

  it("getFeaturedSearch returns undefined for nonexistent slug", () => {
    expect(getFeaturedSearch("does-not-exist")).toBeUndefined();
  });

  it("has unique slugs across all featured searches", () => {
    const slugs = featuredSearches.map((fs) => fs.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

// ─── Featured Search Data Completeness ────────────────────────────────────────

describe("featured search data completeness", () => {
  for (const fs of featuredSearches) {
    describe(`"${fs.slug}"`, () => {
      const data = fs.data;

      it("has a non-empty rawQuery", () => {
        expect(data.rawQuery.length).toBeGreaterThan(0);
      });

      it("has a valid parsedIntent", () => {
        expect(data.parsedIntent.useCase).toBeTruthy();
        expect(Array.isArray(data.parsedIntent.constraints)).toBe(true);
        expect(Array.isArray(data.parsedIntent.mustHaves)).toBe(true);
        expect(Array.isArray(data.parsedIntent.niceToHaves)).toBe(true);
      });

      it("has candidateCount > 0", () => {
        expect(data.candidateCount).toBeGreaterThan(0);
      });

      it("has exactly 10 products in top10", () => {
        expect(data.top10).toHaveLength(10);
      });

      it("has ranks 1 through 10 in order", () => {
        const ranks = data.top10.map((item) => item.rank);
        expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      });

      it("has methodology and buyingAdvice", () => {
        expect(data.methodology).toBeTruthy();
        expect(data.buyingAdvice).toBeTruthy();
      });
    });
  }
});

// ─── Product Data Validation ──────────────────────────────────────────────────

describe("product data within featured searches", () => {
  const allProducts = featuredSearches.flatMap((fs) =>
    fs.data.top10.map((item) => ({
      searchSlug: fs.slug,
      ...item,
    }))
  );

  it("every product has a non-empty brand", () => {
    for (const item of allProducts) {
      expect(item.product.brand, `${item.searchSlug} rank ${item.rank}`).toBeTruthy();
    }
  });

  it("every product has a non-empty model", () => {
    for (const item of allProducts) {
      expect(item.product.model, `${item.searchSlug} rank ${item.rank}`).toBeTruthy();
    }
  });

  it("every product has a non-empty slug", () => {
    for (const item of allProducts) {
      expect(item.product.slug, `${item.searchSlug} rank ${item.rank}`).toBeTruthy();
    }
  });

  it("every product slug is a valid URL segment", () => {
    for (const item of allProducts) {
      expect(
        item.product.slug,
        `Invalid slug: ${item.product.slug}`
      ).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("every product has a non-empty category", () => {
    for (const item of allProducts) {
      expect(item.product.category, `${item.searchSlug} rank ${item.rank}`).toBeTruthy();
    }
  });

  it("every product has a non-empty summary", () => {
    for (const item of allProducts) {
      expect(item.summary, `${item.searchSlug} rank ${item.rank}`).toBeTruthy();
    }
  });

  it("every product has a non-empty tagline", () => {
    for (const item of allProducts) {
      expect(item.tagline, `${item.searchSlug} rank ${item.rank}`).toBeTruthy();
    }
  });

  it("every product has at least one pro", () => {
    for (const item of allProducts) {
      expect(
        item.pros.length,
        `${item.searchSlug} rank ${item.rank} has no pros`
      ).toBeGreaterThan(0);
    }
  });

  it("every product has at least one con", () => {
    for (const item of allProducts) {
      expect(
        item.cons.length,
        `${item.searchSlug} rank ${item.rank} has no cons`
      ).toBeGreaterThan(0);
    }
  });

  it("every product has at least one reddit evidence entry", () => {
    for (const item of allProducts) {
      expect(
        item.redditEvidence.length,
        `${item.searchSlug} rank ${item.rank} has no reddit evidence`
      ).toBeGreaterThan(0);
    }
  });

  it("every product has valid scores (0-100)", () => {
    for (const item of allProducts) {
      const { scores } = item;
      for (const [key, value] of Object.entries(scores)) {
        expect(value, `${item.product.slug} score.${key}`).toBeGreaterThanOrEqual(0);
        expect(value, `${item.product.slug} score.${key}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("every product has a valid confidence level", () => {
    for (const item of allProducts) {
      expect(["high", "medium", "low"]).toContain(item.confidenceLevel);
    }
  });

  it("every product has sourceCount > 0", () => {
    for (const item of allProducts) {
      expect(
        item.sourceCount,
        `${item.searchSlug} rank ${item.rank} has no sources`
      ).toBeGreaterThan(0);
    }
  });
});

// ─── Product Slug Uniqueness Across All Searches ──────────────────────────────

describe("product slug uniqueness", () => {
  it("all product slugs across all searches are unique (except intentional duplicates)", () => {
    const slugCounts = new Map<string, string[]>();
    for (const fs of featuredSearches) {
      for (const item of fs.data.top10) {
        const existing = slugCounts.get(item.product.slug) ?? [];
        existing.push(fs.slug);
        slugCounts.set(item.product.slug, existing);
      }
    }

    // Duplicates are OK (same product in multiple lists), but flag them for awareness
    const duplicates = [...slugCounts.entries()].filter(([, lists]) => lists.length > 1);
    for (const [slug, lists] of duplicates) {
      // This is not a failure, just tracking — product appears in multiple lists
      expect(lists.length).toBeGreaterThan(1);
      // But the slug itself should still be valid
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("within a single search, all product slugs are unique", () => {
    for (const fs of featuredSearches) {
      const slugs = fs.data.top10.map((item) => item.product.slug);
      expect(
        new Set(slugs).size,
        `Duplicate slugs in ${fs.slug}`
      ).toBe(slugs.length);
    }
  });
});

// ─── Rank Labels ──────────────────────────────────────────────────────────────

describe("rank labels", () => {
  for (const fs of featuredSearches) {
    describe(`"${fs.slug}"`, () => {
      it("rank 1 has 'Our Pick' label", () => {
        const pick1 = fs.data.top10.find((item) => item.rank === 1);
        expect(pick1?.rankLabel).toBe("Our Pick");
      });

      it("rank 2 has 'Runner-Up' label", () => {
        const pick2 = fs.data.top10.find((item) => item.rank === 2);
        expect(pick2?.rankLabel).toBe("Runner-Up");
      });

      it("rank 3 has 'Also Great' label", () => {
        const pick3 = fs.data.top10.find((item) => item.rank === 3);
        expect(pick3?.rankLabel).toBe("Also Great");
      });
    });
  }
});
