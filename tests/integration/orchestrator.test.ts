import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock all dependencies ────────────────────────────────────────────────────

const mockQueryFindUnique = vi.fn();
const mockQueryUpdate = vi.fn();
const mockQueryFindFirst = vi.fn();
const mockProductUpsert = vi.fn();
const mockSourceCreate = vi.fn();
const mockEvidenceCreate = vi.fn();
const mockRankingResultCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    query: {
      findUnique: (...args: unknown[]) => mockQueryFindUnique(...args),
      update: (...args: unknown[]) => mockQueryUpdate(...args),
      findFirst: (...args: unknown[]) => mockQueryFindFirst(...args),
    },
    product: {
      upsert: (...args: unknown[]) => mockProductUpsert(...args),
    },
    source: {
      create: (...args: unknown[]) => mockSourceCreate(...args),
    },
    evidence: {
      create: (...args: unknown[]) => mockEvidenceCreate(...args),
    },
    rankingResult: {
      create: (...args: unknown[]) => mockRankingResultCreate(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logSearch: vi.fn().mockResolvedValue(undefined),
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/pipeline/intent-parser", () => ({
  parseIntent: vi.fn().mockResolvedValue({
    intent: {
      useCase: "sleeping",
      constraints: ["comfortable"],
      mustHaves: ["wireless"],
      niceToHaves: [],
    },
    seedTerms: ["sleep earbuds", "headphones for sleeping"],
    inferredCategory: "earbuds",
  }),
}));

vi.mock("@/lib/pipeline/candidate-generator", () => ({
  generateCandidates: vi.fn().mockResolvedValue({
    candidates: [
      { brand: "Sony", model: "WF-1000XM5", category: "earbuds", mentionCount: 5, sources: ["s1"] },
      { brand: "Bose", model: "Sleepbuds II", category: "earbuds", mentionCount: 3, sources: ["s2"] },
    ],
    mentions: [
      { platform: "reddit", url: "https://reddit.com/1", text: "Great product" },
    ],
    stats: { totalMentions: 1, redditMentions: 1, webMentions: 0, tiktokMentions: 0, uniqueCandidates: 2 },
  }),
}));

vi.mock("@/lib/pipeline/entity-resolver", () => ({
  resolveEntities: vi.fn().mockImplementation((candidates) => Promise.resolve(candidates)),
}));

vi.mock("@/lib/pipeline/evidence-extractor", () => ({
  extractEvidence: vi.fn().mockResolvedValue(
    new Map([
      ["Sony|WF-1000XM5", [
        {
          productRef: "Sony WF-1000XM5",
          sentiment: "positive",
          themes: ["comfort"],
          claimTags: ["wireless"],
          quote: "Great for sleeping",
          sourceUrl: "https://reddit.com/1",
          platform: "reddit",
        },
      ]],
      ["Bose|Sleepbuds II", []],
    ])
  ),
}));

vi.mock("@/lib/pipeline/ranker", () => ({
  rankCandidates: vi.fn().mockResolvedValue({
    rankedProducts: [
      {
        productId: "",
        rank: 1,
        scores: { queryFit: 80, redditEndorsement: 70, socialProofCoverage: 60, riskScore: 85, confidenceScore: 75, overall: 74 },
        rationale: "Top pick for sleeping.",
        citations: [{ sourceId: "", url: "https://reddit.com/1", platform: "reddit", capturedAt: new Date().toISOString() }],
      },
    ],
    candidateCount: 2,
  }),
}));

import { runPipeline } from "@/lib/pipeline/orchestrator";

describe("runPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockQueryFindUnique.mockResolvedValue({
      id: "query-1",
      rawQuery: "headphones for sleeping",
      status: "PENDING",
      userId: "user-1",
    });

    mockQueryUpdate.mockResolvedValue({});
    mockProductUpsert.mockResolvedValue({ id: "prod-1" });
    mockSourceCreate.mockResolvedValue({ id: "src-1" });
    mockEvidenceCreate.mockResolvedValue({});
    mockRankingResultCreate.mockResolvedValue({});
  });

  it("completes successfully with valid query", async () => {
    const result = await runPipeline("query-1");

    expect(result.success).toBe(true);
    expect(result.queryId).toBe("query-1");
    expect(result.candidateCount).toBe(2);
    expect(result.top10Count).toBe(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("transitions status: PENDING → PROCESSING → COMPLETED", async () => {
    await runPipeline("query-1");

    // First update: PROCESSING
    expect(mockQueryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "query-1" },
        data: expect.objectContaining({ status: "PROCESSING" }),
      })
    );

    // Last update: COMPLETED
    const lastCall = mockQueryUpdate.mock.calls[mockQueryUpdate.mock.calls.length - 1];
    expect(lastCall[0].data.status).toBe("COMPLETED");
  });

  it("persists products, sources, evidence, and rankings", async () => {
    await runPipeline("query-1");

    expect(mockProductUpsert).toHaveBeenCalled();
    expect(mockSourceCreate).toHaveBeenCalled();
    expect(mockRankingResultCreate).toHaveBeenCalled();
  });

  it("handles query not found", async () => {
    mockQueryFindUnique.mockResolvedValue(null);

    const result = await runPipeline("nonexistent");

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("sets status to FAILED on pipeline error", async () => {
    // Make intent parser throw
    const parser = await import("@/lib/pipeline/intent-parser");
    vi.mocked(parser.parseIntent).mockRejectedValueOnce(new Error("Gemini down"));

    const result = await runPipeline("query-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Gemini down");

    // Should have tried to set FAILED status
    const failedCall = mockQueryUpdate.mock.calls.find(
      (call) => call[0]?.data?.status === "FAILED"
    );
    expect(failedCall).toBeDefined();
  });

  it("handles empty candidate set gracefully", async () => {
    const gen = await import("@/lib/pipeline/candidate-generator");
    vi.mocked(gen.generateCandidates).mockResolvedValueOnce({
      candidates: [],
      mentions: [],
      ingredientTexts: new Map(),
      stats: { totalMentions: 0, redditMentions: 0, webMentions: 0, tiktokMentions: 0, amazonMentions: 0, sephoraMentions: 0, uniqueCandidates: 0 },
    });

    const result = await runPipeline("query-1");

    expect(result.success).toBe(true);
    expect(result.candidateCount).toBe(0);
    expect(result.top10Count).toBe(0);
  });
});
