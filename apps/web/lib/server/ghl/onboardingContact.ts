//apps/web/lib/server/ghl/onboardingContact.ts
type OnboardingGhlSyncResult = {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  message?: string;
};

type SyncOnboardingAccountArgs = {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function syncOnboardingAccountToGhl(
  args: SyncOnboardingAccountArgs
): Promise<OnboardingGhlSyncResult> {
  const endpoint =
    normalizeText(process.env.GHL_CONTACT_UPSERT_URL) ||
    "https://services.leadconnectorhq.com/contacts/upsert";

  const apiKey = normalizeText(process.env.GHL_API_KEY);
  const locationId = normalizeText(process.env.GHL_LOCATION_ID);
  const apiVersion =
    normalizeText(process.env.GHL_API_VERSION) || "2021-07-28";

  if (!apiKey || !locationId) {
    return {
      ok: false,
      skipped: true,
      message:
        "GHL onboarding sync skipped because GHL_API_KEY or GHL_LOCATION_ID is missing.",
    };
  }

  const email = normalizeText(args.email).toLowerCase();
  const firstName = normalizeText(args.firstName);
  const lastName = normalizeText(args.lastName);

  if (!email) {
    return {
      ok: false,
      skipped: true,
      message: "GHL onboarding sync skipped because the email is missing.",
    };
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  const tag =
    normalizeText(process.env.GHL_TAG_MINDCANVAS_ACCOUNT_CREATED) ||
    "MindCanvas_account_created";

  const payload = {
    locationId,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: fullName || undefined,
    email,
    tags: [tag],
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: apiVersion,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const rawResponse = await response.text();

    if (!response.ok) {
      console.error(
        `[ghl:onboarding] sync failed user_id=${args.userId} status=${response.status} response=${rawResponse}`
      );

      return {
        ok: false,
        status: response.status,
        message: `GHL onboarding sync failed with status ${response.status}.`,
      };
    }

    console.log(
      `[ghl:onboarding] contact synced user_id=${args.userId} email=${email}`
    );

    return {
      ok: true,
      status: response.status,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown GHL request error";

    console.error(
      `[ghl:onboarding] request failed user_id=${args.userId} error=${message}`
    );

    return {
      ok: false,
      message,
    };
  }
}