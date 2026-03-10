"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CompanySettings } from "@/lib/types";

const SETTINGS_DOC_ID = "main";

export default function Header() {
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
    <div className="admin-shell-header">
      <div className="admin-brand">
        <div className="admin-brand-logo">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="admin-brand-logo-img" />
          ) : (
            <span>HG</span>
          )}
        </div>

        <div>
          <strong>{companyName}</strong>
          <div className="muted">Gestão do sistema</div>
        </div>
      </div>

      <div className="admin-toolbar">
        <Link href="/" className="toolbar-item">
          Home
        </Link>

        <Link href="/admin/products" className="toolbar-item">
          Produtos
        </Link>

        <Link href="/admin/customers" className="toolbar-item">
          Clientes
        </Link>

        <Link href="/admin/sales" className="toolbar-item">
          Vendas
        </Link>

        <Link href="/admin" className="toolbar-item">
          ADM
        </Link>

        <a
          href="/cash-login"
          target="_blank"
          rel="noopener noreferrer"
          className="toolbar-item toolbar-highlight"
        >
          Caixa
        </a>
      </div>
    </div>
  );
}