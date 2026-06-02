//apps/web/app/admin/mcas/layout.tsx
import McasAdminShell from "@/components/admin/mcas/McasAdminShell";

export default function McasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <McasAdminShell>{children}</McasAdminShell>;
}