'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import HeaderCebolao from "@/components/HeaderCebolao";
import { db } from "@/lib/supabaseClient";

type Operador = {
  username: string;
  nome?: string | null;
};

type Empresa = {
  nome_fantasia?: string | null;
  logo_url?: string | null;
};

type CardItem = {
  href: string;
  title: string;
  subtitle: string;
  sigla: string;
};

export default function HomePage() {
  const [operador, setOperador] = useState<Operador | null>(null);
  const [empresa, setEmpresa] = useState<Empresa>({});

  const carregarEmpresa = useCallback(async () => {
    const { data } = await db("empresa")
      .select("nome_fantasia, logo_url")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setEmpresa(data as Empresa);
  }, []);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem("operador_logado") : null;
    if (raw) {
      try {
        setOperador(JSON.parse(raw));
      } catch {}
    }
    // HeaderCebolao já carrega a empresa — não duplicamos a query aqui
  }, [carregarEmpresa]);

  function sair() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("operador_logado");
      window.location.href = "/login";
    }
  }

  const nomeEmpresa = useMemo(() => {
    const nome = String(empresa.nome_fantasia || "").trim();
    return nome ? nome.toUpperCase() : "";
  }, [empresa.nome_fantasia]);

  const cards: CardItem[] = [
    { href: "/produtos",      title: "Produtos",        subtitle: "Cadastro e preços",      sigla: "P"   },
    { href: "/clientes",      title: "Clientes",        subtitle: "Fiado e cadastro",        sigla: "C"   },
    { href: "/vendas",        title: "Vendas",          subtitle: "Histórico e consulta",    sigla: "V"   },
    { href: "/etiquetas",     title: "Etiquetas",       subtitle: "Impressão de preços",     sigla: "E"   },
    { href: "/adm",           title: "Configurações",   subtitle: "Empresa e logo",          sigla: "CFG" },
    { href: "/pdv",           title: "Frente de caixa", subtitle: "Abre em nova aba",        sigla: "CX"  },
  ];

  return (
    <main className="page-main" style={{ minHeight: "100vh", background: "#f3f5f7", padding: 12 }}>
      <div style={{ maxWidth: 1460, margin: "0 auto" }}>
        <HeaderCebolao />

        <section style={heroCard}>
          <div className="hero-grid" style={heroGrid}>
            <div className="hero-logo-pane" style={logoPane}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={empresa.logo_url || "/logo.svg"}
                alt="Logo da empresa"
                style={heroLogoImage}
              />
            </div>

            <div style={contentPane}>
              <div style={heroTitle}>{nomeEmpresa || "HORTI GESTÃO"}</div>
              <div style={heroSubtitle}>Soluções inteligentes para gestão do seu hortifruti.</div>

              {operador ? (
                <div style={operadorBadge}>Operador logado: {operador.nome || operador.username}</div>
              ) : null}

              <div className="cards-grid" style={cardsGrid}>
                {cards.map((card) => {
                  const openNewTab = card.href === "/pdv";
                  return (
                    <Link
                      href={card.href}
                      target={openNewTab ? "_blank" : undefined}
                      rel={openNewTab ? "noreferrer" : undefined}
                      key={card.href}
                      style={cardLink}
                    >
                      <div style={iconBadge}>{card.sigla}</div>
                      <div style={cardTitle}>{card.title}</div>
                      <div style={cardSubtitle}>{card.subtitle}</div>
                    </Link>
                  );
                })}
              </div>

              <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {!operador ? (
                  <Link href="/login" style={btnDark}>Entrar</Link>
                ) : (
                  <button onClick={sair} style={{ ...btnDark, border: "none", cursor: "pointer" }}>Sair</button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

const heroCard: React.CSSProperties = {
  background: "linear-gradient(90deg, rgba(255,248,241,1) 0%, rgba(255,255,255,1) 35%, rgba(236,248,240,1) 100%)",
  borderRadius: 28,
  border: "1px solid #e5e7eb",
  boxShadow: "0 10px 30px rgba(15,23,42,.04)",
  padding: 24,
};

const heroGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "280px 1fr",
  gap: 28,
  alignItems: "center",
};

const logoPane: React.CSSProperties = {
  minHeight: 400,
  display: "grid",
  placeItems: "center",
};

const heroLogoImage: React.CSSProperties = {
  maxWidth: "100%",
  maxHeight: 320,
  objectFit: "contain",
  filter: "drop-shadow(0 8px 18px rgba(15,23,42,.08))",
};

const heroLogoFallback: React.CSSProperties = {
  width: 240,
  height: 240,
  borderRadius: 28,
  border: "1px dashed #b8c3d1",
  display: "grid",
  placeItems: "center",
  background: "#fff",
  color: "#1fb14e",
  fontWeight: 900,
  fontSize: 36,
};

const contentPane: React.CSSProperties = {
  minWidth: 0,
};

const heroTitle: React.CSSProperties = {
  fontSize: 34,
  lineHeight: 1.05,
  fontWeight: 900,
  color: "#10243d",
};

const heroSubtitle: React.CSSProperties = {
  color: "#66758a",
  fontSize: 17,
  marginTop: 14,
  marginBottom: 18,
};

const operadorBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 999,
  background: "#fff",
  border: "1px solid #e2e8f0",
  color: "#223042",
  fontWeight: 700,
  marginBottom: 18,
};

const cardsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
  gap: 18,
};

const cardLink: React.CSSProperties = {
  textDecoration: "none",
  background: "#fff",
  border: "1px solid #dde3ea",
  borderRadius: 24,
  padding: 18,
  minHeight: 138,
  boxShadow: "0 8px 24px rgba(15,23,42,.05)",
};

const iconBadge: React.CSSProperties = {
  width: 50,
  height: 50,
  borderRadius: 16,
  background: "linear-gradient(135deg, #25c15c 0%, #e78d21 100%)",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontSize: 18,
  fontWeight: 900,
  boxShadow: "0 10px 18px rgba(34, 197, 94, 0.18)",
};

const cardTitle: React.CSSProperties = {
  marginTop: 14,
  fontSize: 17,
  fontWeight: 800,
  color: "#11243d",
};

const cardSubtitle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 15,
  color: "#66758a",
};

const btnDark: React.CSSProperties = {
  textDecoration: "none",
  background: "#343b44",
  color: "#fff",
  padding: "12px 16px",
  borderRadius: 16,
  fontWeight: 800,
};
