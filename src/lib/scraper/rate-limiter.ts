/**
 * Token Bucket Rate Limiter
 *
 * Implements per-domain rate limiting using the token bucket algorithm.
 * Each domain has its own bucket with configurable capacity and refill rate.
 */

interface TokenBucket {
  tokens: number;
  capacity: number;
  refillRate: number; // tokens per second
  lastRefill: number;
}

// Domain-specific rate limit configurations (requests per second)
const RATE_LIMITS: Record<string, { requestsPerSecond: number; burstCapacity: number }> = {
  "amazon.com": { requestsPerSecond: 0.5, burstCapacity: 2 }, // 1 req per 2s
  "sephora.com": { requestsPerSecond: 0.67, burstCapacity: 2 }, // 1 req per 1.5s
  "tiktok.com": { requestsPerSecond: 0.25, burstCapacity: 1 }, // 1 req per 4s (most aggressive)
  "youtube.com": { requestsPerSecond: 0.33, burstCapacity: 2 }, // 1 req per 3s
  "ewg.org": { requestsPerSecond: 0.5, burstCapacity: 2 }, // 1 req per 2s
  "reddit.com": { requestsPerSecond: 0.17, burstCapacity: 3 }, // ~10 per minute
};

const buckets = new Map<string, TokenBucket>();

/**
 * Get the domain from a URL.
 */
function getDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Extract base domain (e.g., "www.amazon.com" -> "amazon.com")
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      return parts.slice(-2).join(".");
    }
    return hostname;
  } catch {
    return "default";
  }
}

/**
 * Get or create a token bucket for a domain.
 */
function getBucket(domain: string): TokenBucket {
  if (!buckets.has(domain)) {
    const config = RATE_LIMITS[domain] || { requestsPerSecond: 1, burstCapacity: 5 };
    buckets.set(domain, {
      tokens: config.burstCapacity,
      capacity: config.burstCapacity,
      refillRate: config.requestsPerSecond,
      lastRefill: Date.now(),
    });
  }
  return buckets.get(domain)!;
}

/**
 * Refill tokens based on elapsed time.
 */
function refillBucket(bucket: TokenBucket): void {
  const now = Date.now();
  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  const tokensToAdd = elapsedSeconds * bucket.refillRate;

  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
}

/**
 * Try to consume a token from the bucket.
 * Returns true if successful, false if rate limited.
 */
function tryConsume(bucket: TokenBucket): boolean {
  refillBucket(bucket);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

/**
 * Calculate how long to wait until a token is available (in ms).
 */
function getWaitTime(bucket: TokenBucket): number {
  refillBucket(bucket);

  if (bucket.tokens >= 1) {
    return 0;
  }

  // Time to wait for 1 token = (1 - current tokens) / refill rate
  const tokensNeeded = 1 - bucket.tokens;
  const waitSeconds = tokensNeeded / bucket.refillRate;
  return Math.ceil(waitSeconds * 1000);
}

/**
 * Wait for rate limit to allow request.
 * Returns immediately if a token is available, otherwise waits.
 */
export async function waitForRateLimit(url: string): Promise<void> {
  const domain = getDomain(url);
  const bucket = getBucket(domain);

  // Fast path: token available
  if (tryConsume(bucket)) {
    return;
  }

  // Need to wait
  const waitMs = getWaitTime(bucket);
  console.log(`[RateLimit] Throttling ${domain} for ${waitMs}ms`);

  await new Promise((resolve) => setTimeout(resolve, waitMs));

  // Consume token after waiting
  refillBucket(bucket);
  bucket.tokens -= 1;
}

/**
 * Check if a request would be rate limited without consuming a token.
 */
export function wouldBeRateLimited(url: string): boolean {
  const domain = getDomain(url);
  const bucket = getBucket(domain);
  refillBucket(bucket);
  return bucket.tokens < 1;
}

/**
 * Get current rate limit status for a domain.
 */
export function getRateLimitStatus(url: string): {
  domain: string;
  availableTokens: number;
  capacity: number;
  refillRate: number;
  waitTimeMs: number;
} {
  const domain = getDomain(url);
  const bucket = getBucket(domain);
  refillBucket(bucket);

  return {
    domain,
    availableTokens: bucket.tokens,
    capacity: bucket.capacity,
    refillRate: bucket.refillRate,
    waitTimeMs: getWaitTime(bucket),
  };
}

/**
 * Reset rate limit for a specific domain (useful for testing).
 */
export function resetRateLimit(domain: string): void {
  buckets.delete(domain);
}

/**
 * Reset all rate limits.
 */
export function resetAllRateLimits(): void {
  buckets.clear();
}

/**
 * Configure custom rate limit for a domain.
 */
export function configureRateLimit(
  domain: string,
  requestsPerSecond: number,
  burstCapacity: number
): void {
  RATE_LIMITS[domain] = { requestsPerSecond, burstCapacity };
  resetRateLimit(domain); // Reset bucket to apply new config
}
