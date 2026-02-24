import * as cheerio from "cheerio";
import type { Page } from "playwright";
import { waitForRateLimit } from "./rate-limiter";
import { createPage, navigateWithRetry, humanDelay } from "./browser";

// ─── Scraping Utilities ───────────────────────────────────────────────────────

/**
 * Fetch and parse HTML from a URL.
 * Respects rate limits and includes retry logic.
 */
export async function fetchHTML(
  url: string,
  options?: {
    waitForSelector?: string;
    timeout?: number;
    skipRateLimit?: boolean;
  }
): Promise<cheerio.CheerioAPI | null> {
  const { waitForSelector, timeout = 15000, skipRateLimit = false } = options || {};

  // Rate limiting
  if (!skipRateLimit) {
    await waitForRateLimit(url);
  }

  let page: Page | null = null;

  try {
    page = await createPage();

    const success = await navigateWithRetry(page, url, {
      waitUntil: "domcontentloaded",
      maxRetries: 2,
    });

    if (!success) {
      return null;
    }

    // Wait for specific selector if provided
    if (waitForSelector) {
      try {
        await page.waitForSelector(waitForSelector, { timeout });
      } catch {
        console.warn(`[Scraper] Selector "${waitForSelector}" not found on ${url}`);
      }
    }

    // Add human-like delay
    await humanDelay(300, 800);

    // Get HTML content
    const html = await page.content();

    await page.close();

    return cheerio.load(html);
  } catch (error) {
    console.error(`[Scraper] Failed to fetch ${url}:`, error);
    if (page) {
      await page.close().catch(() => {});
    }
    return null;
  }
}

/**
 * Execute a function on a Playwright page with retry logic.
 */
export async function withPage<T>(
  url: string,
  callback: (page: Page, $: cheerio.CheerioAPI) => Promise<T>,
  options?: {
    waitForSelector?: string;
    timeout?: number;
    maxRetries?: number;
  }
): Promise<T | null> {
  const { waitForSelector, timeout = 15000, maxRetries = 2 } = options || {};

  await waitForRateLimit(url);

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    let page: Page | null = null;

    try {
      page = await createPage();

      const success = await navigateWithRetry(page, url, {
        waitUntil: "domcontentloaded",
        maxRetries: 1,
      });

      if (!success) {
        throw new Error(`Failed to navigate to ${url}`);
      }

      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout });
      }

      await humanDelay(300, 800);

      const html = await page.content();
      const $ = cheerio.load(html);

      const result = await callback(page, $);

      await page.close();

      return result;
    } catch (error) {
      console.warn(
        `[Scraper] Attempt ${attempt} failed for ${url}:`,
        error instanceof Error ? error.message : error
      );

      if (page) {
        await page.close().catch(() => {});
      }

      if (attempt === maxRetries + 1) {
        console.error(`[Scraper] All attempts exhausted for ${url}`);
        return null;
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  return null;
}

/**
 * Extract text content from an element, with fallback handling.
 */
export function extractText($: cheerio.CheerioAPI, selector: string): string {
  return $(selector).first().text().trim();
}

/**
 * Extract all matching text elements.
 */
export function extractAllText($: cheerio.CheerioAPI, selector: string): string[] {
  const texts: string[] = [];
  $(selector).each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      texts.push(text);
    }
  });
  return texts;
}

/**
 * Extract attribute from an element.
 */
export function extractAttr(
  $: cheerio.CheerioAPI,
  selector: string,
  attr: string
): string | undefined {
  return $(selector).first().attr(attr);
}

/**
 * Clean and normalize text (remove extra whitespace, newlines).
 */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Truncate text to a maximum length.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Parse a rating string (e.g., "4.5 out of 5 stars" -> 4.5).
 */
export function parseRating(ratingText: string): number | null {
  const match = ratingText.match(/(\d+\.?\d*)\s*(?:out of|\/)\s*(\d+)/);
  if (match) {
    const rating = parseFloat(match[1]);
    const max = parseFloat(match[2]);
    return (rating / max) * 5; // Normalize to 5-star scale
  }

  // Try to find just a number
  const numMatch = ratingText.match(/(\d+\.?\d*)/);
  if (numMatch) {
    return parseFloat(numMatch[1]);
  }

  return null;
}

/**
 * Extract a date from various formats.
 */
export function parseDate(dateText: string): Date | null {
  try {
    // Try direct parse
    const date = new Date(dateText);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Handle relative dates like "2 days ago"
    const relativeMatch = dateText.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();

      const now = new Date();
      switch (unit) {
        case "second":
          return new Date(now.getTime() - amount * 1000);
        case "minute":
          return new Date(now.getTime() - amount * 60 * 1000);
        case "hour":
          return new Date(now.getTime() - amount * 60 * 60 * 1000);
        case "day":
          return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
        case "week":
          return new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
        case "month":
          return new Date(now.getTime() - amount * 30 * 24 * 60 * 60 * 1000);
        case "year":
          return new Date(now.getTime() - amount * 365 * 24 * 60 * 60 * 1000);
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Retry a function with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  }
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    onRetry,
  } = options || {};

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries + 1) {
        throw error;
      }

      if (onRetry) {
        onRetry(attempt, error);
      }

      const delayMs = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      console.log(`[Retry] Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Unreachable");
}

/**
 * Circuit breaker for failing sources.
 * Tracks failures and temporarily disables sources after threshold.
 */
class CircuitBreaker {
  private failures = new Map<string, { count: number; lastFailure: number }>();
  private readonly threshold = 5;
  private readonly resetTimeMs = 5 * 60 * 1000; // 5 minutes

  recordFailure(source: string): void {
    const now = Date.now();
    const record = this.failures.get(source) || { count: 0, lastFailure: now };

    // Reset if last failure was too long ago
    if (now - record.lastFailure > this.resetTimeMs) {
      record.count = 1;
    } else {
      record.count += 1;
    }

    record.lastFailure = now;
    this.failures.set(source, record);

    if (record.count >= this.threshold) {
      console.warn(`[CircuitBreaker] Source ${source} disabled after ${record.count} failures`);
    }
  }

  recordSuccess(source: string): void {
    this.failures.delete(source);
  }

  isDisabled(source: string): boolean {
    const record = this.failures.get(source);
    if (!record) {
      return false;
    }

    // Auto-reset after timeout
    const now = Date.now();
    if (now - record.lastFailure > this.resetTimeMs) {
      this.failures.delete(source);
      return false;
    }

    return record.count >= this.threshold;
  }

  getStatus(source: string): { failures: number; disabled: boolean } {
    const record = this.failures.get(source);
    return {
      failures: record?.count || 0,
      disabled: this.isDisabled(source),
    };
  }
}

export const circuitBreaker = new CircuitBreaker();
