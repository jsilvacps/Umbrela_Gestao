import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token, device_id } = await req.json();
    if (!token || !device_id) {
      return NextResponse.json({ ok: false, erro: "Parâmetros inválidos." });
    }

    const res = await fetch(
      `https://api.mercadopago.com/point/integration-api/devices/${device_id}/payment-intents`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.ok || res.status === 204) return NextResponse.json({ ok: true });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: false, erro: (json as { message?: string }).message || `HTTP ${res.status}` });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) });
  }
}
