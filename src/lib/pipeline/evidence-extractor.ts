import { generateJSON } from "@/lib/gemini";
import type {
  CandidateProduct,
  RetrievedMention,
  ExtractedEvidence,
} from "@/lib/types";

/**
 * Extract structured evidence (sentiment, themes, claims) for top candidates.
 * Processes mentions in batches per product, using Gemini for analysis.
 */
export async function extractEvidence(
  candidates: CandidateProduct[],
  mentions: RetrievedMention[]
): Promise<Map<string, ExtractedEvidence[]>> {
  const evidenceMap = new Map<string, ExtractedEvidence[]>();

  // Only process top candidates (by mention count) to manage API costs
  const topCandidates = candidates.slice(0, 30);

  for (const candidate of topCandidates) {
    const key = `${candidate.brand}|${candidate.model}`;

    // Find mentions likely relevant to this product
    const relevantMentions = findRelevantMentions(candidate, mentions);

    if (relevantMentions.length === 0) {
      evidenceMap.set(key, []);
      continue;
    }

    const evidence = await extractForProduct(candidate, relevantMentions);
    evidenceMap.set(key, evidence);
  }

  return evidenceMap;
}

/**
 * Find mentions that reference a specific product.
 */
function findRelevantMentions(
  candidate: CandidateProduct,
  mentions: RetrievedMention[]
): RetrievedMention[] {
  const brandLower = candidate.brand.toLowerCase();
  const modelLower = candidate.model.toLowerCase();

  // Split model into searchable tokens (e.g., "WF-1000XM5" → ["wf", "1000xm5", "xm5"])
  const modelTokens = modelLower
    .split(/[\s\-_]+/)
    .filter((t) => t.length > 1);

  return mentions.filter((m) => {
    const textLower = m.text.toLowerCase();

    // Must mention brand or a model token
    const hasBrand = textLower.includes(brandLower);
    const hasModel = modelTokens.some((token) => textLower.includes(token));

    return hasBrand || hasModel;
  });
}

/**
 * Use Gemini to extract evidence from mentions for a single product.
 */
async function extractForProduct(
  candidate: CandidateProduct,
  mentions: RetrievedMention[]
): Promise<ExtractedEvidence[]> {
  // Cap mentions to avoid token limits
  const capped = mentions.slice(0, 20);

  const mentionTexts = capped
    .map(
      (m, i) =>
        `[${i}] (${m.platform}, ${m.url})\n${m.text.slice(0, 400)}`
    )
    .join("\n\n");

  const prompt = `Analyze these mentions of "${candidate.brand} ${candidate.model}" and extract evidence.

Mentions:
${mentionTexts}

For each meaningful piece of evidence found, return:
{
  "evidence": [
    {
      "sentiment": "positive" | "neutral" | "negative",
      "themes": ["comfort", "durability", "sound_quality", etc.],
      "claimTags": ["side_sleep", "noise_cancellation", "battery_life", etc.],
      "quote": "short representative quote (max 150 chars)",
      "sourceIndex": 0
    }
  ]
}

Rules:
- Extract 1-3 evidence items per mention (only if the mention actually discusses this product)
- "themes" should be general categories (comfort, durability, sound_quality, build_quality, battery, connectivity, price_value, noise_control, fit, design)
- "claimTags" should be specific claims relevant to user needs
- "quote" should be the most representative short excerpt (under 150 characters)
- Skip mentions that don't actually discuss this specific product
- Be accurate with sentiment — don't default to positive`;

  try {
    const result = await generateJSON<{
      evidence: {
        sentiment: "positive" | "neutral" | "negative";
        themes: string[];
        claimTags: string[];
        quote: string;
        sourceIndex: number;
      }[];
    }>(prompt);

    return (result.evidence ?? []).map((ev) => ({
      productRef: `${candidate.brand} ${candidate.model}`,
      sentiment: ev.sentiment,
      themes: ev.themes,
      claimTags: ev.claimTags,
      quote: ev.quote.slice(0, 150),
      sourceUrl: capped[ev.sourceIndex]?.url ?? "",
      platform: capped[ev.sourceIndex]?.platform ?? "web",
    }));
  } catch (error) {
    console.error(
      `[EvidenceExtractor] Failed for ${candidate.brand} ${candidate.model}:`,
      error
    );
    return [];
  }
}
