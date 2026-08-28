// apps/web/components/portal/Avatar.tsx
// Circular initials avatar used in rosters, activity feeds, and top-profile lists.
import { avatarColor, initials as toInitials } from "./ui";

const SIZE: Record<8 | 9, string> = {
  8: "h-8 w-8",
  9: "h-9 w-9",
};

export function Avatar({
  name,
  initials,
  color,
  size = 9,
  className = "",
}: {
  // Seed name — drives initials + colour unless overridden.
  name?: string;
  // Explicit initials override.
  initials?: string;
  // Explicit colour classes (e.g. "bg-sky-500/20 text-sky-300").
  color?: string;
  size?: 8 | 9;
  className?: string;
}) {
  const seed = name ?? initials ?? "";
  const text = initials ?? toInitials(seed);
  const colorClass = color ?? avatarColor(seed);
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${SIZE[size]} ${colorClass} ${className}`}
    >
      {text}
    </span>
  );
}
