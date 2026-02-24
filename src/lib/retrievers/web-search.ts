import type { RetrievedMention } from "@/lib/types";
import { fetchJSON, waitForRateLimit, withRetry, truncate } from "./utils";

// SerpAPI rate limit
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

// ─── SerpAPI Response Types ───────────────────────────────────────────────────

interface SerpAPIResponse {
  organic_results?: SerpAPIResult[];
  search_metadata?: {
    id: string;
    status: string;
    total_time_taken: number;
  };
}

interface SerpAPIResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
  displayed_link: string;
  date?: string;
  source?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search the web for product-related content using SerpAPI.
 * Returns mentions extracted from search result snippets.
 */
export async function searchWeb(
  query: string,
  options: {
    num?: number;
    searchType?: "general" | "review" | "reddit" | "forum";
  } = {}
): Promise<RetrievedMention[]> {
  const { num = 20, searchType = "general" } = options;

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    console.warn("SERPAPI_API_KEY not set — web search skipped");
    return [];
  }

  // Modify query based on search type for better results
  const modifiedQuery = buildQuery(query, searchType);

  await waitForRateLimit("serpapi", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  try {
    const params = new URLSearchParams({
      q: modifiedQuery,
      api_key: apiKey,
      engine: "google",
      num: String(num),
      gl: "us",
      hl: "en",
    });

    const data = await withRetry(
      () =>
        fetchJSON<SerpAPIResponse>(
          `https://serpapi.com/search.json?${params}`,
          { timeoutMs: 20000 }
        ),
      {
        maxRetries: 2,
        onRetry: (attempt, err) =>
          console.warn(`SerpAPI retry ${attempt}:`, err),
      }
    );

    return (data.organic_results ?? []).map((result) =>
      resultToMention(result)
    );
  } catch (error) {
    console.error("Web search failed:", error);
    return [];
  }
}

/**
 * Full pipeline: perform multiple targeted web searches for product discovery.
 * Runs general, review-focused, and forum-focused searches.
 */
export async function retrieveWebMentions(
  searchTerms: string[],
  options: { maxResultsPerSearch?: number } = {}
): Promise<RetrievedMention[]> {
  const { maxResultsPerSearch = 15 } = options;
  const allMentions: RetrievedMention[] = [];

  // Use first 3 terms with diverse search types for broad coverage
  const primaryTerms = searchTerms.slice(0, 3);
  const searchTypes: Array<"review" | "reddit" | "general" | "forum"> = [
    "review",
    "reddit",
    "general",
  ];

  for (const term of primaryTerms) {
    for (const searchType of searchTypes) {
      const mentions = await searchWeb(term, {
        num: maxResultsPerSearch,
        searchType,
      });
      allMentions.push(...mentions);
    }
  }

  // Additional forum/Amazon searches with remaining terms
  for (const term of searchTerms.slice(3, 5)) {
    const mentions = await searchWeb(term, {
      num: maxResultsPerSearch,
      searchType: "forum",
    });
    allMentions.push(...mentions);
  }

  // Deduplicate by URL
  return dedupeByUrl(allMentions);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function buildQuery(
  baseQuery: string,
  searchType: "general" | "review" | "reddit" | "forum"
): string {
  switch (searchType) {
    case "review":
      return `${baseQuery} best review roundup ${new Date().getFullYear()}`;
    case "reddit":
      return `site:reddit.com ${baseQuery}`;
    case "forum":
      return `${baseQuery} forum recommendation discussion`;
    case "general":
    default:
      return baseQuery;
  }
}

function resultToMention(result: SerpAPIResult): RetrievedMention {
  // Detect platform from URL
  let platform: RetrievedMention["platform"] = "web";
  if (result.link.includes("reddit.com")) platform = "reddit";
  else if (result.link.includes("tiktok.com")) platform = "tiktok";
  else if (result.link.includes("trustpilot.com")) platform = "trustpilot";
  else if (result.link.includes("amazon.com")) platform = "amazon";
  else if (result.link.includes("sephora.com")) platform = "sephora";

  return {
    platform,
    url: result.link,
    title: result.title,
    text: truncate(result.snippet ?? "", 500),
    createdAt: result.date,
  };
}

function dedupeByUrl(mentions: RetrievedMention[]): RetrievedMention[] {
  const seen = new Set<string>();
  return mentions.filter((m) => {
    // Normalize URL
    const key = m.url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
