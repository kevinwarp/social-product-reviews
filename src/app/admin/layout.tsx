import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Shield, Users, Search, Activity } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/30 p-4">
        <div className="flex items-center gap-2 mb-6 px-2">
          <Shield className="h-5 w-5" />
          <h2 className="font-semibold">Admin</h2>
        </div>
        <nav className="space-y-1">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
          >
            <Activity className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/admin/users"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
          >
            <Users className="h-4 w-4" />
            Users
          </Link>
          <Link
            href="/admin/searches"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
          >
            <Search className="h-4 w-4" />
            Searches
          </Link>
          <Link
            href="/admin/events"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
          >
            <Activity className="h-4 w-4" />
            Events
          </Link>
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
