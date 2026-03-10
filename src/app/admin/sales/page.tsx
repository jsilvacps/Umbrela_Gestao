"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sale } from "@/lib/types";
import { dateTime, money } from "@/lib/format";
import { formatCpf } from "@/lib/utils";

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filterDate, setFilterDate] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const q = query(collection(db, "sales"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Sale),
      }));
      setSales(list);
    });

    return () => unsubscribe();
  }, []);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const saleDate = new Date(sale.createdAt);
      const yyyy = saleDate.getFullYear();
      const mm = String(saleDate.getMonth() + 1).padStart(2, "0");
      const dd = String(saleDate.getDate()).padStart(2, "0");
      const normalizedDate = `${yyyy}-${mm}-${dd}`;

      const matchDate = !filterDate || normalizedDate === filterDate;
      const matchPayment = !filterPayment || sale.paymentMethod === filterPayment;

      const term = searchTerm.trim().toLowerCase();
      const matchSearch =
        !term ||
        String(sale.saleNumber).includes(term) ||
        (sale.customerName || "").toLowerCase().includes(term) ||
        (sale.operatorName || "").toLowerCase().includes(term) ||
        (sale.paymentMethod || "").toLowerCase().includes(term);

      return matchDate && matchPayment && matchSearch;
    });
  }, [sales, filterDate, filterPayment, searchTerm]);

  const totalFiltered = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalCash = filteredSales
    .filter((sale) => sale.paymentMethod === "cash")
    .reduce((sum, sale) => sum + sale.total, 0);
  const totalPix = filteredSales
    .filter((sale) => sale.paymentMethod === "pix")
    .reduce((sum, sale) => sum + sale.total, 0);
  const totalCard = filteredSales
    .filter((sale) => sale.paymentMethod === "card")
    .reduce((sum, sale) => sum + sale.total, 0);
  const totalFiado = filteredSales
    .filter((sale) => sale.paymentMethod === "fiado")
    .reduce((sum, sale) => sum + sale.total, 0);

  function handleReprint(sale: Sale) {
    const encoded = encodeURIComponent(JSON.stringify(sale));
    window.open(`/print-receipt?data=${encoded}&back=/admin/sales`, "_blank", "noopener,noreferrer");
  }

  function handlePrint() {
    window.print();
  }

  return (
    <main className="container">
      <Header />

      <div className="card">
        <div className="table-header no-print">
          <div>
            <h3 style={{ margin: 0 }}>Relatório de vendas</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Consulte, filtre, imprima ou salve em PDF.
            </p>
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

          <div>
            <label>Forma de pagamento</label>
            <select
              className="select"
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="cash">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="card">Cartão</option>
              <option value="fiado">Fiado</option>
            </select>
          </div>

          <div>
            <label>Pesquisar</label>
            <input
              className="input"
              placeholder="Número, cliente, operador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-4 no-print sales-summary-grid" style={{ marginBottom: 16 }}>
          <div className="sales-summary-box">
            <span>Total geral</span>
            <strong>{money(totalFiltered)}</strong>
          </div>

          <div className="sales-summary-box">
            <span>Dinheiro</span>
            <strong>{money(totalCash)}</strong>
          </div>

          <div className="sales-summary-box">
            <span>PIX</span>
            <strong>{money(totalPix)}</strong>
          </div>

          <div className="sales-summary-box">
            <span>Cartão / Fiado</span>
            <strong>{money(totalCard + totalFiado)}</strong>
          </div>
        </div>

        <div className="row no-print sales-actions" style={{ marginBottom: 16 }}>
          <button className="btn btn-secondary" type="button" onClick={handlePrint}>
            Imprimir / PDF
          </button>

          <button
            className="btn btn-outline"
            type="button"
            onClick={() => {
              setFilterDate("");
              setFilterPayment("");
              setSearchTerm("");
            }}
          >
            Limpar filtros
          </button>
        </div>

        <div className="table-wrap">
          <table className="table modern-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Operador</th>
                <th>Pagamento</th>
                <th>Total</th>
                <th className="no-print">Cupom</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale) => (
                <tr key={sale.id}>
                  <td>{sale.saleNumber}</td>
                  <td>{dateTime(sale.createdAt)}</td>
                  <td>
                    <div style={{ display: "grid", gap: 2 }}>
                      <strong>{sale.customerName || "Consumidor"}</strong>
                      <span className="muted">
                        {sale.customerId ? formatCpf(sale.customerId) : ""}
                      </span>
                    </div>
                  </td>
                  <td>{sale.operatorName}</td>
                  <td>
                    {sale.paymentMethod}
                    {sale.cardType ? ` - ${sale.cardType}` : ""}
                  </td>
                  <td>{money(sale.total)}</td>
                  <td className="no-print">
                    <button
                      className="btn btn-edit"
                      type="button"
                      onClick={() => handleReprint(sale)}
                    >
                      Reimprimir
                    </button>
                  </td>
                </tr>
              ))}

              {!filteredSales.length ? (
                <tr>
                  <td colSpan={7}>Nenhuma venda encontrada.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}