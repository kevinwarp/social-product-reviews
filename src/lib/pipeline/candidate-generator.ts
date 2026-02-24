import { generateJSON } from "@/lib/gemini";
import { retrieveRedditMentions, suggestSubreddits } from "@/lib/retrievers/reddit";
import { retrieveWebMentions } from "@/lib/retrievers/web-search";
import { retrieveTikTokMentions } from "@/lib/retrievers/tiktok";
import { retrieveAmazonReviews } from "@/lib/retrievers/amazon";
import { retrieveSephoraReviews } from "@/lib/retrievers/sephora";
import type { CandidateProduct, RetrievedMention, ParsedIntent } from "@/lib/types";

interface CandidateGenerationResult {
  candidates: CandidateProduct[];
  mentions: RetrievedMention[];
  ingredientTexts: Map<string, string>; // productKey -> ingredient list text (from Sephora)
  stats: {
    totalMentions: number;
    redditMentions: number;
    webMentions: number;
    tiktokMentions: number;
    amazonMentions: number;
    sephoraMentions: number;
    uniqueCandidates: number;
  };
}

/**
 * Generate candidate products by fanning out to all retrievers,
 * then using Gemini to extract product references from the raw mentions.
 */
export async function generateCandidates(
  seedTerms: string[],
  intent: ParsedIntent,
  inferredCategory: string
): Promise<CandidateGenerationResult> {
  // 1. Fan out to retrievers in parallel
  const relevantSubreddits = suggestSubreddits(inferredCategory);

  console.log(`[CandidateGen] Starting retrieval with ${seedTerms.length} seed terms`);
  console.log(`[CandidateGen] Subreddits: ${relevantSubreddits.join(", ")}`);

  // Use SerpAPI web search with diverse query types to cover Reddit, Amazon, forums
  const webMentions = await retrieveWebMentions(seedTerms.slice(0, 5), {
    maxResultsPerSearch: 15,
  }).catch((err) => {
    console.error("[CandidateGen] Web search failed:", err);
    return [] as RetrievedMention[];
  });

  const redditMentions: RetrievedMention[] = [];
  const amazonMentions: RetrievedMention[] = [];
  const sephoraMentions: RetrievedMention[] = [];
  const tiktokResult = { mentions: [] as RetrievedMention[], available: false, reason: "disabled" };
  const ingredientTexts = new Map<string, string>();

  const allMentions = [...webMentions];

  console.log(`[CandidateGen] Retrieved ${allMentions.length} total mentions`);

  if (allMentions.length === 0) {
    return {
      candidates: [],
      mentions: [],
      ingredientTexts,
      stats: {
        totalMentions: 0,
        redditMentions: 0,
        webMentions: 0,
        tiktokMentions: 0,
        amazonMentions: 0,
        sephoraMentions: 0,
        uniqueCandidates: 0,
      },
    };
  }

  // 2. Extract product names from mentions using Gemini
  const candidates = await extractProductsFromMentions(allMentions, intent);

  console.log(`[CandidateGen] Extracted ${candidates.length} candidate products`);

  return {
    candidates,
    mentions: allMentions,
    ingredientTexts,
    stats: {
      totalMentions: allMentions.length,
      redditMentions: redditMentions.length,
      webMentions: webMentions.length,
      tiktokMentions: tiktokResult.mentions.length,
      amazonMentions: amazonMentions.length,
      sephoraMentions: sephoraMentions.length,
      uniqueCandidates: candidates.length,
    },
  };
}

/**
 * Use Gemini to extract product names/brands from batches of mentions.
 * Processes mentions in chunks to stay within token limits.
 */
async function extractProductsFromMentions(
  mentions: RetrievedMention[],
  intent: ParsedIntent
): Promise<CandidateProduct[]> {
  const BATCH_SIZE = 30;
  const allProducts: RawProductRef[] = [];

  for (let i = 0; i < mentions.length; i += BATCH_SIZE) {
    const batch = mentions.slice(i, i + BATCH_SIZE);
    const products = await extractBatch(batch, intent);
    allProducts.push(...products);
  }

  // Aggregate: count mentions per product
  return aggregateProducts(allProducts);
}

interface RawProductRef {
  brand: string;
  model: string;
  variant?: string;
  category: string;
  sourceIndex: number;
}

async function extractBatch(
  mentions: RetrievedMention[],
  intent: ParsedIntent
): Promise<RawProductRef[]> {
  const mentionTexts = mentions
    .map((m, i) => `[${i}] (${m.platform}) ${m.text.slice(0, 300)}`)
    .join("\n\n");

  const prompt = `Extract all specific product mentions from these texts. The user is looking for: "${intent.useCase}".

Texts:
${mentionTexts}

For each product mentioned, return:
{
  "products": [
    {
      "brand": "brand name",
      "model": "model name",
      "variant": "variant if specified or null",
      "category": "product category (e.g. earbuds, headband, on-ear)",
      "sourceIndex": 0
    }
  ]
}

Rules:
- Only extract SPECIFIC products with brand + model names (not generic terms like "earbuds" or "headphones")
- Include ALL products mentioned, even if briefly
- sourceIndex should reference which text [index] the product was found in
- If the same product appears in multiple texts, list it once per text
- Normalize brand names (e.g. "Sony" not "sony")`;

  try {
    const result = await generateJSON<{ products: RawProductRef[] }>(prompt);
    // Filter out products with missing brand/model (Gemini sometimes returns nulls)
    return (result.products ?? []).filter(
      (p) => p && p.brand && p.model && typeof p.brand === "string" && typeof p.model === "string"
    );
  } catch (error) {
    console.error("[CandidateGen] Batch extraction failed:", error);
    return [];
  }
}

function aggregateProducts(rawRefs: RawProductRef[]): CandidateProduct[] {
  const productMap = new Map<string, CandidateProduct>();

  for (const ref of rawRefs) {
    // Create a normalized key
    const key = `${ref.brand.toLowerCase()}|${ref.model.toLowerCase()}`;

    const existing = productMap.get(key);
    if (existing) {
      existing.mentionCount++;
      if (!existing.sources.includes(String(ref.sourceIndex))) {
        existing.sources.push(String(ref.sourceIndex));
      }
    } else {
      productMap.set(key, {
        brand: ref.brand,
        model: ref.model,
        variant: ref.variant,
        category: ref.category,
        mentionCount: 1,
        sources: [String(ref.sourceIndex)],
      });
    }
  }

  // Sort by mention count descending
  return Array.from(productMap.values()).sort(
    (a, b) => b.mentionCount - a.mentionCount
  );
}
