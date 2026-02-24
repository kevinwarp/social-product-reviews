import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [userCount, searchCount, eventCount, queryCount] = await Promise.all([
    prisma.user.count(),
    prisma.searchLog.count(),
    prisma.eventLog.count(),
    prisma.query.count(),
  ]);

  const recentSearches = await prisma.searchLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{userCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Searches</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{searchCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{eventCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Queries Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{queryCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Searches */}
      <h2 className="text-lg font-semibold mb-3">Recent Searches</h2>
      {recentSearches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No searches yet.</p>
      ) : (
        <div className="space-y-2">
          {recentSearches.map((s) => (
            <Card key={s.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{s.rawQuery}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.user?.name ?? s.user?.email ?? "Anonymous"} · {s.createdAt.toLocaleString()}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {s.durationMs ? `${s.durationMs}ms` : "—"}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
