export type CreateSubAccountBody = {
  parent_org_id: string;
  org_name: string;
  org_slug?: string;
  country_code: string;
  website?: string | null;
  industry?: string | null;
  owner_first_name: string;
  owner_last_name: string;
  owner_email: string;
  owner_phone?: string | null;
  payer_mode: "parent_paid" | "self_paid";
  tier: 1;
};

export type CreateSubAccountSuccess = {
  ok: true;
  child_org_id: string;
  org_slug: string;
  status: "active" | "pending_activation";
};

export type ApiErr = {
  ok: false;
  error: string;
  field?: string;
};

export const subAccountsApi = {
  create: async (
    body: CreateSubAccountBody,
  ): Promise<CreateSubAccountSuccess | ApiErr> => {
    const res = await fetch("/api/portal/sub-accounts/create", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  },
};

export function isErr<T extends { ok: true }>(
  r: T | ApiErr,
): r is ApiErr {
  return r.ok === false;
}

export function humanError(code: string, field?: string): string {
  switch (code) {
    case "slug_taken":
      return "That slug is already taken. Pick a different one.";
    case "parent_archived":
      return "Parent organisation is archived. Restore it before creating sub-accounts.";
    case "parent_not_found":
      return "Parent organisation not found.";
    case "tier_definition_missing":
      return "Tier configuration is missing. Contact support.";
    case "forbidden":
      return "You don't have permission to create sub-accounts for this org.";
    case "org_not_found_or_no_access":
      return "You don't have access to that organisation.";
    case "invalid_payer_mode":
      return "Invalid payer mode.";
    default:
      if (field) return `${code} (${field})`;
      return code || "Something went wrong.";
  }
}
