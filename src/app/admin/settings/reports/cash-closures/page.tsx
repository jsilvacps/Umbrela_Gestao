"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CashSession } from "@/lib/types";
import { dateTime, money } from "@/lib/format";

export default function CashClosuresPage() {
  const [items, setItems] = useState<CashSession[]>([]);
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "cash_sessions"), (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as CashSession),
      }));

      list.sort((a, b) => {
        const aTime = a.closedAt ? new Date(a.closedAt).getTime() : 0;
        const bTime = b.closedAt ? new Date(b.closedAt).getTime() : 0;
        return bTime - aTime;
      });

      setItems(list.filter((item) => item.status === "closed"));
    });

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (!filterDate) return items;

    return items.filter((item) => {
      if (!item.closedAt) return false;
      const dt = new Date(item.closedAt);
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
            <h3 style={{ margin: 0 }}>Relatório de fechamento de caixa</h3>
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
            <span>Total de fechamentos</span>
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
                <th>Operador</th>
                <th>Abertura</th>
                <th>Fechamento</th>
                <th>Saldo inicial</th>
                <th>Dinheiro</th>
                <th>PIX</th>
                <th>Cartão</th>
                <th>Fiado</th>
                <th>Retiradas</th>
                <th>Bandeja</th>
                <th>Diferença</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.operatorName}</td>
                  <td>{dateTime(item.openedAt)}</td>
                  <td>{item.closedAt ? dateTime(item.closedAt) : "-"}</td>
                  <td>{money(item.openingAmount || 0)}</td>
                  <td>{money(item.totalSalesCash || 0)}</td>
                  <td>{money(item.totalSalesPix || 0)}</td>
                  <td>{money(item.totalSalesCard || 0)}</td>
                  <td>{money(item.totalSalesFiado || 0)}</td>
                  <td>{money(item.totalWithdrawals || 0)}</td>
                  <td>{money(item.trayAmount || 0)}</td>
                  <td>
                    {item.differenceType === "matched"
                      ? "Conferido"
                      : item.differenceType === "short"
                      ? `Falta ${money(Math.abs(item.differenceAmount || 0))}`
                      : item.differenceType === "over"
                      ? `Sobra ${money(item.differenceAmount || 0)}`
                      : "-"}
                  </td>
                </tr>
              ))}

              {!filtered.length ? (
                <tr>
                  <td colSpan={11}>Nenhum fechamento encontrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}