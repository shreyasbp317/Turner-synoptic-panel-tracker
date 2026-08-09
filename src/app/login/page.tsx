import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-gradient-to-b from-[#E8EEF6] to-[#F5F5F5] p-6">
      <LoginForm />
    </main>
  );
}
