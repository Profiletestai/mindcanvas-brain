import Link from "next/link";
import { getAdminClient, getServerSupabase } from "@/app/_lib/portal";
import { ProfileCard, ProfileShell } from "../_components/ui";
import { notFound } from "next/navigation";
import { requireOrgAccess } from "@/lib/server/orgAccess";

export const dynamic = "force-dynamic";

type Item = { label: string; complete: boolean; href?: string };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = await getAdminClient();
  const portal = admin.schema("portal");
  const { data: org } = await portal.from("orgs").select("id,name,website_url,industry,primary_contact_name,primary_contact_email,logo_url,brand_primary,brand_secondary").eq("slug", slug).maybeSingle();
  const auth = await getServerSupabase();
  const { data: authData } = await auth.auth.getUser();
  const orgId = org?.id ?? "";
  const accessCheck = await requireOrgAccess(orgId);
  if (!accessCheck.ok) notFound();

  const [billingResult, linksResult, submissionsResult] = orgId ? await Promise.all([
    portal.from("billing_accounts").select("stripe_status").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    portal.from("test_links").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    portal.from("test_takers").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "completed"),
  ]) : [{ data: null }, { count: 0 }, { count: 0 }] as const;

  const billingStatus = billingResult.data?.stripe_status?.toLowerCase() ?? "";
  const items: Item[] = [
    { label: "Account created", complete: Boolean(authData.user) },
    { label: "Email verified", complete: Boolean(authData.user?.email_confirmed_at) },
    { label: "Organisation created", complete: Boolean(org?.id), href: `/portal/${slug}/profile/organisation` },
    { label: "Organisation details completed", complete: Boolean(org?.name && org?.website_url && org?.industry && org?.primary_contact_name && org?.primary_contact_email), href: `/portal/${slug}/profile/organisation` },
    { label: "Branding added", complete: Boolean(org?.logo_url && org?.brand_primary && org?.brand_secondary), href: `/portal/${slug}/profile/logo` },
    { label: "First test link created", complete: (linksResult.count ?? 0) > 0, href: `/portal/${slug}/links` },
    { label: "First assessment completed", complete: (submissionsResult.count ?? 0) > 0, href: `/portal/${slug}/database` },
    { label: "Billing set up", complete: ["active", "trialing", "pilot"].includes(billingStatus), href: `/portal/${slug}/billing` },
  ];
  const complete = items.filter((item) => item.complete).length;
  const percent = Math.round((complete / items.length) * 100);

  return <ProfileShell title="Setup checklist" subtitle="Finish the essentials to get the most from your MindCanvas account.">
    <ProfileCard title={`${complete} of ${items.length} complete`} description={complete === items.length ? "Your account is fully configured and ready." : "Complete the remaining steps when you are ready."}>
      <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${percent}%` }} /></div>
      <ul className="mt-6 divide-y divide-white/[0.06]">{items.map((item) => <li key={item.label} className="flex items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><span className={item.complete ? "flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white" : "h-5 w-5 rounded-full border border-white/25"}>{item.complete ? "✓" : ""}</span><span className={item.complete ? "text-sm text-white/65" : "text-sm font-medium text-white"}>{item.label}</span></div>{!item.complete && item.href && <Link href={item.href} className="text-xs font-semibold text-[#64bae2] hover:underline">Complete →</Link>}</li>)}</ul>
    </ProfileCard>
  </ProfileShell>;
}
