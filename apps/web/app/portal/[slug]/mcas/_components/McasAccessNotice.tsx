// apps/web/app/portal/[slug]/mcas/_components/McasAccessNotice.tsx
// Rendered when requirePortalOrgAccess turns a page request down.

import type { PortalAccessFailure } from "@/lib/portal/authz";

export default function McasAccessNotice({
  failure,
}: {
  failure: PortalAccessFailure;
}) {
  const heading =
    failure.code === "test_access_revoked"
      ? "MCAS is not on your plan"
      : failure.code === "test_not_configured"
        ? "MCAS is not available yet"
        : "Not available";

  return (
    <div className="p-6">
      <div className="max-w-xl rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-gray-900">{heading}</h1>

        <p className="mt-2 text-sm text-gray-600">{failure.error}</p>

        {failure.code === "test_access_revoked" ? (
          <p className="mt-4 text-sm text-gray-500">
            Contact your account owner to add the People engine to this
            organisation.
          </p>
        ) : null}
      </div>
    </div>
  );
}
