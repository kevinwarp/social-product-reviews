import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      searchLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!user) redirect("/");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Account</h1>

      {/* Profile */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
              <AvatarFallback className="text-lg">{user.name?.charAt(0) ?? "U"}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
                <Badge variant="outline">
                  Joined {user.createdAt.toLocaleDateString()}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="mb-8" />

      {/* Search History */}
      <h2 className="text-xl font-semibold mb-4">Search History</h2>
      {user.searchLogs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No searches yet.</p>
      ) : (
        <div className="space-y-3">
          {user.searchLogs.map((log) => (
            <Card key={log.id}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{log.rawQuery}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={log.status === "completed" ? "default" : "secondary"} className="text-xs">
                      {log.status}
                    </Badge>
                    {log.durationMs && (
                      <span className="text-xs text-muted-foreground">{log.durationMs}ms</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {log.createdAt.toLocaleString()}
                  {log.resultCount !== null && ` · ${log.resultCount} results`}
                </p>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
