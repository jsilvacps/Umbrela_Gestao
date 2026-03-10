"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { CompanySettings } from "@/lib/types";
import { nowIso } from "@/lib/utils";
import { doc, getDoc, setDoc } from "firebase/firestore";

const SETTINGS_DOC_ID = "main";

export default function PasswordsPage() {
  const [form, setForm] = useState<CompanySettings>({
    companyName: "",
    companyAddress: "",
    companyCnpj: "",
    companyPhone: "",
    logoUrl: "",
    reportsPassword: "",
    adminPassword: "",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const docRef = doc(db, "settings", SETTINGS_DOC_ID);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          setForm(snapshot.data() as CompanySettings);
        }
      } catch (error) {
        console.error(error);
      }
    }

    loadSettings();
  }, []);

  async function handleSave() {
    setSaving(true);

    try {
      const payload: CompanySettings = {
        companyName: form.companyName || "",
        companyAddress: form.companyAddress || "",
        companyCnpj: form.companyCnpj || "",
        companyPhone: form.companyPhone || "",
        logoUrl: form.logoUrl || "",
        reportsPassword: form.reportsPassword || "",
        adminPassword: form.adminPassword || "",
        updatedAt: nowIso(),
      };

      await setDoc(doc(db, "settings", SETTINGS_DOC_ID), payload);
      alert("Senhas operacionais salvas com sucesso.");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar senhas operacionais.");
    } finally {
      setSaving(false);
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
          <Link href="/admin/settings/reports" className="settings-submenu-item">
            Relatórios
          </Link>
          <Link href="/admin/settings/labels" className="settings-submenu-item">
            Etiquetas
          </Link>
          <Link href="/admin/settings/passwords" className="settings-submenu-item active">
            Senhas operacionais
          </Link>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="table-header">
            <div>
              <h3 style={{ margin: 0 }}>Senhas operacionais</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Controle de acesso do sistema.
              </p>
            </div>
          </div>

          <div className="grid">
            <div>
              <label>Senha do ADM</label>
              <input
                className="input"
                type="password"
                placeholder="Crie ou altere a senha do ADM"
                value={form.adminPassword || ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, adminPassword: e.target.value }))
                }
              />
            </div>

            <div>
              <label>Senha dos relatórios</label>
              <input
                className="input"
                type="password"
                placeholder="Crie ou altere a senha dos relatórios"
                value={form.reportsPassword || ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, reportsPassword: e.target.value }))
                }
              />
            </div>

            <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar senhas operacionais"}
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Como funciona</h3>

          <div className="grid">
            <div className="sales-summary-box">
              <span>Senha do ADM</span>
              <strong>Protege a entrada no menu ADM</strong>
            </div>

            <div className="sales-summary-box">
              <span>Senha dos relatórios</span>
              <strong>Protege a consulta dos relatórios</strong>
            </div>

            <div className="muted">
              No primeiro acesso, se a senha estiver vazia, a entrada permanece liberada.
              Depois que uma senha for salva, o sistema passa a exigir autenticação.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}