"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sale } from "@/lib/types";
import { dateTime, money } from "@/lib/format";

export default function ReceiptsReportPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    const q = query(collection(db, "sales"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Sale),
      }));
      setSales(list);
    });

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (!filterDate) return sales;

    return sales.filter((sale) => {
      const dt = new Date(sale.createdAt);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}` === filterDate;
    });
  }, [sales, filterDate]);

  const totalCash = filtered.filter((s) => s.paymentMethod === "cash").reduce((sum, s) => sum + s.total, 0);
  const totalPix = filtered.filter((s) => s.paymentMethod === "pix").reduce((sum, s) => sum + s.total, 0);
  const totalCard = filtered.filter((s) => s.paymentMethod === "card").reduce((sum, s) => sum + s.total, 0);
  const totalFiado = filtered.filter((s) => s.paymentMethod === "fiado").reduce((sum, s) => sum + s.total, 0);

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
            <h3 style={{ margin: 0 }}>Relatório de recebimentos</h3>
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
            <span>Total geral</span>
            <strong>{money(totalCash + totalPix + totalCard + totalFiado)}</strong>
          </div>

          <div className="row sales-actions">
            <button className="btn btn-secondary" type="button" onClick={() => window.print()}>
              Imprimir / PDF
            </button>
          </div>
        </div>

        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <div className="sales-summary-box">
            <span>Dinheiro</span>
            <strong>{money(totalCash)}</strong>
          </div>

          <div className="sales-summary-box">
            <span>PIX</span>
            <strong>{money(totalPix)}</strong>
          </div>

          <div className="sales-summary-box">
            <span>Cartão</span>
            <strong>{money(totalCard)}</strong>
          </div>

          <div className="sales-summary-box">
            <span>Fiado</span>
            <strong>{money(totalFiado)}</strong>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table modern-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Venda</th>
                <th>Cliente</th>
                <th>Operador</th>
                <th>Pagamento</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sale) => (
                <tr key={sale.id}>
                  <td>{dateTime(sale.createdAt)}</td>
                  <td>{sale.saleNumber}</td>
                  <td>{sale.customerName || "Consumidor"}</td>
                  <td>{sale.operatorName}</td>
                  <td>
                    {sale.paymentMethod}
                    {sale.cardType ? ` - ${sale.cardType}` : ""}
                  </td>
                  <td>{money(sale.total)}</td>
                </tr>
              ))}

              {!filtered.length ? (
                <tr>
                  <td colSpan={6}>Nenhum recebimento encontrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}