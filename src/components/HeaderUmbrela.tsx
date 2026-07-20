"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { db } from "@/lib/supabaseClient";

const PAGES_WITH_BACK = ["/produtos", "/clientes", "/relatorios", "/vendas", "/dashboard", "/painel"];

export default function HeaderUmbrela() {
  const [nome, setNome]       = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const router   = useRouter();
  const pathname = usePathname();

  const showBack = pathname ? PAGES_WITH_BACK.some((p) => pathname === p || pathname.startsWith(p + "/")) : false;

  useEffect(() => {
    db("empresa")
      .select("nome_fantasia, logo_url")
      .maybeSingle()
      .then(({ data }: { data: { nome_fantasia?: string; logo_url?: string } | null }) => {
        if (data) {
          setNome(data.nome_fantasia || "");
          setLogoUrl(data.logo_url || null);
        }
      });
  }, []);

  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 14,
      marginBottom: 20, padding: "10px 16px",
      background: "#fff", borderRadius: 12,
      border: "1px solid #e2e8f0",
      boxShadow: "0 1px 4px rgba(0,0,0,.06)",
    }}>
      {showBack && (
        <button
          onClick={() => router.push("/adm")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 14px", borderRadius: 10,
            border: "1px solid #d5dde7", background: "#f8fafc",
            color: "#1d3049", fontWeight: 800, fontSize: 14,
            cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          ← ADM
        </button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl || "/logo.svg"}
        alt="Logo"
        style={{ height: 40, objectFit: "contain", borderRadius: 6 }}
      />
      <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>
        {nome || "Umbrela Gestão"}
      </div>
    </header>
  );
}
