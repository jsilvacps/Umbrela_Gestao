import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ ok: false, erro: "Token não informado." });

    const res = await fetch("https://api.mercadopago.com/point/integration-api/devices", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) return NextResponse.json({ ok: false, erro: json.message || `HTTP ${res.status}` });

    const devices = (json.devices || []).map((d: { id: string; operating_mode?: string }) => ({
      id: d.id,
      label: d.operating_mode ? `${d.id} (${d.operating_mode})` : d.id,
    }));

    return NextResponse.json({ ok: true, devices });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) });
  }
}
