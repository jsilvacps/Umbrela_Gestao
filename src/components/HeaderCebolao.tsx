"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/supabaseClient";

export default function HeaderCebolao() {
  const [nome, setNome]     = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" style={{ height: 40, objectFit: "contain", borderRadius: 6 }} />
      ) : (
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: "#f0fdf4", border: "1px solid #bbf7d0",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
        }}>🛒</div>
      )}
      <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>
        {nome || "Horti Gestão"}
      </div>
    </header>
  );
}
