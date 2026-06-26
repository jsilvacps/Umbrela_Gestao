import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token, device_id, total, descricao } = await req.json();
    if (!token || !device_id || !total) {
      return NextResponse.json({ ok: false, erro: "Parâmetros inválidos." });
    }

    const amount = Math.round(Number(total) * 100); // centavos

    const res = await fetch(
      `https://api.mercadopago.com/point/integration-api/devices/${device_id}/payment-intents`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          description: descricao || "Venda",
          payment: { installments: 1, type: "credit_card" },
          additional_info: { external_reference: `venda_${Date.now()}` },
        }),
      }
    );

    const json = await res.json();
    if (!res.ok) return NextResponse.json({ ok: false, erro: json.message || `HTTP ${res.status}` });

    return NextResponse.json({ ok: true, payment_intent_id: json.id });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) });
  }
}
