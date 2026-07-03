// apps/web/components/portal/FormStatus.tsx
// Inline error / success banners shared by portal settings forms.

export function FormStatus({
  error,
  saved,
  savedMessage = "Changes saved.",
}: {
  error?: string | null;
  saved?: boolean;
  savedMessage?: string;
}) {
  if (error) {
    return (
      <div className="mb-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-[13px] text-red-200">
        {error}
      </div>
    );
  }
  if (saved) {
    return (
      <div className="mb-5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-[13px] text-emerald-200">
        {savedMessage}
      </div>
    );
  }
  return null;
}
