import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";

/** Uploads are disabled — plans are seeded from /plans. */
export default async function UploadPage() {
  await requireUser();
  redirect("/");
}
