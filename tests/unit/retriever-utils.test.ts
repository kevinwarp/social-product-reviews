import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkRateLimit,
  withRetry,
  truncate,
  RetrieverError,
  fetchWithTimeout,
} from "@/lib/retrievers/utils";

// ─── checkRateLimit ───────────────────────────────────────────────────────────

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Reset internal state by using a unique platform name per test
  });

  it("allows requests under the limit", () => {
    const platform = `test-${Date.now()}-1`;
    expect(checkRateLimit(platform, 3, 60_000)).toBe(true);
    expect(checkRateLimit(platform, 3, 60_000)).toBe(true);
    expect(checkRateLimit(platform, 3, 60_000)).toBe(true);
  });

  it("blocks requests over the limit", () => {
    const platform = `test-${Date.now()}-2`;
    checkRateLimit(platform, 2, 60_000);
    checkRateLimit(platform, 2, 60_000);
    expect(checkRateLimit(platform, 2, 60_000)).toBe(false);
  });

  it("allows requests after window expires", async () => {
    const platform = `test-${Date.now()}-3`;
    checkRateLimit(platform, 1, 50); // 50ms window
    expect(checkRateLimit(platform, 1, 50)).toBe(false);

    await new Promise((r) => setTimeout(r, 60));
    expect(checkRateLimit(platform, 1, 50)).toBe(true);
  });
});

// ─── withRetry ────────────────────────────────────────────────────────────────

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and eventually succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10 })
    ).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("calls onRetry callback on each retry", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    await withRetry(fn, { maxRetries: 2, baseDelayMs: 10, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });
});

// ─── truncate ─────────────────────────────────────────────────────────────────

describe("truncate", () => {
  it("returns text unchanged if under limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("returns text unchanged if exactly at limit", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates with ellipsis when over limit", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });

  it("handles empty string", () => {
    expect(truncate("", 10)).toBe("");
  });
});

// ─── RetrieverError ───────────────────────────────────────────────────────────

describe("RetrieverError", () => {
  it("contains statusCode and platform", () => {
    const err = new RetrieverError("not found", 404, "reddit");
    expect(err.message).toBe("not found");
    expect(err.statusCode).toBe(404);
    expect(err.platform).toBe("reddit");
    expect(err.name).toBe("RetrieverError");
    expect(err).toBeInstanceOf(Error);
  });
});

// ─── fetchWithTimeout ─────────────────────────────────────────────────────────

describe("fetchWithTimeout", () => {
  it("aborts after timeout", async () => {
    // Mock a slow fetch that respects AbortSignal
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, opts?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const timer = setTimeout(() => _resolve(new Response("ok")), 5000);
          opts?.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        })
      )
    );

    await expect(
      fetchWithTimeout("http://example.com", { timeoutMs: 50 })
    ).rejects.toThrow();

    vi.unstubAllGlobals();
  });

  it("returns response on success within timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("ok", { status: 200 })))
    );

    const res = await fetchWithTimeout("http://example.com", { timeoutMs: 1000 });
    expect(res.status).toBe(200);

    vi.unstubAllGlobals();
  });
});
