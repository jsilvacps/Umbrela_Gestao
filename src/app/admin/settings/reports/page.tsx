"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { CompanySettings } from "@/lib/types";
import { doc, getDoc } from "firebase/firestore";

const SETTINGS_DOC_ID = "main";

export default function ReportsHomePage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [accessPassword, setAccessPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const snapshot = await getDoc(doc(db, "settings", SETTINGS_DOC_ID));
      if (snapshot.exists()) {
        const data = snapshot.data() as CompanySettings;
        setSettings(data);

        if (!data.reportsPassword?.trim()) {
          setAuthorized(true);
        }
      } else {
        setAuthorized(true);
      }
    }

    loadSettings();
  }, []);

  function handleAccess() {
    if (!settings?.reportsPassword?.trim()) {
      setAuthorized(true);
      return;
    }

    if (accessPassword === settings.reportsPassword) {
      setAuthorized(true);
    } else {
      alert("Senha incorreta.");
    }
  }

  return (
    <main className="container">
      <Header />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="settings-submenu">
          <Link href="/admin/settings" className="settings-submenu-item">
            Configuração da empresa
          </Link>
          <Link href="/admin/settings/operators" className="settings-submenu-item">
            Operadores
          </Link>
          <Link href="/admin/settings/reports" className="settings-submenu-item active">
            Relatórios
          </Link>
          <Link href="/admin/settings/labels" className="settings-submenu-item">
            Etiquetas
          </Link>
          <Link href="/admin/settings/passwords" className="settings-submenu-item">
            Senhas operacionais
          </Link>
        </div>
      </div>

      {!authorized ? (
        <div className="card reports-access-card">
          <h3>Acesso aos relatórios</h3>
          <p className="muted">Digite a senha cadastrada em Senhas operacionais.</p>

          <div className="grid" style={{ maxWidth: 420 }}>
            <div>
              <label>Senha</label>
              <input
                className="input"
                type="password"
                value={accessPassword}
                onChange={(e) => setAccessPassword(e.target.value)}
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
      ) : (
        <div className="card">
          <div className="table-header">
            <div>
              <h3 style={{ margin: 0 }}>Relatórios</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Escolha o relatório que deseja consultar.
              </p>
            </div>
          </div>

          <div className="grid grid-2">
            <Link href="/admin/settings/reports/canceled-coupons" className="admin-card-link">
              <div className="admin-icon-circle">CC</div>
              <strong>Cupons cancelados</strong>
              <span className="muted">Motivos, operador e valores</span>
            </Link>

            <Link href="/admin/settings/reports/canceled-items" className="admin-card-link">
              <div className="admin-icon-circle">IC</div>
              <strong>Itens cancelados</strong>
              <span className="muted">Itens removidos antes da finalização</span>
            </Link>

            <Link href="/admin/settings/reports/cash-closures" className="admin-card-link">
              <div className="admin-icon-circle">FC</div>
              <strong>Fechamentos de caixa</strong>
              <span className="muted">Abertura, fechamento e diferenças</span>
            </Link>

            <Link href="/admin/settings/reports/receipts" className="admin-card-link">
              <div className="admin-icon-circle">RC</div>
              <strong>Recebimentos</strong>
              <span className="muted">Dinheiro, cartão, PIX e fiado</span>
            </Link>

            <Link href="/admin/settings/reports/products" className="admin-card-link">
              <div className="admin-icon-circle">PC</div>
              <strong>Itens cadastrados</strong>
              <span className="muted">Produtos, preços e status</span>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}