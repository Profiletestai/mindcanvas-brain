//apps/web/app/admin/mcas/page.tsx
import "server-only";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function Page() {
  redirect("/admin/mcas/applications");
}