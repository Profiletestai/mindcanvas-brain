// apps/web/app/portal/[slug]/tests/page.tsx
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type TestsPageProps = {
  params: {
    slug: string;
  };
};

export default async function TestsPage({ params }: TestsPageProps) {
  const { slug } = params;

  // ✅ We now use the Links page as the primary "Tests" experience (screenshot 2)
  redirect(`/portal/${encodeURIComponent(slug)}/links`);
}

