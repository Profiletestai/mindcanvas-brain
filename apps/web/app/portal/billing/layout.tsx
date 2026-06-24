import PortalChrome from "@/components/layout/PortalChrome";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PortalChrome>{children}</PortalChrome>;
}
