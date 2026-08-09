import { AppHeader } from "@/components/AppHeader";
import { UsersAdminClient } from "@/components/UsersAdminClient";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function UsersPage() {
  const user = await requireRole(["ADMIN"]);
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
    },
  });

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        subtitle="User management"
        backHref="/"
        user={{ name: user.name, role: user.role }}
      />
      <main className="flex-1 p-4 sm:p-6">
        <UsersAdminClient initialUsers={users} />
      </main>
    </div>
  );
}
