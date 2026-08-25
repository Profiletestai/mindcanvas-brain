// apps/web/components/portal/ProgressBar.tsx
// Thin rounded progress track + fill used in usage strips, checklists, and metrics.

export function ProgressBar({
  value,
  color = "#54AFE0",
  height = "h-1.5",
  trackClass = "bg-white/[0.08]",
  className = "",
}: {
  // Fill percentage (0–100). Clamped.
  value: number;
  color?: string;
  // Track height utility (e.g. "h-1", "h-2").
  height?: string;
  // Track background utility.
  trackClass?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span
      className={`block ${height} overflow-hidden rounded-full ${trackClass} ${className}`}
    >
      <span
        className="block h-full rounded-full"
        style={{ width: `${pct}%`, background: color }}
      />
    </span>
  );
}
