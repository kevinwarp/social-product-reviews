import { fetchJSON, waitForRateLimit } from "@/lib/retrievers/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SerpAPIImagesResponse {
  images_results?: {
    position: number;
    thumbnail: string;
    original: string;
    original_width: number;
    original_height: number;
    source: string;
    title: string;
    link: string;
  }[];
  error?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scrape a product image URL using SerpAPI Google Images.
 * Searches "{brand} {model} product" and returns the best image URL.
 *
 * Returns null if no suitable image is found or if SerpAPI is unavailable.
 */
export async function scrapeProductImage(
  brand: string,
  model: string
): Promise<string | null> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    console.warn("[ProductImage] SERPAPI_API_KEY not set — image scrape skipped");
    return null;
  }

  const query = `${brand} ${model} product`;

  try {
    // Respect rate limits (shared with other SerpAPI calls)
    await waitForRateLimit("serpapi", 10, 60_000);

    const params = new URLSearchParams({
      q: query,
      api_key: apiKey,
      engine: "google_images",
      num: "5",
      gl: "us",
      hl: "en",
      safe: "active",
      // Prefer product photos over lifestyle images
      tbs: "isz:m", // medium-sized images
    });

    const data = await fetchJSON<SerpAPIImagesResponse>(
      `https://serpapi.com/search.json?${params}`,
      { timeoutMs: 15000 }
    );

    if (data.error) {
      console.warn("[ProductImage] SerpAPI error:", data.error);
      return null;
    }

    const results = data.images_results ?? [];
    if (results.length === 0) {
      console.log(`[ProductImage] No images found for "${query}"`);
      return null;
    }

    // Pick the best image: prefer original URLs from known product domains
    const preferredImage = pickBestImage(results);
    console.log(`[ProductImage] Found image for "${query}": ${preferredImage}`);
    return preferredImage;
  } catch (error) {
    console.error(`[ProductImage] Failed to scrape image for "${query}":`, error);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Select the best image from SerpAPI results.
 * Prefers images from reputable product sources (Amazon, brand sites)
 * and reasonable dimensions.
 */
function pickBestImage(
  results: NonNullable<SerpAPIImagesResponse["images_results"]>
): string {
  // Domains that tend to have clean product images
  const preferredDomains = [
    "amazon.com",
    "m.media-amazon.com",
    "images-na.ssl-images-amazon.com",
    "target.com",
    "bestbuy.com",
    "walmart.com",
    "sephora.com",
    "ulta.com",
  ];

  // First pass: look for an image from a preferred domain with good dimensions
  for (const result of results) {
    const isPreferred = preferredDomains.some(
      (d) => result.original.includes(d) || result.source.includes(d)
    );
    const hasGoodDimensions =
      result.original_width >= 200 &&
      result.original_height >= 200 &&
      result.original_width <= 2000;

    if (isPreferred && hasGoodDimensions) {
      return result.original;
    }
  }

  // Second pass: any image with good dimensions
  for (const result of results) {
    if (result.original_width >= 200 && result.original_height >= 200) {
      return result.original;
    }
  }

  // Fallback: first thumbnail
  return results[0].thumbnail;
}
