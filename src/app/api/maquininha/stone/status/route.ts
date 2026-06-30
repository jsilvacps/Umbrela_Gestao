import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token, payment_intent_id } = await req.json();
    if (!token || !payment_intent_id) {
      return NextResponse.json({ ok: false, erro: "Parâmetros inválidos." });
    }

    const credentials = Buffer.from(`${token}:`).toString("base64");
    const res = await fetch(`https://api.pagar.me/core/v5/orders/${payment_intent_id}`, {
      headers: { Authorization: `Basic ${credentials}` },
    });

    const json = await res.json();
    if (!res.ok) return NextResponse.json({ ok: false, erro: json.message || `HTTP ${res.status}` });

    // Stone/Pagar.me status: pending | paid | canceled | failed
    // Mapeia para o mesmo padrão do MP: OPEN | PROCESSED | CANCELED | ERROR
    const stateMap: Record<string, string> = {
      pending:  "OPEN",
      paid:     "PROCESSED",
      canceled: "CANCELED",
      failed:   "ERROR",
    };
    const state = stateMap[json.status] || "OPEN";

    return NextResponse.json({ ok: true, state, payment_id: json.id });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) });
  }
}
