import { lookupIngredients, type IngredientSafetyData } from "@/lib/retrievers/ewg";
import { generateJSON } from "@/lib/gemini";
import type { CandidateProduct } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductIngredientAnalysis {
  productKey: string; // "brand|model"
  ingredients: string[];
  safetyScore: number; // 0-100 (100 = safest)
  riskFlags: IngredientRiskFlag[];
  ewgData: Map<string, IngredientSafetyData>;
}

export interface IngredientRiskFlag {
  ingredient: string;
  severity: "low" | "moderate" | "high";
  concerns: string[];
  ewgScore: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract and analyze ingredients for a list of products.
 * Combines ingredient list parsing with EWG safety data.
 */
export async function analyzeProductIngredients(
  candidates: CandidateProduct[],
  ingredientTexts: Map<string, string> // productKey -> ingredient list text
): Promise<Map<string, ProductIngredientAnalysis>> {
  const results = new Map<string, ProductIngredientAnalysis>();

  for (const candidate of candidates) {
    const productKey = `${candidate.brand}|${candidate.model}`;
    const ingredientText = ingredientTexts.get(productKey);

    if (!ingredientText) {
      continue; // No ingredient data available
    }

    try {
      // Parse ingredient list using Gemini
      const ingredients = await parseIngredientList(ingredientText);

      if (ingredients.length === 0) {
        continue;
      }

      // Look up EWG data for each ingredient
      const ewgData = await lookupIngredients(ingredients.slice(0, 20)); // Limit to first 20

      // Compute safety score and risk flags
      const { safetyScore, riskFlags } = computeSafetyMetrics(ingredients, ewgData);

      results.set(productKey, {
        productKey,
        ingredients,
        safetyScore,
        riskFlags,
        ewgData,
      });

      console.log(
        `[IngredientExtractor] ${productKey}: ${ingredients.length} ingredients, safety score ${safetyScore}`
      );
    } catch (error) {
      console.warn(`[IngredientExtractor] Failed to analyze ${productKey}:`, error);
    }
  }

  return results;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Parse a raw ingredient list text into structured array using Gemini.
 */
async function parseIngredientList(text: string): Promise<string[]> {
  try {
    const prompt = `Parse this skincare product ingredient list into a JSON array of ingredient names.
Remove any non-ingredient text (e.g., "Ingredients:", percentages, parenthetical notes).
Normalize ingredient names to INCI standard when possible.

Input: ${text}

Return JSON array like: ["Water", "Glycerin", "Niacinamide", ...]`;

    const result = await generateJSON<{ ingredients: string[] }>(prompt);
    return result.ingredients || [];
  } catch (error) {
    console.warn("[IngredientExtractor] Gemini parse failed:", error);

    // Fallback: simple comma/period split
    return text
      .replace(/^ingredients?:?\s*/i, "")
      .split(/[,.]/)
      .map((ing) => ing.trim())
      .filter((ing) => ing.length > 0 && ing.length < 100);
  }
}

/**
 * Compute safety score and risk flags based on EWG data.
 */
function computeSafetyMetrics(
  ingredients: string[],
  ewgData: Map<string, IngredientSafetyData>
): { safetyScore: number; riskFlags: IngredientRiskFlag[] } {
  const riskFlags: IngredientRiskFlag[] = [];
  let totalHazardScore = 0;
  let scoredCount = 0;

  for (const [ingredient, data] of ewgData) {
    totalHazardScore += data.ewgScore;
    scoredCount++;

    // Flag high-risk ingredients
    if (data.hazardLevel === "high" || data.ewgScore >= 7) {
      riskFlags.push({
        ingredient: data.name,
        severity: "high",
        concerns: data.concerns,
        ewgScore: data.ewgScore,
      });
    } else if (data.hazardLevel === "moderate" || data.ewgScore >= 4) {
      riskFlags.push({
        ingredient: data.name,
        severity: "moderate",
        concerns: data.concerns,
        ewgScore: data.ewgScore,
      });
    }
  }

  // Compute safety score (inverse of hazard)
  // Average EWG score is ~5, so we invert and normalize to 0-100 scale
  let safetyScore = 100;

  if (scoredCount > 0) {
    const avgHazard = totalHazardScore / scoredCount;
    // Score formula: 100 - (avgHazard * 10)
    // EWG 1 → 90, EWG 5 → 50, EWG 10 → 0
    safetyScore = Math.max(0, 100 - avgHazard * 10);

    // Apply position-based weighting (ingredients early in list are more concentrated)
    const topIngredientPenalty = calculateTopIngredientPenalty(ingredients, ewgData);
    safetyScore = Math.max(0, safetyScore - topIngredientPenalty);
  }

  return { safetyScore, riskFlags };
}

/**
 * Apply penalty for high-risk ingredients in top positions.
 */
function calculateTopIngredientPenalty(
  ingredients: string[],
  ewgData: Map<string, IngredientSafetyData>
): number {
  let penalty = 0;

  // Check first 5 ingredients (most concentrated)
  const topIngredients = ingredients.slice(0, 5);

  for (let i = 0; i < topIngredients.length; i++) {
    const ingredient = topIngredients[i];
    const data = ewgData.get(ingredient);

    if (data && data.ewgScore >= 7) {
      // High risk in top 5: significant penalty
      const positionWeight = (5 - i) / 5; // Earlier = higher weight
      penalty += 15 * positionWeight;
    }
  }

  return penalty;
}
