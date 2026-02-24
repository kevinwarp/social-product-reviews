import { prisma } from "@/lib/db";

import type { Prisma } from "@prisma/client";

type EventType = "SEARCH" | "LOGIN" | "LOGOUT" | "PAGE_VIEW" | "ERROR" | "ADMIN_ACTION";

/**
 * Log a generic event (login, logout, page view, error, admin action).
 */
export async function logEvent(
  eventType: EventType,
  metadata: Record<string, unknown> = {},
  userId?: string | null
) {
  try {
    await prisma.eventLog.create({
      data: {
        eventType,
        metadata: metadata as Prisma.InputJsonValue,
        userId: userId ?? undefined,
      },
    });
  } catch (error) {
    console.error("Failed to log event:", error);
  }
}

/**
 * Log a search event with timing and result info.
 */
export async function logSearch(params: {
  userId?: string | null;
  queryId?: string;
  rawQuery: string;
  parsedIntent?: Record<string, unknown>;
  resultCount?: number;
  durationMs?: number;
  status: string;
}) {
  try {
    await prisma.searchLog.create({
      data: {
        userId: params.userId ?? undefined,
        queryId: params.queryId ?? undefined,
        rawQuery: params.rawQuery,
        parsedIntent: (params.parsedIntent ?? {}) as Prisma.InputJsonValue,
        resultCount: params.resultCount ?? undefined,
        durationMs: params.durationMs ?? undefined,
        status: params.status,
      },
    });

    // Also log as a generic event
    await logEvent("SEARCH", {
      rawQuery: params.rawQuery,
      resultCount: params.resultCount,
      durationMs: params.durationMs,
      status: params.status,
    }, params.userId);
  } catch (error) {
    console.error("Failed to log search:", error);
  }
}
