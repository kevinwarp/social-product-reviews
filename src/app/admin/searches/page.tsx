import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminSearchesPage() {
  const searches = await prisma.searchLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Search Logs</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Query</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Results</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {searches.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium text-sm max-w-xs truncate">
                {s.rawQuery}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {s.user?.name ?? s.user?.email ?? "Anonymous"}
              </TableCell>
              <TableCell>
                <Badge
                  variant={s.status === "completed" ? "default" : s.status === "failed" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {s.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{s.resultCount ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {s.durationMs ? `${s.durationMs}ms` : "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {s.createdAt.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
          {searches.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No search logs yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
