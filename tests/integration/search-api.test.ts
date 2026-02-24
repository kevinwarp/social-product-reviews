import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockQueryFindFirst = vi.fn();
const mockQueryCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    query: {
      findFirst: (...args: unknown[]) => mockQueryFindFirst(...args),
      create: (...args: unknown[]) => mockQueryCreate(...args),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/logger", () => ({
  logSearch: vi.fn().mockResolvedValue(undefined),
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/pipeline/orchestrator", () => ({
  runPipeline: vi.fn().mockResolvedValue({ success: true }),
}));

import { POST } from "@/app/api/search/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryFindFirst.mockResolvedValue(null); // No cached result
    mockQueryCreate.mockResolvedValue({ id: "new-query-1" });
  });

  it("returns 400 for empty query", async () => {
    const res = await POST(makeRequest({ query: "" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 for missing query field", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("creates a new query and returns queryId", async () => {
    const res = await POST(makeRequest({ query: "headphones for sleeping" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.queryId).toBe("new-query-1");
    expect(data.cached).toBe(false);
  });

  it("returns cached result when identical query exists", async () => {
    mockQueryFindFirst.mockResolvedValue({
      id: "cached-query-1",
      rawQuery: "headphones for sleeping",
      status: "COMPLETED",
      createdAt: new Date(),
    });

    const res = await POST(makeRequest({ query: "headphones for sleeping" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.queryId).toBe("cached-query-1");
    expect(data.cached).toBe(true);
  });

  it("fires pipeline in background for new queries", async () => {
    const { runPipeline } = await import("@/lib/pipeline/orchestrator");

    await POST(makeRequest({ query: "best standing desk" }));

    // runPipeline should have been called (fire-and-forget)
    expect(runPipeline).toHaveBeenCalledWith("new-query-1");
  });

  it("trims whitespace from query", async () => {
    await POST(makeRequest({ query: "  headphones for sleeping  " }));

    expect(mockQueryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rawQuery: "headphones for sleeping",
        }),
      })
    );
  });
});
