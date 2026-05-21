const KEY = "sub_account_draft_v1";
const PARENT_KEY = "sub_account_parent_v1";
const PARENT_SLUG_KEY = "sub_account_parent_slug_v1";

export type Draft = {
  org_name?: string;
  country_code?: string;
  website?: string;
  industry?: string;
  owner_first_name?: string;
  owner_last_name?: string;
  owner_email?: string;
  owner_phone?: string;
  payer_mode?: "parent_paid" | "self_paid";
};

export function loadDraft(): Draft {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Draft) : {};
  } catch {
    return {};
  }
}

export function saveDraft(patch: Partial<Draft>) {
  if (typeof window === "undefined") return;
  const current = loadDraft();
  const next = { ...current, ...patch };
  sessionStorage.setItem(KEY, JSON.stringify(next));
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem(PARENT_KEY);
  sessionStorage.removeItem(PARENT_SLUG_KEY);
}

export function setParentOrgIdFromQuery(qs: URLSearchParams | null) {
  if (typeof window === "undefined" || !qs) return;
  const id = qs.get("parentOrgId");
  if (id) sessionStorage.setItem(PARENT_KEY, id);
  const slug = qs.get("parentOrgSlug");
  if (slug) sessionStorage.setItem(PARENT_SLUG_KEY, slug);
}

export function getParentOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PARENT_KEY);
}

export function getParentOrgSlug(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PARENT_SLUG_KEY);
}
