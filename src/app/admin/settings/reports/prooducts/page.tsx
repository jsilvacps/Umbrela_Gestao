"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Product } from "@/lib/types";
import { money } from "@/lib/format";

export default function ProductsReportPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Product),
      }));
      setProducts(list);
    });

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;

    return products.filter((item) => {
      return (
        item.name.toLowerCase().includes(term) ||
        item.internalCode.toLowerCase().includes(term) ||
        (item.eanCode || "").toLowerCase().includes(term) ||
        (item.category || "").toLowerCase().includes(term)
      );
    });
  }, [products, searchTerm]);

  return (
    <main className="container">
      <Header />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="settings-submenu">
          <Link href="/admin/settings/reports" className="settings-submenu-item">
            Voltar aos relatórios
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="table-header no-print">
          <div>
            <h3 style={{ margin: 0 }}>Relatório de itens cadastrados</h3>
          </div>
        </div>

        <div className="grid grid-3 no-print" style={{ marginBottom: 16 }}>
          <div>
            <label>Pesquisar item</label>
            <input
              className="input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome, código, EAN, categoria..."
            />
          </div>

          <div className="sales-summary-box">
            <span>Total de itens</span>
            <strong>{filtered.length}</strong>
          </div>

          <div className="row sales-actions">
            <button className="btn btn-secondary" type="button" onClick={() => window.print()}>
              Imprimir / PDF
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table modern-table">
            <thead>
              <tr>
                <th>Cód. interno</th>
                <th>EAN</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Unidade</th>
                <th>Custo</th>
                <th>Dinheiro</th>
                <th>Cartão</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.internalCode}</td>
                  <td>{item.eanCode || "-"}</td>
                  <td>{item.name}</td>
                  <td>{item.category || "-"}</td>
                  <td>{item.unitType || "-"}</td>
                  <td>{money(item.costPrice || 0)}</td>
                  <td>{money(item.priceCash || 0)}</td>
                  <td>{money(item.priceCard || 0)}</td>
                  <td>{item.active ? "Ativo" : "Inativo"}</td>
                </tr>
              ))}

              {!filtered.length ? (
                <tr>
                  <td colSpan={9}>Nenhum item cadastrado encontrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}