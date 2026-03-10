"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CompanySettings } from "@/lib/types";

const SETTINGS_DOC_ID = "main";

export default function AdminPage() {
  const [companyName, setCompanyName] = useState("Horti Gestao");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const docRef = doc(db, "settings", SETTINGS_DOC_ID);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          const data = snapshot.data() as CompanySettings;
          setCompanyName(data.companyName || "Horti Gestao");
          setLogoUrl(data.logoUrl || "");
        }
      } catch (error) {
        console.error(error);
      }
    }

    loadSettings();
  }, []);

  return (
    <main className="container">
      <Header />

      <div className="admin-hero card">
        <div className="admin-hero-left">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da empresa" className="hero-logo" />
          ) : (
            <div className="hero-logo-placeholder">Logo</div>
          )}
        </div>

        <div className="admin-hero-right">
          <h1 style={{ marginBottom: 8 }}>{companyName}</h1>
          <p className="muted" style={{ fontSize: 15 }}>
            Soluções inteligentes para gestão do seu hortifruti.
          </p>

          <div className="grid grid-3" style={{ marginTop: 18 }}>
            <Link href="/admin/products" className="admin-card-link">
              <div className="admin-icon-circle">P</div>
              <strong>Produtos</strong>
              <span className="muted">Cadastro e preços</span>
            </Link>

            <Link href="/admin/customers" className="admin-card-link">
              <div className="admin-icon-circle">C</div>
              <strong>Clientes</strong>
              <span className="muted">Fiado e cadastro</span>
            </Link>

            <Link href="/admin/sales" className="admin-card-link">
              <div className="admin-icon-circle">V</div>
              <strong>Vendas</strong>
              <span className="muted">Histórico e consulta</span>
            </Link>

            <Link href="/admin/labels" className="admin-card-link">
              <div className="admin-icon-circle">E</div>
              <strong>Etiquetas</strong>
              <span className="muted">Impressão de preços</span>
            </Link>

            <Link href="/admin/settings" className="admin-card-link">
              <div className="admin-icon-circle">CFG</div>
              <strong>Configurações</strong>
              <span className="muted">Empresa e logo</span>
            </Link>

            <a
              href="/checkout"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-card-link"
            >
              <div className="admin-icon-circle">CX</div>
              <strong>Frente de caixa</strong>
              <span className="muted">Abre em nova aba</span>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}