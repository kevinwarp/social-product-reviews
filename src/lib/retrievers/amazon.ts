import type { RetrievedMention } from "@/lib/types";
import { withPage, extractText, extractAttr, parseRating, parseDate, cleanText, truncate, circuitBreaker } from "@/lib/scraper/utils";
import type { Page } from "playwright";
import type * as cheerio from "cheerio";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AmazonReview {
  rating: number;
  title: string;
  text: string;
  verifiedPurchase: boolean;
  helpful: number;
  date: string;
  author: string;
  url: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search Amazon for skincare products and scrape reviews.
 */
export async function retrieveAmazonReviews(
  searchTerms: string[],
  options?: {
    maxProductsPerTerm?: number;
    maxReviewsPerProduct?: number;
  }
): Promise<RetrievedMention[]> {
  if (circuitBreaker.isDisabled("amazon")) {
    console.log("[Amazon] Circuit breaker triggered - skipping");
    return [];
  }

  const { maxProductsPerTerm = 3, maxReviewsPerProduct = 30 } = options || {};
  const mentions: RetrievedMention[] = [];

  for (const term of searchTerms) {
    try {
      // Search for products
      const productUrls = await searchProducts(term, maxProductsPerTerm);

      // Scrape reviews for each product
      for (const productUrl of productUrls) {
        try {
          const reviews = await scrapeProductReviews(productUrl, maxReviewsPerProduct);
          mentions.push(...reviewsToMentions(reviews, productUrl));
        } catch (error) {
          console.warn(`[Amazon] Failed to scrape ${productUrl}:`, error);
        }
      }

      circuitBreaker.recordSuccess("amazon");
    } catch (error) {
      console.error(`[Amazon] Search failed for "${term}":`, error);
      circuitBreaker.recordFailure("amazon");
    }
  }

  console.log(`[Amazon] Retrieved ${mentions.length} reviews`);
  return mentions;
}

/**
 * Scrape reviews for a specific Amazon product URL.
 */
export async function scrapeProductReviews(
  productUrl: string,
  maxReviews: number = 30
): Promise<AmazonReview[]> {
  const asin = extractASIN(productUrl);
  if (!asin) {
    throw new Error(`Could not extract ASIN from ${productUrl}`);
  }

  // Navigate to reviews page (easier to parse than product page)
  const reviewsUrl = `https://www.amazon.com/product-reviews/${asin}/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews`;

  const reviews: AmazonReview[] = [];

  // Scrape first few pages of reviews
  const pagesToScrape = Math.ceil(maxReviews / 10); // ~10 reviews per page
  for (let page = 1; page <= Math.min(pagesToScrape, 3); page++) {
    const pageUrl = page === 1 ? reviewsUrl : `${reviewsUrl}&pageNumber=${page}`;

    const pageReviews = await withPage<AmazonReview[]>(
      pageUrl,
      async (playwrightPage, $) => {
        return await extractReviewsFromPage(playwrightPage, $, asin);
      },
      {
        waitForSelector: "[data-hook='review']",
        timeout: 10000,
        maxRetries: 2,
      }
    );

    if (!pageReviews || pageReviews.length === 0) {
      break; // No more reviews
    }

    reviews.push(...pageReviews);

    if (reviews.length >= maxReviews) {
      break;
    }
  }

  return reviews.slice(0, maxReviews);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Search Amazon for products matching the query.
 * Returns product detail page URLs.
 */
async function searchProducts(
  query: string,
  maxProducts: number = 3
): Promise<string[]> {
  const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}&i=beauty-intl-ship`;

  const productUrls = await withPage<string[]>(
    searchUrl,
    async (_, $) => {
      const urls: string[] = [];

      // Extract product links from search results
      $("[data-component-type='s-search-result'] h2 a").each((_, el) => {
        const href = $(el).attr("href");
        if (href && href.includes("/dp/")) {
          const fullUrl = href.startsWith("http") ? href : `https://www.amazon.com${href}`;
          urls.push(fullUrl);
        }
      });

      return urls.slice(0, maxProducts);
    },
    {
      waitForSelector: "[data-component-type='s-search-result']",
      timeout: 10000,
    }
  );

  return productUrls || [];
}

/**
 * Extract reviews from a reviews page.
 */
async function extractReviewsFromPage(
  page: Page,
  $: cheerio.CheerioAPI,
  asin: string
): Promise<AmazonReview[]> {
  const reviews: AmazonReview[] = [];

  $("[data-hook='review']").each((_, reviewEl) => {
    try {
      const $review = $(reviewEl);

      // Rating
      const ratingText = $review.find("[data-hook='review-star-rating']").first().text();
      const rating = parseRating(ratingText) || 0;

      // Title
      const title = $review.find("[data-hook='review-title'] span").last().text().trim();

      // Review body
      const text = $review.find("[data-hook='review-body'] span").text().trim();

      // Verified purchase
      const verifiedPurchase = $review.find("[data-hook='avp-badge']").length > 0;

      // Helpful count
      const helpfulText = $review.find("[data-hook='helpful-vote-statement']").text();
      const helpfulMatch = helpfulText.match(/(\d+)/);
      const helpful = helpfulMatch ? parseInt(helpfulMatch[1]) : 0;

      // Date
      const dateText = $review.find("[data-hook='review-date']").text();
      const dateMatch = dateText.match(/on (.+)$/);
      const date = dateMatch ? dateMatch[1] : dateText;

      // Author
      const author = $review.find(".a-profile-name").first().text().trim();

      // Review URL
      const reviewId = $review.attr("id");
      const url = `https://www.amazon.com/gp/customer-reviews/${reviewId}/ref=cm_cr_arp_d_rvw_ttl?ie=UTF8&ASIN=${asin}`;

      if (text && text.length > 20) {
        reviews.push({
          rating,
          title,
          text: cleanText(text),
          verifiedPurchase,
          helpful,
          date,
          author,
          url,
        });
      }
    } catch (error) {
      console.warn("[Amazon] Failed to parse review:", error);
    }
  });

  return reviews;
}

/**
 * Extract ASIN (Amazon Standard Identification Number) from product URL.
 */
function extractASIN(url: string): string | null {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/);
  return match ? match[1] : null;
}

/**
 * Convert Amazon reviews to RetrievedMention format.
 */
function reviewsToMentions(
  reviews: AmazonReview[],
  productUrl: string
): RetrievedMention[] {
  return reviews.map((review) => ({
    platform: "amazon" as const,
    url: review.url,
    title: review.title,
    authorHandle: review.author,
    createdAt: parseDate(review.date)?.toISOString(),
    text: truncate(review.text, 1500),
  }));
}
