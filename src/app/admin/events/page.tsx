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

const eventTypeColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SEARCH: "default",
  LOGIN: "secondary",
  LOGOUT: "secondary",
  PAGE_VIEW: "outline",
  ERROR: "destructive",
  ADMIN_ACTION: "default",
};

export default async function AdminEventsPage() {
  const events = await prisma.eventLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Event Logs</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Metadata</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <Badge variant={eventTypeColors[e.eventType] ?? "outline"} className="text-xs">
                  {e.eventType}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {e.user?.name ?? e.user?.email ?? "Anonymous"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-md truncate font-mono">
                {JSON.stringify(e.metadata)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {e.createdAt.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
          {events.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                No events yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
