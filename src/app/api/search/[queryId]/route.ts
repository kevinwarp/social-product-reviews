import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ queryId: string }> }
) {
  const { queryId } = await params;

  const query = await prisma.query.findUnique({
    where: { id: queryId },
    include: {
      rankingResults: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!query) {
    return NextResponse.json({ error: "Query not found" }, { status: 404 });
  }

  return NextResponse.json({
    queryId: query.id,
    status: query.status,
    rawQuery: query.rawQuery,
    parsedIntent: query.parsedIntent,
    hasResults: query.rankingResults.length > 0,
    candidateCount: query.rankingResults[0]?.candidateCount ?? null,
  });
}
