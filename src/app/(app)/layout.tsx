import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
