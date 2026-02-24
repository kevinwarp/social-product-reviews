import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RetrievedMention } from "@/lib/types";

// Mock all external dependencies
const mockGenerateJSON = vi.fn();

vi.mock("@/lib/gemini", () => ({
  generateJSON: (...args: unknown[]) => mockGenerateJSON(...args),
  generateText: vi.fn().mockResolvedValue(""),
}));

vi.mock("@/lib/retrievers/reddit", () => ({
  retrieveRedditMentions: vi.fn().mockResolvedValue([
    {
      platform: "reddit" as const,
      url: "https://reddit.com/r/headphones/123",
      title: "Best sleep headphones",
      text: "I love the Sony WF-1000XM5 for sleeping. Also the Bose Sleepbuds II are great.",
    },
    {
      platform: "reddit" as const,
      url: "https://reddit.com/r/headphones/456",
      title: "Side sleeper earbuds",
      text: "The 1MORE ComfoBuds Z are amazing for side sleeping. Very low profile.",
    },
  ] satisfies RetrievedMention[]),
  suggestSubreddits: vi.fn().mockReturnValue(["headphones", "HeadphoneAdvice"]),
}));

vi.mock("@/lib/retrievers/web-search", () => ({
  retrieveWebMentions: vi.fn().mockResolvedValue([
    {
      platform: "web" as const,
      url: "https://example.com/review",
      title: "Best Sleep Earbuds 2025",
      text: "Top picks: Sony WF-1000XM5, Apple AirPods Pro 2, and Bose Sleepbuds II.",
    },
  ] satisfies RetrievedMention[]),
}));

vi.mock("@/lib/retrievers/tiktok", () => ({
  retrieveTikTokMentions: vi.fn().mockResolvedValue({
    mentions: [],
    available: false,
    reason: "TikTok retrieval not yet implemented",
  }),
}));

import { generateCandidates } from "@/lib/pipeline/candidate-generator";

describe("generateCandidates", () => {
  beforeEach(() => {
    mockGenerateJSON.mockReset();
    // Default: Gemini extracts products from mentions
    mockGenerateJSON.mockResolvedValue({
      products: [
        { brand: "Sony", model: "WF-1000XM5", category: "earbuds", sourceIndex: 0 },
        { brand: "Bose", model: "Sleepbuds II", category: "earbuds", sourceIndex: 0 },
        { brand: "1MORE", model: "ComfoBuds Z", category: "earbuds", sourceIndex: 1 },
        { brand: "Sony", model: "WF-1000XM5", category: "earbuds", sourceIndex: 2 },
        { brand: "Apple", model: "AirPods Pro 2", category: "earbuds", sourceIndex: 2 },
        { brand: "Bose", model: "Sleepbuds II", category: "earbuds", sourceIndex: 2 },
      ],
    });
  });

  it("aggregates mentions from all retrievers", async () => {
    const result = await generateCandidates(
      ["sleep earbuds", "headphones for sleeping"],
      {
        useCase: "sleeping",
        constraints: [],
        mustHaves: [],
        niceToHaves: [],
      },
      "earbuds"
    );

    expect(result.stats.totalMentions).toBeGreaterThan(0);
    expect(result.stats.redditMentions).toBe(2);
    expect(result.stats.webMentions).toBe(1);
    expect(result.stats.tiktokMentions).toBe(0);
    expect(result.mentions).toHaveLength(3);
  });

  it("extracts candidates via Gemini and deduplicates", async () => {
    const result = await generateCandidates(
      ["sleep earbuds"],
      {
        useCase: "sleeping",
        constraints: [],
        mustHaves: [],
        niceToHaves: [],
      },
      "earbuds"
    );

    // Should have 4 unique products (Sony appears twice → deduplicated)
    expect(result.candidates.length).toBe(4);

    // Sony should have mentionCount = 2
    const sony = result.candidates.find((c) => c.brand === "Sony");
    expect(sony).toBeDefined();
    expect(sony!.mentionCount).toBe(2);
  });

  it("sorts candidates by mention count descending", async () => {
    const result = await generateCandidates(
      ["sleep earbuds"],
      {
        useCase: "sleeping",
        constraints: [],
        mustHaves: [],
        niceToHaves: [],
      },
      "earbuds"
    );

    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].mentionCount).toBeGreaterThanOrEqual(
        result.candidates[i].mentionCount
      );
    }
  });

  it("returns empty candidates when no mentions found", async () => {
    // Override retrievers to return empty
    const reddit = await import("@/lib/retrievers/reddit");
    vi.mocked(reddit.retrieveRedditMentions).mockResolvedValueOnce([]);
    const web = await import("@/lib/retrievers/web-search");
    vi.mocked(web.retrieveWebMentions).mockResolvedValueOnce([]);

    const result = await generateCandidates(
      ["nonexistent product"],
      {
        useCase: "test",
        constraints: [],
        mustHaves: [],
        niceToHaves: [],
      },
      "general"
    );

    expect(result.candidates).toHaveLength(0);
    expect(result.stats.totalMentions).toBe(0);
  });

  it("handles Gemini extraction failure gracefully", async () => {
    mockGenerateJSON.mockRejectedValue(new Error("Gemini error"));

    const result = await generateCandidates(
      ["sleep earbuds"],
      {
        useCase: "sleeping",
        constraints: [],
        mustHaves: [],
        niceToHaves: [],
      },
      "earbuds"
    );

    // Should return empty candidates but not throw
    expect(result.candidates).toHaveLength(0);
    expect(result.mentions.length).toBeGreaterThan(0);
  });
});
