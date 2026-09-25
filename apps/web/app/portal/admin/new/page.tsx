// apps/web/app/portal/admin/new/page.tsx
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PortalAdminNewPage() {
  redirect("/admin/orgs/new");
}