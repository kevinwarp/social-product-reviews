import { generateJSON } from "@/lib/gemini";
import type { CandidateProduct } from "@/lib/types";

/**
 * Resolve and merge duplicate product entities.
 * Uses fuzzy string matching first, then Gemini for ambiguous merges.
 */
export async function resolveEntities(
  candidates: CandidateProduct[]
): Promise<CandidateProduct[]> {
  if (candidates.length <= 1) return candidates;

  // Step 1: Fast fuzzy merge pass
  const fuzzyMerged = fuzzyMerge(candidates);

  // Step 2: If still many candidates, use Gemini to resolve ambiguous ones
  if (fuzzyMerged.length > 20) {
    return await geminiResolve(fuzzyMerged);
  }

  return fuzzyMerged;
}

/**
 * Fuzzy merge: group products whose normalized brand+model are very similar.
 */
function fuzzyMerge(candidates: CandidateProduct[]): CandidateProduct[] {
  const groups: CandidateProduct[][] = [];

  for (const candidate of candidates) {
    const normKey = normalize(candidate.brand, candidate.model);
    let merged = false;

    for (const group of groups) {
      const groupKey = normalize(group[0].brand, group[0].model);
      if (isSimilar(normKey, groupKey)) {
        group.push(candidate);
        merged = true;
        break;
      }
    }

    if (!merged) {
      groups.push([candidate]);
    }
  }

  // Merge each group into a single candidate
  return groups.map(mergeGroup);
}

/**
 * Normalize brand+model for comparison.
 */
function normalize(brand: string, model: string): string {
  return `${brand ?? ""} ${model ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if two normalized product strings are similar enough to merge.
 * Uses a simple Levenshtein-based similarity check.
 */
function isSimilar(a: string, b: string): boolean {
  if (a === b) return true;

  // One contains the other
  if (a.includes(b) || b.includes(a)) return true;

  // Check token overlap
  const tokensA = new Set(a.split(" "));
  const tokensB = new Set(b.split(" "));
  const intersection = [...tokensA].filter((t) => tokensB.has(t));
  const union = new Set([...tokensA, ...tokensB]);

  // Jaccard similarity > 0.7
  const similarity = intersection.length / union.size;
  return similarity > 0.7;
}

/**
 * Merge a group of similar products into one canonical entry.
 * Picks the most popular variant as the canonical name.
 */
function mergeGroup(group: CandidateProduct[]): CandidateProduct {
  // Sort by mention count, use the most-mentioned as canonical
  group.sort((a, b) => b.mentionCount - a.mentionCount);
  const canonical = group[0];

  // Aggregate mention counts and sources
  const totalMentions = group.reduce((sum, p) => sum + p.mentionCount, 0);
  const allSources = [...new Set(group.flatMap((p) => p.sources))];

  return {
    ...canonical,
    mentionCount: totalMentions,
    sources: allSources,
  };
}

/**
 * Use Gemini to resolve ambiguous entity merges.
 * Groups candidates that might be the same product.
 */
async function geminiResolve(
  candidates: CandidateProduct[]
): Promise<CandidateProduct[]> {
  // Only send the top candidates to Gemini to save tokens
  const topCandidates = candidates.slice(0, 80);
  const rest = candidates.slice(80);

  const candidateList = topCandidates
    .map((c, i) => `[${i}] ${c.brand} ${c.model}${c.variant ? ` (${c.variant})` : ""} - ${c.category}`)
    .join("\n");

  const prompt = `These are product candidates that may contain duplicates (same product listed under different names/variations).
Group them by identical product, returning the index of the canonical (best) name and the indices to merge into it.

Products:
${candidateList}

Return JSON:
{
  "groups": [
    {
      "canonicalIndex": 0,
      "mergeIndices": [3, 7]
    }
  ]
}

Rules:
- Only group products that are TRULY the same product (same brand, same model, just name variations)
- "Sony WF-1000XM5" and "Sony XM5" = same product → merge
- "Sony WF-1000XM5" and "Sony WF-1000XM4" = different products → do NOT merge
- If a product has no duplicates, don't include it in groups`;

  try {
    const result = await generateJSON<{
      groups: { canonicalIndex: number; mergeIndices: number[] }[];
    }>(prompt);

    // Apply merges
    const merged = new Set<number>();
    const resolvedTop = [...topCandidates];

    for (const group of result.groups ?? []) {
      const canonical = resolvedTop[group.canonicalIndex];
      if (!canonical) continue;

      for (const idx of group.mergeIndices) {
        const dup = resolvedTop[idx];
        if (!dup || idx === group.canonicalIndex) continue;

        canonical.mentionCount += dup.mentionCount;
        canonical.sources = [
          ...new Set([...canonical.sources, ...dup.sources]),
        ];
        merged.add(idx);
      }
    }

    const deduped = resolvedTop.filter((_, i) => !merged.has(i));
    return [...deduped, ...rest].sort(
      (a, b) => b.mentionCount - a.mentionCount
    );
  } catch (error) {
    console.error("[EntityResolver] Gemini resolve failed:", error);
    return candidates;
  }
}
