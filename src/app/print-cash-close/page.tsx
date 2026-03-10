"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { money } from "@/lib/format";

export default function PrintCashClosePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const data = searchParams.get("data");
  const back = searchParams.get("back") || "/checkout";

  const report = useMemo(() => {
    if (!data) return null;

    try {
      return JSON.parse(decodeURIComponent(data));
    } catch {
      return null;
    }
  }, [data]);

  useEffect(() => {
    if (report) {
      setTimeout(() => window.print(), 400);
    }
  }, [report]);

  if (!report) {
    return (
      <main className="container">
        <div className="card">Relatório de fechamento não encontrado.</div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="card no-print" style={{ marginBottom: 16 }}>
        <div className="row">
          <button className="btn btn-primary" onClick={() => window.print()}>
            Imprimir novamente
          </button>

          <button className="btn btn-outline" onClick={() => router.push(back)}>
            Fechar
          </button>
        </div>
      </div>

      <div style={{ width: 320, padding: 8, fontFamily: "monospace", fontSize: 12 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <strong>RELATÓRIO DE FECHAMENTO DE CAIXA</strong>
        </div>

        <div>Operador: {report.operatorName}</div>
        <div>Abertura: {new Date(report.openedAt).toLocaleString("pt-BR")}</div>
        <div>Fechamento: {new Date(report.closedAt).toLocaleString("pt-BR")}</div>

        <hr />

        <div>Saldo inicial: {money(report.openingAmount)}</div>
        <div>Vendas dinheiro: {money(report.totalSalesCash)}</div>
        <div>Vendas PIX: {money(report.totalSalesPix)}</div>
        <div>Vendas cartão: {money(report.totalSalesCard)}</div>
        <div>Vendas fiado: {money(report.totalSalesFiado)}</div>
        <div>Retiradas: {money(report.totalWithdrawals)}</div>
        <div>Esperado no caixa: {money(report.expectedCashAmount)}</div>
        <div>Dinheiro na bandeja: {money(report.trayAmount)}</div>

        <hr />

        <div>
          Diferença:{" "}
          {report.differenceType === "matched"
            ? "Caixa conferido"
            : report.differenceType === "short"
            ? `Falta ${money(Math.abs(report.differenceAmount || 0))}`
            : `Sobra ${money(report.differenceAmount || 0)}`}
        </div>

        {report.closingNotes ? (
          <>
            <hr />
            <div>Obs.: {report.closingNotes}</div>
          </>
        ) : null}

        <hr />
        <div>Assinatura do caixa: ____________________</div>
        <div>Assinatura da conferência: ______________</div>
      </div>
    </main>
  );
}