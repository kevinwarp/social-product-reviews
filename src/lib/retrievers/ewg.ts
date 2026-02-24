import { withPage, cleanText, circuitBreaker } from "@/lib/scraper/utils";
import type * as cheerio from "cheerio";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IngredientSafetyData {
  name: string;
  inciName: string;
  ewgScore: number; // 1-10 scale (10 = highest hazard)
  hazardLevel: "low" | "moderate" | "high";
  concerns: string[];
  dataAvailability: "good" | "fair" | "limited" | "none";
  url: string;
}

// In-memory cache to avoid re-scraping same ingredients
const ingredientCache = new Map<string, IngredientSafetyData>();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up ingredient safety data from EWG Skin Deep database.
 */
export async function lookupIngredient(
  ingredientName: string
): Promise<IngredientSafetyData | null> {
  const normalized = normalizeIngredientName(ingredientName);

  // Check cache first
  if (ingredientCache.has(normalized)) {
    return ingredientCache.get(normalized)!;
  }

  if (circuitBreaker.isDisabled("ewg")) {
    console.log("[EWG] Circuit breaker triggered - skipping");
    return null;
  }

  try {
    const data = await scrapeIngredientData(normalized);
    
    if (data) {
      ingredientCache.set(normalized, data);
      circuitBreaker.recordSuccess("ewg");
    }
    
    return data;
  } catch (error) {
    console.warn(`[EWG] Failed to lookup "${ingredientName}":`, error);
    circuitBreaker.recordFailure("ewg");
    return null;
  }
}

/**
 * Batch lookup multiple ingredients (with rate limiting).
 */
export async function lookupIngredients(
  ingredients: string[]
): Promise<Map<string, IngredientSafetyData>> {
  const results = new Map<string, IngredientSafetyData>();

  for (const ingredient of ingredients) {
    const data = await lookupIngredient(ingredient);
    if (data) {
      results.set(ingredient, data);
    }
  }

  return results;
}

/**
 * Get cached ingredient data (no network request).
 */
export function getCachedIngredient(ingredientName: string): IngredientSafetyData | null {
  const normalized = normalizeIngredientName(ingredientName);
  return ingredientCache.get(normalized) || null;
}

/**
 * Clear ingredient cache.
 */
export function clearCache(): void {
  ingredientCache.clear();
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Scrape ingredient safety data from EWG Skin Deep.
 */
async function scrapeIngredientData(
  ingredientName: string
): Promise<IngredientSafetyData | null> {
  // EWG search URL
  const searchUrl = `https://www.ewg.org/skindeep/search/?search=${encodeURIComponent(ingredientName)}`;

  const result = await withPage<IngredientSafetyData | null>(
    searchUrl,
    async (page, $) => {
      // Wait for results to load
      await page.waitForTimeout(1500);

      // Check if we got search results or direct ingredient page
      const currentUrl = page.url();

      if (currentUrl.includes("/ingredients/")) {
        // Direct ingredient page
        return await extractIngredientPage(page, $, currentUrl);
      } else {
        // Search results - get first result
        const firstResultLink = $(".search-result-link").first().attr("href");
        
        if (!firstResultLink) {
          return null;
        }

        const ingredientUrl = firstResultLink.startsWith("http")
          ? firstResultLink
          : `https://www.ewg.org${firstResultLink}`;

        // Navigate to ingredient page
        await page.goto(ingredientUrl);
        await page.waitForTimeout(1000);

        const ingredientHtml = await page.content();
        const $ingredient = await import("cheerio").then((ch) => ch.load(ingredientHtml));

        return await extractIngredientPage(page, $ingredient, ingredientUrl);
      }
    },
    {
      timeout: 15000,
      maxRetries: 2,
    }
  );

  return result;
}

/**
 * Extract ingredient data from EWG ingredient detail page.
 */
async function extractIngredientPage(
  page: any,
  $: cheerio.CheerioAPI,
  url: string
): Promise<IngredientSafetyData | null> {
  try {
    // Ingredient name
    const name = cleanText($("h1.ingredient-name, h1").first().text());
    
    // INCI name (if different)
    const inciName = cleanText($(".inci-name").text()) || name;

    // EWG Score (1-10)
    const scoreText = $(".score-circle, .ingredient-score").first().text();
    const scoreMatch = scoreText.match(/(\d+)/);
    const ewgScore = scoreMatch ? parseInt(scoreMatch[1]) : 5;

    // Hazard level
    let hazardLevel: "low" | "moderate" | "high" = "low";
    if (ewgScore >= 7) {
      hazardLevel = "high";
    } else if (ewgScore >= 4) {
      hazardLevel = "moderate";
    }

    // Concerns
    const concerns: string[] = [];
    $(".concern-item, .hazard-item").each((_, el) => {
      const concern = cleanText($(el).text());
      if (concern) {
        concerns.push(concern);
      }
    });

    // Data availability
    let dataAvailability: "good" | "fair" | "limited" | "none" = "limited";
    const dataText = $(".data-availability").text().toLowerCase();
    if (dataText.includes("good")) {
      dataAvailability = "good";
    } else if (dataText.includes("fair")) {
      dataAvailability = "fair";
    } else if (dataText.includes("none")) {
      dataAvailability = "none";
    }

    return {
      name,
      inciName,
      ewgScore,
      hazardLevel,
      concerns,
      dataAvailability,
      url,
    };
  } catch (error) {
    console.warn("[EWG] Failed to parse ingredient page:", error);
    return null;
  }
}

/**
 * Normalize ingredient name for consistent lookups.
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): {
  size: number;
  ingredients: string[];
} {
  return {
    size: ingredientCache.size,
    ingredients: Array.from(ingredientCache.keys()),
  };
}
