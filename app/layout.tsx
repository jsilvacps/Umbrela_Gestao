import "../src/app/globals.css";

export const metadata = {
  title: "Horti Gestão",
  description: "Sistema PDV para hortifruti",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="app-shell">{children}</body>
    </html>
  );
}
