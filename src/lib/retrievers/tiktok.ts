import type { RetrievedMention } from "@/lib/types";

/**
 * TikTok retriever — STUB for MVP.
 *
 * TikTok doesn't have a public search API that's easily accessible.
 * Retrieval method TBD (options: search API provider, embed scraping, or manual curation).
 *
 * This stub returns an empty result set so the rest of the pipeline
 * handles "no TikTok data" gracefully.
 */

export interface TikTokRetrievalResult {
  mentions: RetrievedMention[];
  available: boolean;
  reason: string;
}

/**
 * Attempt to retrieve TikTok mentions for given search terms.
 * Currently returns empty results with a clear "not available" status.
 */
export async function retrieveTikTokMentions(
  _searchTerms: string[],
  _options?: {
    maxResults?: number;
  }
): Promise<TikTokRetrievalResult> {
  // TODO: Implement when TikTok retrieval method is decided
  // Options being considered:
  // 1. Third-party search API (e.g., Apify, ScrapingBee)
  // 2. TikTok embed URL scraping
  // 3. Manual curation + TikTok Research API (requires approval)

  return {
    mentions: [],
    available: false,
    reason: "TikTok retrieval not yet implemented. Data will be available in a future update.",
  };
}

/**
 * Check if TikTok retrieval is currently available.
 */
export function isTikTokAvailable(): boolean {
  return false;
}
