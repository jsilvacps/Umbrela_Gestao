import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token, payment_intent_id } = await req.json();
    if (!token || !payment_intent_id) {
      return NextResponse.json({ ok: false, erro: "Parâmetros inválidos." });
    }

    const credentials = Buffer.from(`${token}:`).toString("base64");
    const res = await fetch(`https://api.pagar.me/core/v5/orders/${payment_intent_id}/closed`, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "canceled" }),
    });

    if (res.ok || res.status === 204) return NextResponse.json({ ok: true });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: false, erro: (json as { message?: string }).message || `HTTP ${res.status}` });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) });
  }
}
