"use client";

import Header from "@/components/Header";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CompanySettings } from "@/lib/types";
import { hasAdminSession, saveAdminSession } from "@/lib/adminSession";
import Link from "next/link";

const SETTINGS_DOC_ID = "main";

export default function AdminPage() {
  const [companyName, setCompanyName] = useState("Horti Gestao");
  const [logoUrl, setLogoUrl] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const docRef = doc(db, "settings", SETTINGS_DOC_ID);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          const data = snapshot.data() as CompanySettings;
          setCompanyName(data.companyName || "Horti Gestao");
          setLogoUrl(data.logoUrl || "");

          const hasPassword = Boolean(data.adminPassword && data.adminPassword.trim());
          if (!hasPassword) {
            setAuthorized(true);
            saveAdminSession();
          } else {
            setAuthorized(hasAdminSession());
          }
        } else {
          setAuthorized(true);
          saveAdminSession();
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  async function handleAccess() {
    try {
      const snapshot = await getDoc(doc(db, "settings", SETTINGS_DOC_ID));

      if (!snapshot.exists()) {
        setAuthorized(true);
        saveAdminSession();
        return;
      }

      const data = snapshot.data() as CompanySettings;
      const savedPassword = data.adminPassword || "";

      if (!savedPassword.trim()) {
        setAuthorized(true);
        saveAdminSession();
        return;
      }

      if (adminPassword === savedPassword) {
        setAuthorized(true);
        saveAdminSession();
      } else {
        alert("Senha do ADM incorreta.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao validar acesso do ADM.");
    }
  }

  if (loading) {
    return (
      <main className="container">
        <Header />
        <div className="card">Carregando...</div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="container">
        <Header />

        <div className="card reports-access-card">
          <h3>Acesso ao ADM</h3>
          <p className="muted">Digite a senha do ADM para continuar.</p>

          <div className="grid" style={{ maxWidth: 420 }}>
            <div>
              <label>Senha do ADM</label>
              <input
                className="input"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAccess();
                }}
              />
            </div>

            <button className="btn btn-primary" type="button" onClick={handleAccess}>
              Entrar
            </button>
          </div>
        </div>
      </main>
    );
  }

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
            Área administrativa protegida do sistema.
          </p>

          <div className="grid grid-2" style={{ marginTop: 18 }}>
            <Link href="/admin/settings" className="admin-card-link">
              <div className="admin-icon-circle">CFG</div>
              <strong>Configuração da empresa</strong>
              <span className="muted">Empresa, logo e dados gerais</span>
            </Link>

            <Link href="/admin/settings/operators" className="admin-card-link">
              <div className="admin-icon-circle">OP</div>
              <strong>Operadores</strong>
              <span className="muted">Usuários do caixa</span>
            </Link>

            <Link href="/admin/settings/reports" className="admin-card-link">
              <div className="admin-icon-circle">R</div>
              <strong>Relatórios</strong>
              <span className="muted">Auditoria e consultas</span>
            </Link>

            <Link href="/admin/settings/labels" className="admin-card-link">
              <div className="admin-icon-circle">ET</div>
              <strong>Etiquetas</strong>
              <span className="muted">Impressão de preços</span>
            </Link>

            <Link href="/admin/settings/passwords" className="admin-card-link">
              <div className="admin-icon-circle">S</div>
              <strong>Senhas operacionais</strong>
              <span className="muted">ADM e relatórios</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}