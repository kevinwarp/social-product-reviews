import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logSearch } from "@/lib/logger";
import { runPipeline } from "@/lib/pipeline/orchestrator";

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const { query } = await request.json();

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const session = await auth();
    const userId = session?.user?.id ?? null;

    // Check for cached result (same query within last 7 days)
    const existingQuery = await prisma.query.findFirst({
      where: {
        rawQuery: query.trim(),
        status: "COMPLETED",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingQuery) {
      await logSearch({
        userId,
        queryId: existingQuery.id,
        rawQuery: query.trim(),
        status: "cached",
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json({ queryId: existingQuery.id, cached: true });
    }

    // Create new query record
    const newQuery = await prisma.query.create({
      data: {
        rawQuery: query.trim(),
        status: "PENDING",
        userId: userId ?? undefined,
      },
    });

    await logSearch({
      userId,
      queryId: newQuery.id,
      rawQuery: query.trim(),
      status: "initiated",
      durationMs: Date.now() - startTime,
    });

    // Fire-and-forget: run pipeline in background
    // The frontend will poll for results via the query status
    runPipeline(newQuery.id).catch((err) =>
      console.error("Pipeline background error:", err)
    );

    return NextResponse.json({ queryId: newQuery.id, cached: false });
  } catch (error) {
    console.error("Search API error:", error);
    await logSearch({
      rawQuery: "unknown",
      status: "error",
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
