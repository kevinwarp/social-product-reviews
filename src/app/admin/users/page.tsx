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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { searchLogs: true, eventLogs: true },
      },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Users ({users.length})</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Searches</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Last Login</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image ?? undefined} />
                    <AvatarFallback>{user.name?.charAt(0) ?? "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{user.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"} className="text-xs">
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{user._count.searchLogs}</TableCell>
              <TableCell className="text-sm">{user._count.eventLogs}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {user.createdAt.toLocaleDateString()}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {user.lastLoginAt?.toLocaleString() ?? "Never"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
