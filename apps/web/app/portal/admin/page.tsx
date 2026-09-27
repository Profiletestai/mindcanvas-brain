// apps/web/app/portal/admin/page.tsx
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PortalAdminPage() {
  redirect("/admin");
}
