"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { useEffect, useState } from "react";
import OperatorForm from "@/components/OperatorForm";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Operator } from "@/lib/types";

export default function OperatorsPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);

  useEffect(() => {
    const q = query(collection(db, "operators"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Operator),
      }));
      setOperators(list);
    });

    return () => unsubscribe();
  }, []);

  async function handleToggleActive(operator: Operator) {
    if (!operator.id) return;

    try {
      await updateDoc(doc(db, "operators", operator.id), {
        active: !operator.active,
      });

      alert(operator.active ? "Operador inativado." : "Operador ativado.");
    } catch (error) {
      console.error(error);
      alert("Erro ao alterar status do operador.");
    }
  }

  async function handleDeleteOperator(operator: Operator) {
    if (!operator.id) return;

    const ok = confirm(`Excluir o operador "${operator.name}"?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "operators", operator.id));
      if (editingOperator?.id === operator.id) {
        setEditingOperator(null);
      }
      alert("Operador excluído com sucesso.");
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir operador.");
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
          <Link href="/admin/settings/operators" className="settings-submenu-item active">
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
        <OperatorForm
          editingOperator={editingOperator}
          onSaved={() => setEditingOperator(null)}
          onCancelEdit={() => setEditingOperator(null)}
        />

        <div className="card">
          <div className="table-header">
            <div>
              <h3 style={{ margin: 0 }}>Operadores cadastrados</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Usuários com acesso somente ao caixa.
              </p>
            </div>

            <span className="badge-modern">
              {operators.length} {operators.length === 1 ? "operador" : "operadores"}
            </span>
          </div>

          <div className="table-wrap">
            <table className="table modern-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Usuário</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((operator) => (
                  <tr key={operator.id}>
                    <td>{operator.name}</td>
                    <td>{operator.username}</td>
                    <td>
                      {operator.active ? (
                        <span className="status-badge active">Ativo</span>
                      ) : (
                        <span className="status-badge blocked">Inativo</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-edit"
                          type="button"
                          onClick={() => setEditingOperator(operator)}
                        >
                          Editar
                        </button>

                        <button
                          className="btn btn-warning"
                          type="button"
                          onClick={() => handleToggleActive(operator)}
                        >
                          {operator.active ? "Inativar" : "Ativar"}
                        </button>

                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => handleDeleteOperator(operator)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}