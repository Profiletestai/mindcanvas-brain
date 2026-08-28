// apps/web/app/portal/[slug]/profile/page.tsx
// Profile → Personal details (mockup: no self-service user edit endpoint yet).
import PersonalDetailsClient from "./PersonalDetailsClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return <PersonalDetailsClient />;
}
