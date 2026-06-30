import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token, terminal_id, total, descricao } = await req.json();
    if (!token || !terminal_id || !total) {
      return NextResponse.json({ ok: false, erro: "Parâmetros inválidos." });
    }

    const amount = Math.round(Number(total) * 100); // centavos
    const credentials = Buffer.from(`${token}:`).toString("base64");

    const res = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ amount, description: descricao || "Venda", quantity: 1 }],
        payments: [{
          payment_method: "credit_card",
          credit_card: {
            terminal_id,
            installments: 1,
            statement_descriptor: "VENDA",
          },
        }],
      }),
    });

    const json = await res.json();
    if (!res.ok) return NextResponse.json({ ok: false, erro: json.message || `HTTP ${res.status}` });

    return NextResponse.json({ ok: true, payment_intent_id: json.id, status: json.status });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) });
  }
}
