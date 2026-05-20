export type SubAccountItem = {
  child_org_id: string;
  name: string | null;
  slug: string | null;
  org_status: string | null;
  relationship_status: string;
  payer_mode: "parent_paid" | "self_paid" | null;
  owner_email: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_phone: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

export type ListOk = { ok: true; items: SubAccountItem[] };
export type UpdateOk = { ok: true; child_org_id: string; status: string };
export type Err = { ok: false; error: string; status: number };

export type Action = "suspend" | "reactivate" | "archive";

export function isErr<T extends { ok: true }>(r: T | Err): r is Err {
  return r.ok === false;
}

export function humanError(code: string, action?: Action): string {
  switch (code) {
    case "invalid_transition":
      return action
        ? `Can't ${action} a sub-account in this state.`
        : "That action is not allowed on this sub-account.";
    case "child_not_found":
      return "Sub-account no longer exists.";
    case "forbidden":
      return "You don't have permission to manage sub-accounts for this organisation.";
    case "invalid_action":
      return "Unknown action.";
    default:
      return "Something went wrong. Try again.";
  }
}

export async function listSubAccounts(
  parentOrgId: string,
): Promise<ListOk | Err> {
  const res = await fetch(
    `/api/portal/sub-accounts?parentOrgId=${encodeURIComponent(parentOrgId)}`,
    { cache: "no-store", credentials: "include" },
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok === false) {
    return { ok: false, error: j?.error || `HTTP ${res.status}`, status: res.status };
  }
  return { ok: true, items: (j.items ?? []) as SubAccountItem[] };
}

export async function updateSubAccount(
  childOrgId: string,
  action: Action,
): Promise<UpdateOk | Err> {
  const res = await fetch(`/api/portal/sub-accounts/${childOrgId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok === false) {
    return { ok: false, error: j?.error || `HTTP ${res.status}`, status: res.status };
  }
  return {
    ok: true,
    child_org_id: j.child_org_id as string,
    status: j.status as string,
  };
}
