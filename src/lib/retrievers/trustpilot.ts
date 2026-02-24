import type { TrustpilotData } from "@/lib/types";
import { fetchWithTimeout, waitForRateLimit, withRetry, RetrieverError } from "./utils";

// Conservative rate limit for Trustpilot
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const USER_AGENT = "Mozilla/5.0 (compatible; SocialProductReviews/1.0)";

/**
 * Fetch Trustpilot rating data for a brand.
 * Uses the public Trustpilot page and extracts structured data from JSON-LD.
 *
 * Important: This retrieves brand-level data, not product-level.
 * The result is labeled accordingly (scope: "brand").
 */
export async function fetchTrustpilotBrand(
  brandSlug: string
): Promise<TrustpilotData | null> {
  await waitForRateLimit("trustpilot", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  const url = `https://www.trustpilot.com/review/${brandSlug}`;

  try {
    const response = await withRetry(
      () =>
        fetchWithTimeout(url, {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/html",
          },
          timeoutMs: 15000,
        }),
      { maxRetries: 2 }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Brand not found on Trustpilot
      }
      throw new RetrieverError(
        `Trustpilot HTTP ${response.status}`,
        response.status,
        "trustpilot"
      );
    }

    const html = await response.text();
    return parseJsonLd(html, brandSlug, url);
  } catch (error) {
    if (error instanceof RetrieverError) throw error;
    console.error(`Trustpilot fetch failed for ${brandSlug}:`, error);
    return null;
  }
}

/**
 * Attempt to find a Trustpilot page for a brand name.
 * Tries common slug variations (lowercase, hyphenated, with .com suffix).
 */
export async function findTrustpilotBrand(
  brandName: string
): Promise<TrustpilotData | null> {
  const slugVariations = generateSlugs(brandName);

  for (const slug of slugVariations) {
    const data = await fetchTrustpilotBrand(slug);
    if (data) return data;
  }

  return null;
}

/**
 * Batch lookup: find Trustpilot data for multiple brands.
 */
export async function retrieveTrustpilotData(
  brandNames: string[]
): Promise<Map<string, TrustpilotData>> {
  const results = new Map<string, TrustpilotData>();

  for (const brand of brandNames) {
    const data = await findTrustpilotBrand(brand);
    if (data) {
      results.set(brand, data);
    }
  }

  return results;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Parse JSON-LD structured data from the Trustpilot HTML page.
 * Trustpilot embeds AggregateRating schema in their pages.
 */
function parseJsonLd(
  html: string,
  brandSlug: string,
  url: string
): TrustpilotData | null {
  try {
    // Find JSON-LD script tags
    const jsonLdRegex =
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);

        // Look for Organization with AggregateRating
        if (data["@type"] === "Organization" && data.aggregateRating) {
          const rating = data.aggregateRating;
          return {
            brandName: data.name ?? brandSlug,
            rating: parseFloat(rating.ratingValue),
            reviewCount: parseInt(rating.reviewCount, 10),
            url,
            capturedAt: new Date().toISOString(),
            scope: "brand",
          };
        }

        // Sometimes it's a LocalBusiness
        if (data["@type"] === "LocalBusiness" && data.aggregateRating) {
          const rating = data.aggregateRating;
          return {
            brandName: data.name ?? brandSlug,
            rating: parseFloat(rating.ratingValue),
            reviewCount: parseInt(rating.reviewCount, 10),
            url,
            capturedAt: new Date().toISOString(),
            scope: "brand",
          };
        }
      } catch {
        // Malformed JSON-LD block, skip
        continue;
      }
    }

    // Fallback: try to extract from meta tags or data attributes
    return parseFromMeta(html, brandSlug, url);
  } catch (error) {
    console.error("Trustpilot JSON-LD parse failed:", error);
    return null;
  }
}

/**
 * Fallback parser: extract rating from meta tags or common patterns.
 */
function parseFromMeta(
  html: string,
  brandSlug: string,
  url: string
): TrustpilotData | null {
  // Try og:title or page title for brand name
  const titleMatch = html.match(
    /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i
  );
  const brandName = titleMatch?.[1]?.replace(/ Reviews.*$/i, "").trim() ?? brandSlug;

  // Try to find rating value in common patterns
  const ratingMatch = html.match(
    /data-rating-value=["'](\d+\.?\d*)["']/i
  ) ?? html.match(
    /"ratingValue"\s*:\s*"?(\d+\.?\d*)"?/i
  );

  const countMatch = html.match(
    /data-reviews-count=["'](\d+)["']/i
  ) ?? html.match(
    /"reviewCount"\s*:\s*"?(\d+)"?/i
  );

  if (ratingMatch && countMatch) {
    return {
      brandName,
      rating: parseFloat(ratingMatch[1]),
      reviewCount: parseInt(countMatch[1], 10),
      url,
      capturedAt: new Date().toISOString(),
      scope: "brand",
    };
  }

  return null;
}

/**
 * Generate possible Trustpilot URL slugs for a brand name.
 */
function generateSlugs(brandName: string): string[] {
  const base = brandName.toLowerCase().trim();
  const hyphenated = base.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const slugs = [
    hyphenated,
    `${hyphenated}.com`,
    `www.${hyphenated}.com`,
  ];

  // Common brand domain patterns
  if (!base.includes(".")) {
    slugs.push(`${hyphenated}.co.uk`, `${hyphenated}.net`);
  }

  return slugs;
}
