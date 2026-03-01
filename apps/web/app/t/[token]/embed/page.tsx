// apps/web/app/t/[token]/embed/page.tsx
import PublicTestClient from "../PublicTestClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page({ params }: { params: { token: string } }) {
  return (
    <div className="w-full">
      {/* This wrapper creates the same “block” feel */}
      <div className="mx-auto max-w-5xl px-0 py-0">
        <PublicTestClient token={params.token} embed />
      </div>
    </div>
  );
}