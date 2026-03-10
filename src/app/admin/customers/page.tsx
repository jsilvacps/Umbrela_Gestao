"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import CustomerForm from "@/components/CustomerForm";
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
import { Customer } from "@/lib/types";
import { money } from "@/lib/format";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const q = query(collection(db, "customers"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Customer),
      }));
      setCustomers(list);
    });

    return () => unsubscribe();
  }, []);

  async function handleDeleteCustomer(customer: Customer) {
    if (!customer.id) return;

    const ok = confirm(`Excluir o cliente "${customer.name}"?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "customers", customer.id));
      if (editingCustomer?.id === customer.id) {
        setEditingCustomer(null);
      }
      alert("Cliente excluído com sucesso.");
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir cliente.");
    }
  }

  async function handleToggleBlock(customer: Customer) {
    if (!customer.id) return;

    try {
      await updateDoc(doc(db, "customers", customer.id), {
        blocked: !customer.blocked,
      });

      alert(customer.blocked ? "Cliente desbloqueado." : "Cliente bloqueado.");
    } catch (error) {
      console.error(error);
      alert("Erro ao alterar bloqueio do cliente.");
    }
  }

  return (
    <main className="container">
      <Header />

      <div className="grid grid-2">
        <CustomerForm
          editingCustomer={editingCustomer}
          onSaved={() => setEditingCustomer(null)}
          onCancelEdit={() => setEditingCustomer(null)}
        />

        <div className="card">
          <div className="table-header">
            <div>
              <h3 style={{ margin: 0 }}>Clientes cadastrados</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Controle de cadastro, crédito e status do cliente.
              </p>
            </div>

            <span className="badge-modern">
              {customers.length} {customers.length === 1 ? "cliente" : "clientes"}
            </span>
          </div>

          <div className="table-wrap">
            <table className="table modern-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Cidade</th>
                  <th>Limite</th>
                  <th>Saldo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{customer.name}</div>
                      <div className="muted">{customer.cpf || "-"}</div>
                    </td>
                    <td>{customer.phone || "-"}</td>
                    <td>{customer.city || "-"}</td>
                    <td>{money(customer.creditLimit || 0)}</td>
                    <td>{money(customer.availableCredit || 0)}</td>
                    <td>
                      {customer.blocked ? (
                        <span className="status-badge blocked">Bloqueado</span>
                      ) : (
                        <span className="status-badge active">Ativo</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-edit"
                          type="button"
                          onClick={() => setEditingCustomer(customer)}
                        >
                          Editar
                        </button>

                        <button
                          className="btn btn-warning"
                          type="button"
                          onClick={() => handleToggleBlock(customer)}
                        >
                          {customer.blocked ? "Desbloquear" : "Bloquear"}
                        </button>

                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => handleDeleteCustomer(customer)}
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