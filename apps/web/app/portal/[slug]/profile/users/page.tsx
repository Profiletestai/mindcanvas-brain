// apps/web/app/portal/[slug]/profile/users/page.tsx
// Profile → Team Members / Add users (mockup: static roster, no invite backend).
import PortalPageHeader from "@/components/portal/PortalPageHeader";
import { Avatar } from "@/components/portal/Avatar";
import { Badge, type BadgeTone } from "@/components/portal/Badge";
import {
  JAKARTA_STYLE,
  cardClass,
  sectionLabelClass,
  smallBtnClass,
} from "@/components/portal/ui";
import { inputClass, primaryBtnClass, ghostBtnClass } from "../_components/ui";
import PreviewBanner from "../_components/PreviewBanner";

export const dynamic = "force-dynamic";

type Member = {
  name: string;
  email: string;
  initials: string;
  avatar: string;
  role: "Owner" | "Admin" | "Manager" | "Viewer";
  you?: boolean;
  status: "Active" | "Pending";
  lastActive: string;
  joined: string;
  actions: "none" | "edit" | "invite";
};

const roleTone: Record<Member["role"], BadgeTone> = {
  Owner: "amber",
  Admin: "sky",
  Manager: "teal",
  Viewer: "neutral",
};

const members: Member[] = [
  {
    name: "Daniel Amir",
    email: "daniel@whatswhatsglobal.com",
    initials: "DA",
    avatar: "bg-amber-500/15 text-amber-300",
    role: "Owner",
    you: true,
    status: "Active",
    lastActive: "Just now",
    joined: "Jan 2025",
    actions: "none",
  },
  {
    name: "Lisa Kim",
    email: "lisa@whatswhatsglobal.com",
    initials: "LK",
    avatar: "bg-sky-500/15 text-sky-300",
    role: "Admin",
    status: "Active",
    lastActive: "2h ago",
    joined: "Feb 2025",
    actions: "edit",
  },
  {
    name: "Marcus O'Brien",
    email: "marcus@whatswhatsglobal.com",
    initials: "MO",
    avatar: "bg-teal-500/15 text-teal-300",
    role: "Manager",
    status: "Active",
    lastActive: "Yesterday",
    joined: "Mar 2025",
    actions: "edit",
  },
  {
    name: "Rachel Jones",
    email: "rachel.jones@clientco.com",
    initials: "RJ",
    avatar: "bg-violet-500/15 text-violet-300",
    role: "Viewer",
    status: "Pending",
    lastActive: "Invite sent",
    joined: "3d ago",
    actions: "invite",
  },
];

const roleRef: { role: Member["role"]; text: string }[] = [
  { role: "Owner", text: "Full access. Manage billing, users, all tests and reports. Cannot be removed." },
  { role: "Admin", text: "Manage users, create & share all tests, view all reports." },
  { role: "Manager", text: "Create & share assigned tests, view assigned reports only." },
  { role: "Viewer", text: "Read-only access to reports shared with them. No test creation." },
];

export default function Page() {
  return (
    <div style={JAKARTA_STYLE} className="space-y-6 text-slate-100">
      <PortalPageHeader
        title="Team Members"
        subtitle="Manage who has access to your workspace and what they can do."
        actions={
          <button type="button" className={primaryBtnClass} disabled>
            + Add new user
          </button>
        }
      />

      <PreviewBanner note="This roster is example data — there is no invite backend yet." />

      {/* Roster card */}
      <div className={`${cardClass} p-5`}>
        {/* Search + filters */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <input
            className={`${inputClass} max-w-xs`}
            placeholder="Search members…"
            disabled
          />
          <div className="flex items-center gap-2">
            <button type="button" className={ghostBtnClass} disabled>
              All roles
            </button>
            <button type="button" className={ghostBtnClass} disabled>
              All status
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#647789]">
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.email} className="border-b border-white/[0.05]">
                  {/* Member */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar initials={m.initials} color={m.avatar} />
                      <div>
                        <p className="flex items-center gap-2 text-[14px] font-semibold text-white">
                          {m.name}
                          {m.you && (
                            <span className="rounded-full border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-white/50">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-[12.5px] text-white/40">{m.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-4">
                    <Badge tone={roleTone[m.role]}>{m.role}</Badge>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-2 text-[13px] font-medium">
                      <span className={`h-2 w-2 rounded-full ${m.status === "Active" ? "bg-emerald-400" : "bg-amber-400"}`} />
                      <span className={m.status === "Active" ? "text-white/80" : "text-amber-400"}>
                        {m.status}
                      </span>
                    </span>
                  </td>

                  {/* Last active */}
                  <td className="px-4 py-4 text-[13px] text-white/50">{m.lastActive}</td>

                  {/* Joined */}
                  <td className="px-4 py-4 text-[13px] text-white/40">{m.joined}</td>

                  {/* Actions */}
                  <td className="px-4 py-4">
                    {m.actions === "edit" && (
                      <div className="flex items-center gap-2">
                        <button type="button" className={smallBtnClass} disabled>Edit</button>
                        <button type="button" className={smallBtnClass} disabled>Remove</button>
                      </div>
                    )}
                    {m.actions === "invite" && (
                      <div className="flex items-center gap-2">
                        <button type="button" className={smallBtnClass} disabled>Resend</button>
                        <button type="button" className={smallBtnClass} disabled>Revoke</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role permissions reference */}
      <div className={`${cardClass} p-6`}>
        <p className={`mb-4 ${sectionLabelClass}`}>Role permissions reference</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {roleRef.map((r) => (
            <div key={r.role} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <Badge tone={roleTone[r.role]}>{r.role}</Badge>
              <p className="mt-3 text-[12.5px] leading-relaxed text-white/50">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
