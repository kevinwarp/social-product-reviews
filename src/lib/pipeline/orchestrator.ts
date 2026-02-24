import { prisma } from "@/lib/db";
import { logSearch } from "@/lib/logger";
import { parseIntent } from "./intent-parser";
import { generateCandidates } from "./candidate-generator";
import { resolveEntities } from "./entity-resolver";
import { extractEvidence } from "./evidence-extractor";
import { rankCandidates } from "./ranker";
import { analyzeProductIngredients } from "./ingredient-extractor";
import { scrapeProductImage } from "@/lib/scraper/product-image";
import type { Prisma } from "@prisma/client";

interface PipelineResult {
  queryId: string;
  success: boolean;
  candidateCount: number;
  top10Count: number;
  durationMs: number;
  error?: string;
}

/**
 * Run the full product discovery pipeline:
 * 1. Parse intent
 * 2. Generate candidates (fan out to retrievers)
 * 3. Resolve entities (dedupe)
 * 4. Extract evidence (sentiment, themes)
 * 5. Rank candidates → top 10
 * 6. Persist results to DB
 */
export async function runPipeline(queryId: string): Promise<PipelineResult> {
  const startTime = Date.now();

  try {
    // Fetch query from DB
    const query = await prisma.query.findUnique({ where: { id: queryId } });
    if (!query) {
      throw new Error(`Query ${queryId} not found`);
    }

    // Update status to PROCESSING
    await prisma.query.update({
      where: { id: queryId },
      data: { status: "PROCESSING" },
    });

    console.log(`[Pipeline] Starting for query: "${query.rawQuery}"`);

    // ── Step 1: Parse Intent ──────────────────────────────────────────
    console.log("[Pipeline] Step 1: Parsing intent...");
    const { intent, seedTerms, inferredCategory } = await parseIntent(
      query.rawQuery
    );

    // Store parsed intent
    await prisma.query.update({
      where: { id: queryId },
      data: { parsedIntent: intent as unknown as Prisma.InputJsonValue },
    });

    console.log(
      `[Pipeline] Intent parsed. Category: ${inferredCategory}, ${seedTerms.length} seed terms`
    );

    // ── Step 2: Generate Candidates ───────────────────────────────────
    console.log("[Pipeline] Step 2: Generating candidates...");
    const { candidates, mentions, ingredientTexts, stats } = await generateCandidates(
      seedTerms,
      intent,
      inferredCategory
    );

    console.log(
      `[Pipeline] Found ${stats.totalMentions} mentions (${stats.amazonMentions} Amazon, ${stats.sephoraMentions} Sephora, ${stats.redditMentions} Reddit) → ${stats.uniqueCandidates} candidates`
    );

    if (candidates.length === 0) {
      await prisma.query.update({
        where: { id: queryId },
        data: { status: "COMPLETED" },
      });

      await logSearch({
        userId: query.userId,
        queryId,
        rawQuery: query.rawQuery,
        parsedIntent: intent as unknown as Record<string, unknown>,
        resultCount: 0,
        durationMs: Date.now() - startTime,
        status: "completed_empty",
      });

      return {
        queryId,
        success: true,
        candidateCount: 0,
        top10Count: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // ── Step 3: Resolve Entities ──────────────────────────────────────
    console.log("[Pipeline] Step 3: Resolving entities...");
    const resolvedCandidates = await resolveEntities(candidates);
    console.log(
      `[Pipeline] Resolved to ${resolvedCandidates.length} unique products`
    );

    // ── Step 4: Extract Evidence ──────────────────────────────────────
    console.log("[Pipeline] Step 4: Extracting evidence...");
    const evidenceMap = await extractEvidence(resolvedCandidates, mentions);

    const totalEvidence = [...evidenceMap.values()].reduce(
      (sum, ev) => sum + ev.length,
      0
    );
    console.log(`[Pipeline] Extracted ${totalEvidence} evidence items`);

    // ── Step 4.5: Analyze Ingredients ─────────────────────────────────
    console.log("[Pipeline] Step 4.5: Analyzing ingredients...");
    const ingredientAnalysis = await analyzeProductIngredients(
      resolvedCandidates,
      ingredientTexts
    );
    console.log(
      `[Pipeline] Analyzed ingredients for ${ingredientAnalysis.size} products`
    );

    // ── Step 5: Rank Candidates ───────────────────────────────────────
    console.log("[Pipeline] Step 5: Ranking candidates...");
    const { rankedProducts, candidateCount } = await rankCandidates(
      resolvedCandidates,
      evidenceMap,
      intent
    );

    console.log(
      `[Pipeline] Ranked ${rankedProducts.length} products from ${candidateCount} candidates`
    );

    // ── Step 6: Persist to DB ─────────────────────────────────────────
    console.log("[Pipeline] Step 6: Persisting results...");
    await persistResults(
      queryId,
      resolvedCandidates,
      rankedProducts,
      evidenceMap,
      mentions,
      candidateCount
    );

    // Update query status
    await prisma.query.update({
      where: { id: queryId },
      data: { status: "COMPLETED" },
    });

    const durationMs = Date.now() - startTime;

    await logSearch({
      userId: query.userId,
      queryId,
      rawQuery: query.rawQuery,
      parsedIntent: intent as unknown as Record<string, unknown>,
      resultCount: rankedProducts.length,
      durationMs,
      status: "completed",
    });

    console.log(`[Pipeline] Complete in ${durationMs}ms`);

    return {
      queryId,
      success: true,
      candidateCount,
      top10Count: rankedProducts.length,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error("[Pipeline] Failed:", error);

    // Update query status to FAILED
    await prisma.query
      .update({
        where: { id: queryId },
        data: { status: "FAILED" },
      })
      .catch(() => {});

    await logSearch({
      queryId,
      rawQuery: "unknown",
      status: "failed",
      durationMs,
    });

    return {
      queryId,
      success: false,
      candidateCount: 0,
      top10Count: 0,
      durationMs,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Persist pipeline results to the database.
 */
async function persistResults(
  queryId: string,
  candidates: import("@/lib/types").CandidateProduct[],
  rankedProducts: import("@/lib/types").RankedProduct[],
  evidenceMap: Map<string, import("@/lib/types").ExtractedEvidence[]>,
  mentions: import("@/lib/types").RetrievedMention[],
  candidateCount: number
) {
  // 1. Upsert products for the top 10
  const productIdMap = new Map<string, string>(); // "brand|model" → productId

  for (const ranked of rankedProducts) {
    // Find the matching candidate by rank position
    const matchedCandidate = candidates[ranked.rank - 1] ?? candidates[0];
    if (!matchedCandidate) continue;

    const slug = `${matchedCandidate.brand}-${matchedCandidate.model}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const product = await prisma.product.upsert({
      where: { canonicalSlug: slug },
      create: {
        brand: matchedCandidate.brand,
        model: matchedCandidate.model,
        variant: matchedCandidate.variant ?? null,
        category: matchedCandidate.category,
        canonicalSlug: slug,
      },
      update: {
        brand: matchedCandidate.brand,
        model: matchedCandidate.model,
        category: matchedCandidate.category,
      },
    });

    // Always try to scrape image if product has none
    const existingImages = Array.isArray(product.images)
      ? (product.images as unknown as string[])
      : [];
    if (existingImages.length === 0) {
      try {
        const imageUrl = await scrapeProductImage(
          matchedCandidate.brand,
          matchedCandidate.model
        );
        if (imageUrl) {
          await prisma.product.update({
            where: { id: product.id },
            data: { images: [imageUrl] as unknown as Prisma.InputJsonValue },
          });
          console.log(`[Pipeline] Image saved for ${slug}: ${imageUrl}`);
        } else {
          console.log(`[Pipeline] No image found for ${slug}`);
        }
      } catch (error) {
        console.warn(`[Pipeline] Image scrape failed for ${slug}:`, error);
      }
    }

    const key = `${matchedCandidate.brand}|${matchedCandidate.model}`;
    productIdMap.set(key, product.id);
    ranked.productId = product.id;
  }

  // 2. Store sources from mentions (batch create)
  const sourceMap = new Map<string, string>(); // url → sourceId
  const sourcesToCreate = mentions.slice(0, 200).map((m) => ({
    platform: m.platform.toUpperCase() as "REDDIT" | "TIKTOK" | "TRUSTPILOT" | "WEB" | "AMAZON" | "SEPHORA",
    url: m.url,
    title: m.title ?? null,
    authorHandle: m.authorHandle ?? null,
    sourceCreatedAt: m.createdAt ? new Date(m.createdAt) : null,
    snippet: m.text.slice(0, 500),
  }));

  for (const src of sourcesToCreate) {
    try {
      const created = await prisma.source.create({ data: src });
      sourceMap.set(src.url, created.id);
    } catch {
      // Source might already exist or have constraint issues
    }
  }

  // 3. Store evidence
  for (const [key, evidenceList] of evidenceMap) {
    const productId = productIdMap.get(key);
    if (!productId) continue;

    for (const ev of evidenceList.slice(0, 20)) {
      const sourceId = sourceMap.get(ev.sourceUrl);
      if (!sourceId) continue;

      try {
        await prisma.evidence.create({
          data: {
            productId,
            queryId,
            sourceId,
            sentiment: ev.sentiment.toUpperCase() as "POSITIVE" | "NEUTRAL" | "NEGATIVE",
            themes: ev.themes as Prisma.InputJsonValue,
            claimTags: ev.claimTags as Prisma.InputJsonValue,
            quote: ev.quote,
            quoteCharCount: ev.quote.length,
          },
        });
      } catch (error) {
        console.error("[Pipeline] Evidence create failed:", error);
      }
    }
  }

  // 4. Store ranking result
  const top10Data = rankedProducts.map((rp) => ({
    productId: rp.productId,
    rank: rp.rank,
    scores: rp.scores,
    rationale: rp.rationale,
    citations: rp.citations,
  }));

  await prisma.rankingResult.create({
    data: {
      queryId,
      candidateCount,
      top10: top10Data as unknown as Prisma.InputJsonValue,
    },
  });
}
