import type { RetrievedMention } from "@/lib/types";
import { fetchJSON, waitForRateLimit, truncate } from "./utils";

/**
 * TikTok retriever — uses SerpAPI to find TikTok content via Google search.
 *
 * TikTok doesn't have a public search API, so we search Google for
 * `site:tiktok.com "{brand} {model}"` and extract matching TikTok URLs.
 */

export interface TikTokRetrievalResult {
  mentions: RetrievedMention[];
  available: boolean;
  reason: string;
}

// SerpAPI rate limit (shared with other SerpAPI calls)
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface SerpAPIResponse {
  organic_results?: {
    position: number;
    title: string;
    link: string;
    snippet: string;
    displayed_link: string;
    date?: string;
  }[];
  error?: string;
}

/**
 * Attempt to retrieve TikTok mentions for given search terms.
 * Uses SerpAPI to search Google for TikTok content about the product.
 */
export async function retrieveTikTokMentions(
  searchTerms: string[],
  options?: {
    maxResults?: number;
  }
): Promise<TikTokRetrievalResult> {
  const { maxResults = 10 } = options ?? {};

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return {
      mentions: [],
      available: false,
      reason: "SERPAPI_API_KEY not set — TikTok search skipped.",
    };
  }

  const allMentions: RetrievedMention[] = [];

  // Search for each term on TikTok via Google
  for (const term of searchTerms.slice(0, 3)) {
    try {
      await waitForRateLimit("serpapi", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

      const query = `site:tiktok.com ${term}`;
      const params = new URLSearchParams({
        q: query,
        api_key: apiKey,
        engine: "google",
        num: String(Math.min(maxResults, 10)),
        gl: "us",
        hl: "en",
      });

      const data = await fetchJSON<SerpAPIResponse>(
        `https://serpapi.com/search.json?${params}`,
        { timeoutMs: 15000 }
      );

      if (data.error) {
        console.warn("[TikTok] SerpAPI error:", data.error);
        continue;
      }

      for (const result of data.organic_results ?? []) {
        // Only include actual TikTok video/profile URLs
        if (!result.link.includes("tiktok.com")) continue;

        allMentions.push({
          platform: "tiktok",
          url: result.link,
          title: result.title,
          text: truncate(result.snippet ?? "", 500),
          createdAt: result.date,
        });
      }
    } catch (error) {
      console.error(`[TikTok] Search failed for "${term}":`, error);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = allMentions.filter((m) => {
    const key = m.url.toLowerCase().replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const capped = unique.slice(0, maxResults);

  return {
    mentions: capped,
    available: capped.length > 0,
    reason: capped.length > 0
      ? `Found ${capped.length} TikTok mention(s) via web search.`
      : "No TikTok content found for this product.",
  };
}

/**
 * Check if TikTok retrieval is currently available.
 * Available when SERPAPI_API_KEY is set.
 */
export function isTikTokAvailable(): boolean {
  return !!process.env.SERPAPI_API_KEY;
}
