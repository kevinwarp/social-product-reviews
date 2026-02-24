import type { RetrievedMention } from "@/lib/types";
import { withPage, extractText, extractAllText, parseRating, parseDate, cleanText, truncate, circuitBreaker } from "@/lib/scraper/utils";
import type { Page } from "playwright";
import type * as cheerio from "cheerio";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SephoraProduct {
  productId: string;
  name: string;
  brand: string;
  url: string;
  rating: number;
  reviewCount: number;
  ingredients: string[];
  price?: string;
}

interface SephoraReview {
  rating: number;
  title: string;
  text: string;
  helpful: number;
  date: string;
  author: string;
  verifiedPurchase: boolean;
  skinType?: string;
  url: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search Sephora for skincare products and scrape reviews + ingredients.
 */
export async function retrieveSephoraReviews(
  searchTerms: string[],
  options?: {
    maxProductsPerTerm?: number;
    maxReviewsPerProduct?: number;
  }
): Promise<RetrievedMention[]> {
  if (circuitBreaker.isDisabled("sephora")) {
    console.log("[Sephora] Circuit breaker triggered - skipping");
    return [];
  }

  const { maxProductsPerTerm = 3, maxReviewsPerProduct = 30 } = options || {};
  const mentions: RetrievedMention[] = [];

  for (const term of searchTerms) {
    try {
      // Search for products
      const products = await searchProducts(term, maxProductsPerTerm);

      // Scrape reviews + ingredients for each product
      for (const product of products) {
        try {
          const reviews = await scrapeProductReviews(product.url, maxReviewsPerProduct);
          mentions.push(...reviewsToMentions(reviews, product));

          // Also add ingredient list as a "mention" for analysis
          if (product.ingredients.length > 0) {
            mentions.push({
              platform: "sephora",
              url: product.url,
              title: `${product.brand} ${product.name} - Ingredients`,
              text: `Ingredient List: ${product.ingredients.join(", ")}`,
              createdAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.warn(`[Sephora] Failed to scrape ${product.url}:`, error);
        }
      }

      circuitBreaker.recordSuccess("sephora");
    } catch (error) {
      console.error(`[Sephora] Search failed for "${term}":`, error);
      circuitBreaker.recordFailure("sephora");
    }
  }

  console.log(`[Sephora] Retrieved ${mentions.length} mentions (reviews + ingredients)`);
  return mentions;
}

/**
 * Extract product details and ingredients from a Sephora product page.
 */
export async function scrapeProductDetails(productUrl: string): Promise<SephoraProduct | null> {
  return await withPage<SephoraProduct>(
    productUrl,
    async (page, $) => {
      // Product name and brand
      const name = cleanText($("h1[data-at='product_name']").text() || $("h1.css-1jv76w2").text());
      const brand = cleanText($("[data-at='brand_name']").text() || $("a[data-at='brand_name']").text());

      // Rating and review count
      const ratingText = $("[data-at='number_of_stars']").attr("aria-label") || "";
      const rating = parseRating(ratingText) || 0;

      const reviewCountText = $("[data-at='number_of_reviews']").text();
      const reviewCountMatch = reviewCountText.match(/(\\d+)/);
      const reviewCount = reviewCountMatch ? parseInt(reviewCountMatch[1]) : 0;

      // Ingredients - multiple selectors to try
      const ingredients: string[] = [];

      // Try clicking ingredients accordion/tab (Sephora uses dynamic loading)
      try {
        const ingredientsButton = page.locator("button:has-text('Ingredients')").first();
        if (await ingredientsButton.isVisible({ timeout: 3000 })) {
          await ingredientsButton.click();
          await page.waitForTimeout(1000);

          // Re-load HTML after click
          const updatedHtml = await page.content();
          const $updated = await import("cheerio").then((ch) => ch.load(updatedHtml));

          // Extract ingredients from various possible selectors
          const ingredientText =
            $updated("[data-at='ingredient_list']").text() ||
            $updated(".css-ingredient-list").text() ||
            $updated("div:has(> div:contains('Ingredients'))").next().text();

          if (ingredientText) {
            // Split by commas or periods, clean up
            const parsed = ingredientText
              .split(/[,.]/)
              .map((ing) => cleanText(ing))
              .filter((ing) => ing.length > 0 && ing.length < 100);

            ingredients.push(...parsed);
          }
        }
      } catch {
        // Ingredient extraction failed, continue without
      }

      // Product ID from URL
      const productIdMatch = productUrl.match(/P(\\d+)/);
      const productId = productIdMatch ? productIdMatch[1] : "";

      // Price
      const price = cleanText($("[data-at='price']").first().text());

      return {
        productId,
        name,
        brand,
        url: productUrl,
        rating,
        reviewCount,
        ingredients,
        price,
      };
    },
    {
      waitForSelector: "h1[data-at='product_name'], h1.css-1jv76w2",
      timeout: 15000,
      maxRetries: 2,
    }
  );
}

/**
 * Scrape reviews for a specific Sephora product.
 */
export async function scrapeProductReviews(
  productUrl: string,
  maxReviews: number = 30
): Promise<SephoraReview[]> {
  // First get product details for context
  const product = await scrapeProductDetails(productUrl);
  if (!product) {
    return [];
  }

  // Navigate to reviews section (reviews are paginated)
  const reviews: SephoraReview[] = [];

  const result = await withPage<SephoraReview[]>(
    productUrl,
    async (page, $) => {
      const pageReviews: SephoraReview[] = [];

      try {
        // Scroll to reviews section and click "See all reviews" if present
        const reviewsButton = page.locator("button:has-text('reviews'), a:has-text('reviews')").first();
        if (await reviewsButton.isVisible({ timeout: 5000 })) {
          await reviewsButton.scrollIntoViewIfNeeded();
          await reviewsButton.click();
          await page.waitForTimeout(2000);
        }

        // Load updated HTML
        const reviewsHtml = await page.content();
        const $reviews = await import("cheerio").then((ch) => ch.load(reviewsHtml));

        // Extract reviews
        $reviews("[data-comp='ReviewCard'], .css-review-card").each((idx, reviewEl) => {
          if (idx >= maxReviews) return;

          try {
            const $review = $reviews(reviewEl);

            // Rating
            const ratingAttr = $review.find("[data-at='star_rating']").attr("aria-label") || "";
            const rating = parseRating(ratingAttr) || 0;

            // Title
            const title = cleanText($review.find("[data-at='review_title']").text());

            // Text
            const text = cleanText($review.find("[data-at='review_text']").text());

            // Author
            const author = cleanText($review.find("[data-at='review_author']").text());

            // Date
            const dateText = $review.find("[data-at='review_date']").text();
            const date = dateText;

            // Helpful
            const helpfulText = $review.find("[data-at='helpful_count']").text();
            const helpfulMatch = helpfulText.match(/(\\d+)/);
            const helpful = helpfulMatch ? parseInt(helpfulMatch[1]) : 0;

            // Verified purchase (check for badge)
            const verifiedPurchase = $review.find("[data-at='verified_purchaser']").length > 0;

            // Skin type (if mentioned)
            const skinType = extractSkinType($review.html() || "");

            if (text && text.length > 20) {
              pageReviews.push({
                rating,
                title,
                text: cleanText(text),
                helpful,
                date,
                author,
                verifiedPurchase,
                skinType,
                url: productUrl,
              });
            }
          } catch (error) {
            console.warn("[Sephora] Failed to parse review:", error);
          }
        });
      } catch (error) {
        console.warn("[Sephora] Failed to extract reviews:", error);
      }

      return pageReviews;
    },
    {
      timeout: 15000,
      maxRetries: 2,
    }
  );

  return result || [];
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Search Sephora for products.
 */
async function searchProducts(
  query: string,
  maxProducts: number = 3
): Promise<SephoraProduct[]> {
  const searchUrl = `https://www.sephora.com/search?keyword=${encodeURIComponent(query)}`;

  const products = await withPage<SephoraProduct[]>(
    searchUrl,
    async (page, $) => {
      const results: SephoraProduct[] = [];

      // Wait for search results to load
      await page.waitForTimeout(2000);

      const resultsHtml = await page.content();
      const $results = await import("cheerio").then((ch) => ch.load(resultsHtml));

      // Extract product cards
      $results("[data-comp='ProductCard'], .css-product-card").each((idx, productEl) => {
        if (idx >= maxProducts) return;

        try {
          const $product = $results(productEl);

          const name = cleanText($product.find("[data-at='product_name']").text());
          const brand = cleanText($product.find("[data-at='brand_name']").text());
          const productUrl = $product.find("a[data-at='product_link']").attr("href");

          if (productUrl && name) {
            const fullUrl = productUrl.startsWith("http")
              ? productUrl
              : `https://www.sephora.com${productUrl}`;

            const ratingText = $product.find("[data-at='rating']").attr("aria-label") || "";
            const rating = parseRating(ratingText) || 0;

            const reviewCountText = $product.find("[data-at='review_count']").text();
            const reviewCountMatch = reviewCountText.match(/(\\d+)/);
            const reviewCount = reviewCountMatch ? parseInt(reviewCountMatch[1]) : 0;

            const productIdMatch = fullUrl.match(/P(\\d+)/);
            const productId = productIdMatch ? productIdMatch[1] : "";

            results.push({
              productId,
              name,
              brand,
              url: fullUrl,
              rating,
              reviewCount,
              ingredients: [], // Will be populated when scraping product page
            });
          }
        } catch (error) {
          console.warn("[Sephora] Failed to parse product card:", error);
        }
      });

      return results;
    },
    {
      waitForSelector: "[data-comp='ProductGrid'], .css-product-grid",
      timeout: 15000,
    }
  );

  return products || [];
}

/**
 * Extract skin type from review HTML (Sephora includes this metadata).
 */
function extractSkinType(html: string): string | undefined {
  const match = html.match(/Skin Type: (Dry|Oily|Combination|Normal|Sensitive)/i);
  return match ? match[1].toLowerCase() : undefined;
}

/**
 * Convert Sephora reviews to RetrievedMention format.
 */
function reviewsToMentions(
  reviews: SephoraReview[],
  product: SephoraProduct
): RetrievedMention[] {
  return reviews.map((review) => ({
    platform: "sephora" as const,
    url: review.url,
    title: `${product.brand} ${product.name} - ${review.title}`,
    authorHandle: review.author,
    createdAt: parseDate(review.date)?.toISOString(),
    text: truncate(review.text, 1500),
  }));
}
