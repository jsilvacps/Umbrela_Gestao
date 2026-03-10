"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { money } from "@/lib/format";

export default function PrintWithdrawalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const data = searchParams.get("data");
  const back = searchParams.get("back") || "/checkout";

  const movement = useMemo(() => {
    if (!data) return null;

    try {
      return JSON.parse(decodeURIComponent(data));
    } catch {
      return null;
    }
  }, [data]);

  useEffect(() => {
    if (movement) {
      setTimeout(() => window.print(), 400);
    }
  }, [movement]);

  if (!movement) {
    return (
      <main className="container">
        <div className="card">Comprovante de retirada não encontrado.</div>
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

      <div style={{ width: 280, padding: 8, fontFamily: "monospace", fontSize: 12 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <strong>COMPROVANTE DE RETIRADA</strong>
        </div>

        <div>Operador: {movement.operatorName}</div>
        <div>Valor: {money(movement.amount)}</div>
        <div>Motivo: {movement.reason}</div>
        <div>Data: {new Date(movement.createdAt).toLocaleString("pt-BR")}</div>

        <hr />
        <div>Assinatura do caixa: ____________________</div>
      </div>
    </main>
  );
}