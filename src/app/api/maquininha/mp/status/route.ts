import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token, payment_intent_id } = await req.json();
    if (!token || !payment_intent_id) {
      return NextResponse.json({ ok: false, erro: "Parâmetros inválidos." });
    }

    const res = await fetch(
      `https://api.mercadopago.com/point/integration-api/payment-intents/${payment_intent_id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const json = await res.json();
    if (!res.ok) return NextResponse.json({ ok: false, erro: json.message || `HTTP ${res.status}` });

    // state: OPEN | PROCESSING | PROCESSED | CANCELED | ERROR
    return NextResponse.json({ ok: true, state: json.state, payment_id: json.payment_id });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) });
  }
}
