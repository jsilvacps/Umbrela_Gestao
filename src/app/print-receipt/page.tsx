"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Receipt80mm from "@/components/Receipt80mm";
import { Sale } from "@/lib/types";

export default function PrintReceiptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const data = searchParams.get("data");
  const back = searchParams.get("back") || "/checkout";

  const sale = useMemo<Sale | null>(() => {
    if (!data) return null;

    try {
      return JSON.parse(decodeURIComponent(data));
    } catch {
      return null;
    }
  }, [data]);

  useEffect(() => {
    if (sale) {
      setTimeout(() => window.print(), 400);
    }
  }, [sale]);

  if (!sale) {
    return (
      <main className="container">
        <div className="card">Comprovante não encontrado.</div>
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
            Voltar para o caixa
          </button>
        </div>
      </div>

      <Receipt80mm sale={sale} />
    </main>
  );
}