import { generateJSON } from "@/lib/gemini";
import type { ParsedIntent } from "@/lib/types";

interface IntentParserResult {
  intent: ParsedIntent;
  seedTerms: string[];
  inferredCategory: string;
}

/**
 * Parse a raw user query into structured intent + expanded search terms.
 * Uses Gemini to understand what the user is looking for.
 */
export async function parseIntent(rawQuery: string): Promise<IntentParserResult> {
  const prompt = `You are a product research assistant. Analyze this user query and extract structured information.

User query: "${rawQuery}"

Return a JSON object with these exact fields:
{
  "intent": {
    "useCase": "primary use case described (e.g. 'sleeping with headphones')",
    "constraints": ["list of constraints mentioned or implied (e.g. 'comfortable for side sleeping', 'low profile')"],
    "mustHaves": ["features that are required (e.g. 'wireless', 'noise cancellation')"],
    "niceToHaves": ["features that would be nice but not required (e.g. 'long battery life', 'app support')"]
  },
  "seedTerms": [
    "10-15 diverse search terms to find relevant products. Include:",
    "- The original query rephrased",
    "- Specific product category terms (e.g. 'sleep earbuds', 'headband headphones')",
    "- Reddit-style queries (e.g. 'best earbuds for sleeping reddit')",
    "- Comparison queries (e.g. 'sleep headphones vs earbuds')",
    "- Specific feature queries (e.g. 'low profile earbuds side sleeper')"
  ],
  "inferredCategory": "the broad product category (e.g. 'headphones', 'earbuds', 'keyboards', 'shoes')"
}

Be thorough with seed terms — we need to discover 100+ candidate products. Generate at least 12 diverse search terms.`;

  try {
    const result = await generateJSON<IntentParserResult>(prompt);

    // Validate and ensure we have enough seed terms
    if (!result.seedTerms || result.seedTerms.length < 5) {
      result.seedTerms = generateFallbackTerms(rawQuery);
    }

    if (!result.intent) {
      result.intent = {
        useCase: rawQuery,
        constraints: [],
        mustHaves: [],
        niceToHaves: [],
      };
    }

    if (!result.inferredCategory) {
      result.inferredCategory = "general";
    }

    return result;
  } catch (error) {
    console.error("Intent parsing failed, using fallback:", error);
    return {
      intent: {
        useCase: rawQuery,
        constraints: [],
        mustHaves: [],
        niceToHaves: [],
      },
      seedTerms: generateFallbackTerms(rawQuery),
      inferredCategory: "general",
    };
  }
}

/**
 * Generate basic search terms when Gemini is unavailable.
 */
function generateFallbackTerms(rawQuery: string): string[] {
  const base = rawQuery.trim();
  return [
    base,
    `best ${base}`,
    `${base} reddit`,
    `${base} review`,
    `${base} recommendation`,
    `top ${base} ${new Date().getFullYear()}`,
    `${base} vs`,
    `${base} buying guide`,
  ];
}
