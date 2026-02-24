/**
 * Refresh featured searches at deploy time.
 *
 * Runs the full pipeline for every query listed in `featured-searches.ts` so
 * that results are fresh when the new version goes live.  Exits with a
 * non-zero code if any search fails, preventing the container from starting.
 *
 * Usage:
 *   npx tsx scripts/refresh-featured-searches.ts
 *
 * For local development (loads .env automatically):
 *   node -r dotenv/config node_modules/.bin/tsx scripts/refresh-featured-searches.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { featuredSearches } from "../src/lib/featured-searches";
import { runPipeline } from "../src/lib/pipeline/orchestrator";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(
    `[refresh] Refreshing ${featuredSearches.length} featured searches…`
  );

  const results: { query: string; success: boolean; error?: string }[] = [];

  for (const fs of featuredSearches) {
    console.log(`\n[refresh] ── "${fs.query}" ──`);

    // Create (or reuse) a Query row so the pipeline has something to write to.
    // Delete any stale cached result first so the pipeline runs fresh.
    const existing = await prisma.query.findFirst({
      where: { rawQuery: fs.query, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    });

    let queryId: string;

    if (existing) {
      // Reset the existing record so the pipeline re-runs it
      await prisma.query.update({
        where: { id: existing.id },
        data: { status: "PENDING" },
      });
      queryId = existing.id;
    } else {
      const created = await prisma.query.create({
        data: { rawQuery: fs.query, status: "PENDING" },
      });
      queryId = created.id;
    }

    const result = await runPipeline(queryId);

    if (result.success) {
      console.log(
        `[refresh] ✓ "${fs.query}" — ${result.top10Count} products in ${result.durationMs}ms`
      );
      results.push({ query: fs.query, success: true });
    } else {
      console.error(
        `[refresh] ✗ "${fs.query}" — ${result.error ?? "unknown error"}`
      );
      results.push({
        query: fs.query,
        success: false,
        error: result.error,
      });
    }
  }

  await prisma.$disconnect();

  // Summary
  const failed = results.filter((r) => !r.success);
  console.log(
    `\n[refresh] Done. ${results.length - failed.length}/${results.length} succeeded.`
  );

  if (failed.length > 0) {
    console.error("[refresh] Failed searches:");
    for (const f of failed) {
      console.error(`  - ${f.query}: ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[refresh] Fatal error:", err);
  process.exit(1);
});
