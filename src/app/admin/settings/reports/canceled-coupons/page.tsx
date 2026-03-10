"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CanceledCoupon } from "@/lib/types";
import { dateTime, money } from "@/lib/format";

export default function CanceledCouponsPage() {
  const [items, setItems] = useState<CanceledCoupon[]>([]);
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "canceled_coupons"), (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as CanceledCoupon),
      }));

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(list);
    });

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (!filterDate) return items;

    return items.filter((item) => {
      const dt = new Date(item.createdAt);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}` === filterDate;
    });
  }, [items, filterDate]);

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
            <h3 style={{ margin: 0 }}>Relatório de cupons cancelados</h3>
          </div>
        </div>

        <div className="grid grid-3 no-print" style={{ marginBottom: 16 }}>
          <div>
            <label>Filtrar por dia</label>
            <input
              className="input"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>

          <div className="sales-summary-box">
            <span>Total de cupons cancelados</span>
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
                <th>Data</th>
                <th>Operador</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Motivo</th>
                <th>Operação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{dateTime(item.createdAt)}</td>
                  <td>{item.operatorName}</td>
                  <td>{item.customerName || "Sem cliente"}</td>
                  <td>{money(item.total)}</td>
                  <td>{item.reason}</td>
                  <td>{item.operationId}</td>
                </tr>
              ))}

              {!filtered.length ? (
                <tr>
                  <td colSpan={6}>Nenhum cupom cancelado encontrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}