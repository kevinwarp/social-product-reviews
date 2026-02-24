import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerateJSON = vi.fn();

vi.mock("@/lib/gemini", () => ({
  generateJSON: (...args: unknown[]) => mockGenerateJSON(...args),
  generateText: vi.fn().mockResolvedValue(""),
}));

import { parseIntent } from "@/lib/pipeline/intent-parser";

describe("parseIntent", () => {
  beforeEach(() => {
    mockGenerateJSON.mockReset();
  });

  it("returns structured intent from Gemini response", async () => {
    mockGenerateJSON.mockResolvedValue({
      intent: {
        useCase: "sleeping with headphones",
        constraints: ["comfortable for side sleeping"],
        mustHaves: ["wireless"],
        niceToHaves: ["long battery life"],
      },
      seedTerms: [
        "headphones for sleeping",
        "sleep earbuds",
        "best earbuds for sleeping reddit",
        "headband headphones sleep",
        "low profile earbuds side sleeper",
      ],
      inferredCategory: "earbuds",
    });

    const result = await parseIntent("headphones good for sleeping");

    expect(result.intent.useCase).toBe("sleeping with headphones");
    expect(result.intent.constraints).toContain("comfortable for side sleeping");
    expect(result.intent.mustHaves).toContain("wireless");
    expect(result.seedTerms.length).toBeGreaterThanOrEqual(5);
    expect(result.inferredCategory).toBe("earbuds");
  });

  it("generates fallback seed terms when Gemini returns too few", async () => {
    mockGenerateJSON.mockResolvedValue({
      intent: {
        useCase: "sleeping",
        constraints: [],
        mustHaves: [],
        niceToHaves: [],
      },
      seedTerms: ["a", "b"], // Too few (< 5)
      inferredCategory: "headphones",
    });

    const result = await parseIntent("headphones for sleeping");

    // Should use fallback terms
    expect(result.seedTerms.length).toBeGreaterThanOrEqual(5);
    expect(result.seedTerms).toContain("headphones for sleeping");
    expect(result.seedTerms.some((t) => t.includes("reddit"))).toBe(true);
  });

  it("falls back gracefully when Gemini fails entirely", async () => {
    mockGenerateJSON.mockRejectedValue(new Error("API error"));

    const result = await parseIntent("best standing desk under 500");

    expect(result.intent.useCase).toBe("best standing desk under 500");
    expect(result.seedTerms.length).toBeGreaterThanOrEqual(5);
    expect(result.inferredCategory).toBe("general");
  });

  it("fills in missing intent fields with defaults", async () => {
    mockGenerateJSON.mockResolvedValue({
      seedTerms: [
        "term1", "term2", "term3", "term4", "term5",
      ],
      inferredCategory: "keyboards",
      // intent is missing
    });

    const result = await parseIntent("mechanical keyboard for programming");

    expect(result.intent).toBeDefined();
    expect(result.intent.useCase).toBe("mechanical keyboard for programming");
    expect(Array.isArray(result.intent.constraints)).toBe(true);
  });

  it("fills in missing inferredCategory with 'general'", async () => {
    mockGenerateJSON.mockResolvedValue({
      intent: {
        useCase: "test",
        constraints: [],
        mustHaves: [],
        niceToHaves: [],
      },
      seedTerms: ["t1", "t2", "t3", "t4", "t5"],
      // inferredCategory missing
    });

    const result = await parseIntent("some query");
    expect(result.inferredCategory).toBe("general");
  });
});
