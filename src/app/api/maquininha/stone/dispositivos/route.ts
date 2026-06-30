import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ ok: false, erro: "Token não informado." });

    const credentials = Buffer.from(`${token}:`).toString("base64");
    const res = await fetch("https://api.pagar.me/core/v5/terminals", {
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
    });

    const json = await res.json();
    if (!res.ok) return NextResponse.json({ ok: false, erro: json.message || `HTTP ${res.status}` });

    const devices = ((json.data as { id: string; serial_number?: string; status?: string }[]) || [])
      .filter(d => d.status !== "inactive")
      .map(d => ({ id: d.id, label: d.serial_number ? `${d.id} (SN: ${d.serial_number})` : d.id }));

    return NextResponse.json({ ok: true, devices });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) });
  }
}
