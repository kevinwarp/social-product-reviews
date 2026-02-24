/**
 * Simple in-memory rate limiter (per-platform).
 * Tracks request timestamps and enforces a max requests per window.
 */
const requestLog: Record<string, number[]> = {};

export function checkRateLimit(
  platform: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const log = (requestLog[platform] ??= []);

  // Prune old entries
  requestLog[platform] = log.filter((t) => now - t < windowMs);

  if (requestLog[platform].length >= maxRequests) {
    return false; // rate limited
  }

  requestLog[platform].push(now);
  return true;
}

/**
 * Wait until rate limit clears for a platform.
 */
export async function waitForRateLimit(
  platform: string,
  maxRequests: number,
  windowMs: number
): Promise<void> {
  while (!checkRateLimit(platform, maxRequests, windowMs)) {
    await sleep(500);
  }
}

/**
 * Retry a function with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, onRetry } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      onRetry?.(attempt + 1, error);
      await sleep(baseDelayMs * Math.pow(2, attempt));
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error("withRetry: exhausted retries");
}

/**
 * Fetch with timeout support.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 10000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Safe JSON fetch: fetches URL, checks status, returns parsed JSON.
 */
export async function fetchJSON<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, options);

  if (!response.ok) {
    throw new RetrieverError(
      `HTTP ${response.status}: ${response.statusText}`,
      response.status
    );
  }

  return response.json() as Promise<T>;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Custom error for retriever failures.
 */
export class RetrieverError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public platform?: string
  ) {
    super(message);
    this.name = "RetrieverError";
  }
}

/**
 * Truncate text to a max length, adding ellipsis if needed.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
