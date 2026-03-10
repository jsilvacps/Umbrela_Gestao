"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { CompanySettings } from "@/lib/types";
import { formatCnpj, formatPhone, nowIso } from "@/lib/utils";
import { doc, getDoc, setDoc } from "firebase/firestore";

const SETTINGS_DOC_ID = "main";

export default function SettingsPage() {
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
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

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
        setStatusMessage("Erro ao carregar configuração da empresa.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function handleChange(field: keyof CompanySettings, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setStatusMessage("");

    try {
      const payload: CompanySettings = {
        companyName: form.companyName || "",
        companyAddress: form.companyAddress || "",
        companyCnpj: form.companyCnpj || "",
        companyPhone: form.companyPhone || "",
        reportsPassword: form.reportsPassword || "",
        adminPassword: form.adminPassword || "",
        logoUrl: form.logoUrl || "",
        updatedAt: nowIso(),
      };

      setStatusMessage("Salvando dados da empresa...");
      await setDoc(doc(db, "settings", SETTINGS_DOC_ID), payload);

      setForm(payload);
      setStatusMessage("Configuração da empresa salva com sucesso.");
      alert("Configuração da empresa salva com sucesso.");
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        setStatusMessage(error.message);
        alert(error.message);
      } else {
        setStatusMessage("Erro ao salvar configuração da empresa.");
        alert("Erro ao salvar configuração da empresa.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="container">
        <Header />
        <div className="card">Carregando configuração da empresa...</div>
      </main>
    );
  }

  return (
    <main className="container">
      <Header />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="settings-submenu">
          <Link href="/admin/settings" className="settings-submenu-item active">
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
          <Link href="/admin/settings/passwords" className="settings-submenu-item">
            Senhas operacionais
          </Link>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="table-header">
            <div>
              <h3 style={{ margin: 0 }}>Configuração da empresa</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Dados gerais usados no painel e nos comprovantes.
              </p>
            </div>
          </div>

          <div className="grid">
            <div>
              <label>Nome da empresa</label>
              <input
                className="input"
                placeholder="Ex.: Hortifruti do Bairro"
                value={form.companyName}
                onChange={(e) => handleChange("companyName", e.target.value)}
              />
            </div>

            <div>
              <label>Endereço</label>
              <input
                className="input"
                placeholder="Rua, número, bairro, cidade"
                value={form.companyAddress}
                onChange={(e) => handleChange("companyAddress", e.target.value)}
              />
            </div>

            <div className="grid grid-2">
              <div>
                <label>CNPJ</label>
                <input
                  className="input"
                  placeholder="00.000.000/0000-00"
                  value={form.companyCnpj}
                  onChange={(e) => handleChange("companyCnpj", formatCnpj(e.target.value))}
                  maxLength={18}
                />
              </div>

              <div>
                <label>Telefone</label>
                <input
                  className="input"
                  placeholder="(00) 00000-0000"
                  value={form.companyPhone}
                  onChange={(e) => handleChange("companyPhone", formatPhone(e.target.value))}
                  maxLength={15}
                />
              </div>
            </div>

            <div>
              <label>URL da logo</label>
              <input
                className="input"
                placeholder="https://site.com/minha-logo.png"
                value={form.logoUrl || ""}
                onChange={(e) => handleChange("logoUrl", e.target.value)}
              />
              <div className="muted" style={{ marginTop: 6 }}>
                Cole o endereço completo da imagem da logo.
              </div>
            </div>

            {statusMessage ? (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb",
                }}
              >
                {statusMessage}
              </div>
            ) : null}

            <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar configuração da empresa"}
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Pré-visualização</h3>

          <div className="brand-preview">
            {form.logoUrl ? (
              <img src={form.logoUrl} alt="Logo da empresa" className="brand-preview-logo" />
            ) : (
              <div className="brand-preview-placeholder">Sem logo</div>
            )}

            <h2 style={{ marginTop: 16, marginBottom: 8 }}>
              {form.companyName || "Nome da empresa"}
            </h2>

            <p className="muted" style={{ textAlign: "center" }}>
              {form.companyAddress || "Endereço da empresa"}
            </p>
            <p className="muted" style={{ textAlign: "center" }}>
              {form.companyCnpj || "CNPJ"} {form.companyPhone ? `| ${form.companyPhone}` : ""}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}