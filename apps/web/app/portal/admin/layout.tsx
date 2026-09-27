import { ReactNode } from "react";
import { redirect } from "next/navigation";

import {
  getAdminClient,
  getServerSupabase,
} from "@/app/_lib/portal";

export default async function PortalAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const sb = await getServerSupabase();

  const {
    data: auth,
    error: authError,
  } = await sb.auth.getUser();

  const user = auth?.user ?? null;

  if (authError || !user) {
    redirect("/portal/login?next=/portal/admin");
  }

  const admin = await getAdminClient();
  const portal = admin.schema("portal");

  const {
    data: adminRow,
    error: adminError,
  } = await portal
    .from("superadmin")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError) {
    console.error(
      "[portal-admin-layout] superadmin lookup failed",
      {
        userId: user.id,
        error: adminError,
      }
    );

    redirect("/portal");
  }

  if (!adminRow?.user_id) {
    redirect("/portal");
  }

  return <>{children}</>;
}