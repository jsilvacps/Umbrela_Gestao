"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { db } from "@/lib/firebase";
import { CanceledCoupon, CanceledItem, CompanySettings } from "@/lib/types";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { dateTime, money } from "@/lib/format";

const SETTINGS_DOC_ID = "main";

export default function ReportsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [accessPassword, setAccessPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);

  const [canceledItems, setCanceledItems] = useState<CanceledItem[]>([]);
  const [canceledCoupons, setCanceledCoupons] = useState<CanceledCoupon[]>([]);

  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    async function loadSettings() {
      const snapshot = await getDoc(doc(db, "settings", SETTINGS_DOC_ID));
      if (snapshot.exists()) {
        setSettings(snapshot.data() as CompanySettings);
      }
    }

    loadSettings();
  }, []);

  useEffect(() => {
    if (!authorized) return;

    const unsubItems = onSnapshot(collection(db, "canceled_items"), (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as CanceledItem),
      }));

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCanceledItems(list);
    });

    const unsubCoupons = onSnapshot(collection(db, "canceled_coupons"), (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as CanceledCoupon),
      }));

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCanceledCoupons(list);
    });

    return () => {
      unsubItems();
      unsubCoupons();
    };
  }, [authorized]);

  const filteredCanceledItems = useMemo(() => {
    if (!filterDate) return canceledItems;

    return canceledItems.filter((item) => {
      const dt = new Date(item.createdAt);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}` === filterDate;
    });
  }, [canceledItems, filterDate]);

  const filteredCanceledCoupons = useMemo(() => {
    if (!filterDate) return canceledCoupons;

    return canceledCoupons.filter((item) => {
      const dt = new Date(item.createdAt);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}` === filterDate;
    });
  }, [canceledCoupons, filterDate]);

  function handleAccess() {
    if (!settings?.reportsPassword) {
      setAuthorized(true);
      return;
    }

    if (accessPassword === settings.reportsPassword) {
      setAuthorized(true);
    } else {
      alert("Senha incorreta.");
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <main className="container">
      <Header />

      {!authorized ? (
        <div className="card reports-access-card">
          <h3>Acesso aos relatórios</h3>
          <p className="muted">Digite a senha cadastrada em Configurações.</p>

          <div className="grid" style={{ maxWidth: 420 }}>
            <div>
              <label>Senha</label>
              <input
                className="input"
                type="password"
                value={accessPassword}
                onChange={(e) => setAccessPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAccess();
                }}
              />
            </div>

            <button className="btn btn-primary" type="button" onClick={handleAccess}>
              Entrar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card no-print" style={{ marginBottom: 16 }}>
            <div className="grid grid-3">
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
                <span>Itens cancelados</span>
                <strong>{filteredCanceledItems.length}</strong>
              </div>

              <div className="row sales-actions">
                <button className="btn btn-secondary" type="button" onClick={handlePrint}>
                  Imprimir / PDF
                </button>

                <button className="btn btn-outline" type="button" onClick={() => setFilterDate("")}>
                  Limpar filtro
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Relatório de itens cancelados</h3>

            <div className="table-wrap">
              <table className="table modern-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Operador</th>
                    <th>Produto</th>
                    <th>Qtd</th>
                    <th>Valor</th>
                    <th>Motivo</th>
                    <th>Operação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCanceledItems.map((item) => (
                    <tr key={item.id}>
                      <td>{dateTime(item.createdAt)}</td>
                      <td>{item.operatorName}</td>
                      <td>{item.productName}</td>
                      <td>{item.quantity.toFixed(3)}</td>
                      <td>{money(item.totalPrice)}</td>
                      <td>{item.reason}</td>
                      <td>{item.operationId}</td>
                    </tr>
                  ))}

                  {!filteredCanceledItems.length ? (
                    <tr>
                      <td colSpan={7}>Nenhum item cancelado encontrado.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>Relatório de cupons cancelados</h3>

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
                  {filteredCanceledCoupons.map((item) => (
                    <tr key={item.id}>
                      <td>{dateTime(item.createdAt)}</td>
                      <td>{item.operatorName}</td>
                      <td>{item.customerName || "Sem cliente"}</td>
                      <td>{money(item.total)}</td>
                      <td>{item.reason}</td>
                      <td>{item.operationId}</td>
                    </tr>
                  ))}

                  {!filteredCanceledCoupons.length ? (
                    <tr>
                      <td colSpan={6}>Nenhum cupom cancelado encontrado.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}