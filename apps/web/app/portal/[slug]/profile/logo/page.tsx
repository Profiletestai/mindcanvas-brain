import BrandingClient from "./BrandingClient";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BrandingClient slug={slug} />;
}
