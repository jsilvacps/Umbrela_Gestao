import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Umbrela Master",
  description: "Painel de gestão de clientes e feature flags",
  manifest: "/master-manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Master",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
};

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
