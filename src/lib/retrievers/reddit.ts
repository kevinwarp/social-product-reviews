import type { RedditThread, RedditComment, RetrievedMention } from "@/lib/types";
import { fetchJSON, waitForRateLimit, withRetry, truncate } from "./utils";

// Reddit public API rate limit: ~10 requests per minute to be safe
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const USER_AGENT = "SocialProductReviews/1.0 (research bot)";

// ─── Reddit JSON API Types ────────────────────────────────────────────────────

interface RedditListing {
  kind: "Listing";
  data: {
    children: RedditThing[];
    after: string | null;
  };
}

interface RedditThing {
  kind: "t1" | "t3"; // t3 = post, t1 = comment
  data: Record<string, unknown>;
}

// ─── Public API Functions ─────────────────────────────────────────────────────

/**
 * Search Reddit for threads matching a query.
 * Uses the public search JSON endpoint.
 */
export async function searchReddit(
  query: string,
  options: {
    subreddits?: string[];
    sort?: "relevance" | "hot" | "top" | "new" | "comments";
    timeFilter?: "hour" | "day" | "week" | "month" | "year" | "all";
    limit?: number;
  } = {}
): Promise<RedditThread[]> {
  const {
    subreddits = [],
    sort = "relevance",
    timeFilter = "year",
    limit = 25,
  } = options;

  const threads: RedditThread[] = [];

  // If specific subreddits, search each; otherwise search all of Reddit
  const searchPaths =
    subreddits.length > 0
      ? subreddits.map((s) => `/r/${s}/search.json`)
      : ["/search.json"];

  for (const path of searchPaths) {
    await waitForRateLimit("reddit", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

    const params = new URLSearchParams({
      q: query,
      sort,
      t: timeFilter,
      limit: String(Math.min(limit, 100)),
      restrict_sr: subreddits.length > 0 ? "true" : "false",
      type: "link",
    });

    try {
      const listing = await withRetry(
        () =>
          fetchJSON<RedditListing>(`https://www.reddit.com${path}?${params}`, {
            headers: { "User-Agent": USER_AGENT },
            timeoutMs: 15000,
          }),
        {
          maxRetries: 2,
          onRetry: (attempt, err) =>
            console.warn(`Reddit search retry ${attempt}:`, err),
        }
      );

      for (const thing of listing.data.children) {
        if (thing.kind === "t3") {
          const d = thing.data;
          threads.push({
            id: d["id"] as string,
            subreddit: d["subreddit"] as string,
            title: d["title"] as string,
            url: `https://www.reddit.com${d["permalink"] as string}`,
            score: d["score"] as number,
            numComments: d["num_comments"] as number,
            createdUtc: d["created_utc"] as number,
            selfText: (d["selftext"] as string) ?? "",
            comments: [],
          });
        }
      }
    } catch (error) {
      console.error(`Reddit search failed for path ${path}:`, error);
      // Continue with other subreddits
    }
  }

  return threads;
}

/**
 * Fetch comments for a specific Reddit thread.
 * Returns the thread with its top-level + nested comments populated.
 */
export async function fetchThreadComments(
  thread: RedditThread,
  options: { maxComments?: number } = {}
): Promise<RedditThread> {
  const { maxComments = 50 } = options;

  await waitForRateLimit("reddit", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  try {
    // Reddit thread JSON returns [post_listing, comments_listing]
    const url = `${thread.url}.json?limit=${maxComments}&sort=top`;
    const data = await withRetry(
      () =>
        fetchJSON<RedditListing[]>(url, {
          headers: { "User-Agent": USER_AGENT },
          timeoutMs: 15000,
        }),
      { maxRetries: 2 }
    );

    if (data.length >= 2) {
      const commentsListing = data[1];
      thread.comments = extractComments(commentsListing, maxComments);
    }
  } catch (error) {
    console.error(`Failed to fetch comments for ${thread.url}:`, error);
  }

  return thread;
}

/**
 * Full pipeline: search Reddit for a query, fetch comments for top threads.
 */
export async function retrieveRedditMentions(
  searchTerms: string[],
  options: {
    relevantSubreddits?: string[];
    maxThreadsPerTerm?: number;
    maxCommentsPerThread?: number;
  } = {}
): Promise<RetrievedMention[]> {
  const {
    relevantSubreddits = [],
    maxThreadsPerTerm = 10,
    maxCommentsPerThread = 30,
  } = options;

  const allThreads: RedditThread[] = [];

  // Search for each term
  for (const term of searchTerms) {
    const threads = await searchReddit(term, {
      subreddits: relevantSubreddits,
      sort: "relevance",
      timeFilter: "year",
      limit: maxThreadsPerTerm,
    });
    allThreads.push(...threads);
  }

  // Deduplicate threads by ID
  const uniqueThreads = dedupeThreads(allThreads);

  // Fetch comments for top threads (by score)
  const sortedThreads = uniqueThreads
    .sort((a, b) => b.score - a.score)
    .slice(0, 30); // Cap at 30 threads to avoid excessive API calls

  const threadsWithComments: RedditThread[] = [];
  for (const thread of sortedThreads) {
    const enriched = await fetchThreadComments(thread, {
      maxComments: maxCommentsPerThread,
    });
    threadsWithComments.push(enriched);
  }

  // Convert to RetrievedMention format
  return threadsToMentions(threadsWithComments);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function extractComments(
  listing: RedditListing,
  maxComments: number
): RedditComment[] {
  const comments: RedditComment[] = [];

  function walk(things: RedditThing[]) {
    for (const thing of things) {
      if (comments.length >= maxComments) return;
      if (thing.kind !== "t1") continue;

      const d = thing.data;
      const body = (d["body"] as string) ?? "";

      // Skip deleted/removed/bot comments
      if (
        !body ||
        body === "[deleted]" ||
        body === "[removed]" ||
        (d["author"] as string) === "AutoModerator"
      ) {
        continue;
      }

      comments.push({
        id: d["id"] as string,
        author: d["author"] as string,
        body,
        score: (d["score"] as number) ?? 0,
        createdUtc: (d["created_utc"] as number) ?? 0,
      });

      // Recurse into replies
      const replies = d["replies"];
      if (replies && typeof replies === "object" && (replies as Record<string, unknown>)["kind"] === "Listing") {
        const replyListing = replies as RedditListing;
        walk(replyListing.data.children);
      }
    }
  }

  walk(listing.data.children);
  return comments;
}

function dedupeThreads(threads: RedditThread[]): RedditThread[] {
  const seen = new Set<string>();
  return threads.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

function threadsToMentions(threads: RedditThread[]): RetrievedMention[] {
  const mentions: RetrievedMention[] = [];

  for (const thread of threads) {
    // Thread self-text as a mention
    if (thread.selfText && thread.selfText.length > 20) {
      mentions.push({
        platform: "reddit",
        url: thread.url,
        title: thread.title,
        createdAt: new Date(thread.createdUtc * 1000).toISOString(),
        text: truncate(thread.selfText, 2000),
      });
    }

    // Each substantive comment as a mention
    for (const comment of thread.comments) {
      if (comment.body.length < 30) continue; // Skip very short comments

      mentions.push({
        platform: "reddit",
        url: `${thread.url}${comment.id}`,
        title: thread.title,
        authorHandle: comment.author,
        createdAt: new Date(comment.createdUtc * 1000).toISOString(),
        text: truncate(comment.body, 1500),
      });
    }
  }

  return mentions;
}

/**
 * Suggest relevant subreddits for a product category.
 */
export function suggestSubreddits(category: string): string[] {
  const categoryMap: Record<string, string[]> = {
    headphones: ["headphones", "HeadphoneAdvice", "audiophile", "budgetaudiophile"],
    earbuds: ["headphones", "HeadphoneAdvice", "earbuds"],
    keyboards: ["MechanicalKeyboards", "keyboards", "BudgetKeebs"],
    mice: ["MouseReview", "pcgaming"],
    monitors: ["Monitors", "ultrawidemasterrace", "buildapc"],
    laptops: ["laptops", "SuggestALaptop", "GamingLaptops"],
    phones: ["Android", "iphone", "smartphones"],
    cameras: ["photography", "Cameras", "videography"],
    speakers: ["BudgetAudiophile", "audiophile", "hometheater"],
    desks: ["standingdesk", "WFH", "battlestations"],
    chairs: ["OfficeChairs", "officechairs", "WFH"],
    shoes: ["RunningShoeGeeks", "Sneakers", "BarefootRunning"],
    mattresses: ["Mattress", "sleep"],
    skincare: ["SkincareAddiction", "AsianBeauty"],
    supplements: ["Supplements", "Nootropics"],
  };

  const lower = category.toLowerCase();
  for (const [key, subs] of Object.entries(categoryMap)) {
    if (lower.includes(key)) return subs;
  }

  // Fallback: generic product subreddits
  return ["BuyItForLife", "goodvalue", "ProductReviews"];
}
