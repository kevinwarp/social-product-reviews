import { generateJSON } from "@/lib/gemini";
import type {
  CandidateProduct,
  ExtractedEvidence,
  ParsedIntent,
  ScoringDimensions,
  RankedProduct,
} from "@/lib/types";

interface RankingResult {
  rankedProducts: RankedProduct[];
  candidateCount: number;
}

/**
 * Score and rank candidate products, selecting the top 10.
 * Uses a combination of heuristic scoring + Gemini for rationale generation.
 */
export async function rankCandidates(
  candidates: CandidateProduct[],
  evidenceMap: Map<string, ExtractedEvidence[]>,
  intent: ParsedIntent
): Promise<RankingResult> {
  // Step 1: Compute heuristic scores for all candidates
  const scored = candidates.map((candidate) => {
    const key = `${candidate.brand}|${candidate.model}`;
    const evidence = evidenceMap.get(key) ?? [];
    const scores = computeScores(candidate, evidence, intent);
    return { candidate, scores, evidence };
  });

  // Step 2: Sort by overall score
  scored.sort((a, b) => b.scores.overall - a.scores.overall);

  // Step 3: Take top 10 and generate rationale via Gemini
  const top10 = scored.slice(0, 10);
  const rankedProducts = await generateRationales(top10, intent);

  return {
    rankedProducts,
    candidateCount: candidates.length,
  };
}

/**
 * Compute multi-dimensional scores for a candidate product.
 */
function computeScores(
  candidate: CandidateProduct,
  evidence: ExtractedEvidence[],
  intent: ParsedIntent
): ScoringDimensions {
  // Query Fit: based on how many constraint/mustHave themes appear in evidence
  const queryFit = computeQueryFit(evidence, intent);

  // Reddit Endorsement: mention volume + positive sentiment ratio from Reddit
  const redditEndorsement = computeRedditEndorsement(candidate, evidence);

  // Social Proof Coverage: diversity of platforms + volume
  const socialProofCoverage = computeSocialCoverage(candidate, evidence);

  // Risk Score: complaint ratio (inverted — lower risk = higher score)
  const riskScore = computeRiskScore(evidence);

  // Confidence Score: based on evidence volume + agreement
  const confidenceScore = computeConfidenceScore(candidate, evidence);

  // Overall: weighted combination
  const overall =
    queryFit * 0.30 +
    redditEndorsement * 0.25 +
    socialProofCoverage * 0.15 +
    riskScore * 0.15 +
    confidenceScore * 0.15;

  return {
    queryFit: Math.round(queryFit),
    redditEndorsement: Math.round(redditEndorsement),
    socialProofCoverage: Math.round(socialProofCoverage),
    riskScore: Math.round(riskScore),
    confidenceScore: Math.round(confidenceScore),
    overall: Math.round(overall),
  };
}

function computeQueryFit(
  evidence: ExtractedEvidence[],
  intent: ParsedIntent
): number {
  if (evidence.length === 0) return 20;

  const allTags = evidence.flatMap((e) => [...e.themes, ...e.claimTags]);
  const allTagsLower = allTags.map((t) => t.toLowerCase());

  const targetTerms = [
    ...intent.constraints,
    ...intent.mustHaves,
    ...intent.niceToHaves,
  ].map((t) => t.toLowerCase());

  if (targetTerms.length === 0) return 50;

  let matchCount = 0;
  for (const term of targetTerms) {
    const termTokens = term.split(/\s+/);
    if (termTokens.some((token) => allTagsLower.some((tag) => tag.includes(token)))) {
      matchCount++;
    }
  }

  const matchRatio = matchCount / targetTerms.length;
  return Math.min(100, 20 + matchRatio * 80);
}

function computeRedditEndorsement(
  candidate: CandidateProduct,
  evidence: ExtractedEvidence[]
): number {
  const redditEvidence = evidence.filter((e) => e.platform === "reddit");
  if (redditEvidence.length === 0) return 10;

  const positiveCount = redditEvidence.filter((e) => e.sentiment === "positive").length;
  const totalCount = redditEvidence.length;
  const positiveRatio = positiveCount / totalCount;

  // Volume bonus
  const volumeScore = Math.min(50, totalCount * 5);
  // Sentiment bonus
  const sentimentScore = positiveRatio * 50;

  return Math.min(100, volumeScore + sentimentScore);
}

function computeSocialCoverage(
  candidate: CandidateProduct,
  evidence: ExtractedEvidence[]
): number {
  const platforms = new Set(evidence.map((e) => e.platform));

  // Platform diversity: each platform adds points
  let score = platforms.size * 20;

  // Volume bonus
  score += Math.min(40, evidence.length * 3);

  // Mention count from candidate
  score += Math.min(20, candidate.mentionCount * 2);

  return Math.min(100, score);
}

function computeRiskScore(evidence: ExtractedEvidence[]): number {
  if (evidence.length === 0) return 50; // Unknown risk

  const negativeCount = evidence.filter((e) => e.sentiment === "negative").length;
  const complaintRatio = negativeCount / evidence.length;

  // Invert: fewer complaints = higher score
  return Math.round(Math.max(0, 100 - complaintRatio * 150));
}

function computeConfidenceScore(
  candidate: CandidateProduct,
  evidence: ExtractedEvidence[]
): number {
  // Based on total evidence volume
  let score = Math.min(50, evidence.length * 5);

  // Source diversity
  const uniqueSources = new Set(evidence.map((e) => e.sourceUrl));
  score += Math.min(30, uniqueSources.size * 5);

  // Mention count
  score += Math.min(20, candidate.mentionCount * 2);

  return Math.min(100, score);
}

/**
 * Use Gemini to generate human-readable rationale for each top-10 product.
 */
async function generateRationales(
  top10: {
    candidate: CandidateProduct;
    scores: ScoringDimensions;
    evidence: ExtractedEvidence[];
  }[],
  intent: ParsedIntent
): Promise<RankedProduct[]> {
  const productSummaries = top10
    .map(
      (item, i) =>
        `[${i + 1}] ${item.candidate.brand} ${item.candidate.model} (${item.candidate.category})
    Scores: fit=${item.scores.queryFit}, reddit=${item.scores.redditEndorsement}, coverage=${item.scores.socialProofCoverage}, risk=${item.scores.riskScore}, confidence=${item.scores.confidenceScore}, overall=${item.scores.overall}
    Evidence count: ${item.evidence.length}
    Top themes: ${[...new Set(item.evidence.flatMap((e) => e.themes))].slice(0, 5).join(", ")}
    Positive evidence: ${item.evidence.filter((e) => e.sentiment === "positive").length}
    Negative evidence: ${item.evidence.filter((e) => e.sentiment === "negative").length}`
    )
    .join("\n\n");

  const prompt = `Generate a brief ranking rationale for each of these top 10 products.
The user is looking for: "${intent.useCase}"
Constraints: ${intent.constraints.join(", ") || "none specified"}
Must-haves: ${intent.mustHaves.join(", ") || "none specified"}

Products:
${productSummaries}

Return JSON:
{
  "rationales": [
    "1-2 sentence rationale for why this product ranked #1",
    "1-2 sentence rationale for #2",
    ...
  ]
}

Be specific about WHY each product fits the user's needs. Reference social proof and evidence themes.`;

  let rationales: string[] = [];
  try {
    const result = await generateJSON<{ rationales: string[] }>(prompt);
    rationales = result.rationales ?? [];
  } catch (error) {
    console.error("[Ranker] Rationale generation failed:", error);
  }

  return top10.map((item, i) => ({
    productId: "", // Will be filled when persisted to DB
    rank: i + 1,
    scores: item.scores,
    rationale: rationales[i] ?? `Ranked #${i + 1} based on social proof analysis.`,
    citations: item.evidence.slice(0, 5).map((ev) => ({
      sourceId: "",
      url: ev.sourceUrl,
      platform: ev.platform,
      snippet: ev.quote,
      capturedAt: new Date().toISOString(),
    })),
  }));
}
