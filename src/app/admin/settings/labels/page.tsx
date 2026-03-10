"use client";

import Header from "@/components/Header";
import Link from "next/link";

export default function LabelsSettingsPage() {
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
          <Link href="/admin/settings/labels" className="settings-submenu-item active">
            Etiquetas
          </Link>
          <Link href="/admin/settings/passwords" className="settings-submenu-item">
            Senhas operacionais
          </Link>
        </div>
      </div>

      <div className="card">
        <h3>Etiquetas</h3>
        <p className="muted">
          Esta área pode concentrar a configuração e impressão de etiquetas.
        </p>
        <p className="muted">
          No próximo passo eu posso organizar a tela de etiquetas já dentro deste padrão ADM.
        </p>
      </div>
    </main>
  );
}