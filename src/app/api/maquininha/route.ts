import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Rota unificada para evitar rotas de API profundas que o Turbopack (Next.js 16) não compila
// action: mp_dispositivos | mp_cobrar | mp_cancelar | mp_status | stone_dispositivos | stone_cobrar | stone_cancelar | stone_status

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body as { action?: string };

    if (!action) return NextResponse.json({ ok: false, erro: "action não informada." });

    // ── Mercado Pago ──────────────────────────────────────────────────────────
    if (action === "mp_dispositivos") {
      const { token } = body as { token: string };
      if (!token) return NextResponse.json({ ok: false, erro: "Token não informado." });
      const res = await fetch("https://api.mercadopago.com/point/integration-api/devices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) return NextResponse.json({ ok: false, erro: (json as { message?: string }).message || `HTTP ${res.status}` });
      const devices = ((json as { devices?: { id: string; operating_mode?: string }[] }).devices || []).map((d) => ({
        id: d.id,
        label: d.operating_mode ? `${d.id} (${d.operating_mode})` : d.id,
      }));
      return NextResponse.json({ ok: true, devices });
    }

    if (action === "mp_cobrar") {
      const { token, device_id, total, descricao } = body as { token: string; device_id: string; total: number; descricao?: string };
      if (!token || !device_id || !total) return NextResponse.json({ ok: false, erro: "Parâmetros inválidos." });
      const amount = Math.round(Number(total) * 100);
      const res = await fetch(
        `https://api.mercadopago.com/point/integration-api/devices/${device_id}/payment-intents`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            description: descricao || "Venda",
            payment: { installments: 1, type: "credit_card" },
            additional_info: { external_reference: `venda_${Date.now()}` },
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) return NextResponse.json({ ok: false, erro: (json as { message?: string }).message || `HTTP ${res.status}` });
      return NextResponse.json({ ok: true, payment_intent_id: (json as { id: string }).id });
    }

    if (action === "mp_cancelar") {
      const { token, device_id } = body as { token: string; device_id: string };
      if (!token || !device_id) return NextResponse.json({ ok: false, erro: "Parâmetros inválidos." });
      const res = await fetch(
        `https://api.mercadopago.com/point/integration-api/devices/${device_id}/payment-intents`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok || res.status === 204) return NextResponse.json({ ok: true });
      const json = await res.json().catch(() => ({}));
      return NextResponse.json({ ok: false, erro: (json as { message?: string }).message || `HTTP ${res.status}` });
    }

    if (action === "mp_status") {
      const { token, payment_intent_id } = body as { token: string; payment_intent_id: string };
      if (!token || !payment_intent_id) return NextResponse.json({ ok: false, erro: "Parâmetros inválidos." });
      const res = await fetch(
        `https://api.mercadopago.com/point/integration-api/payment-intents/${payment_intent_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (!res.ok) return NextResponse.json({ ok: false, erro: (json as { message?: string }).message || `HTTP ${res.status}` });
      return NextResponse.json({ ok: true, state: (json as { state: string; payment_id?: string }).state, payment_id: (json as { payment_id?: string }).payment_id });
    }

    return NextResponse.json({ ok: false, erro: `action desconhecida: ${action}` });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) });
  }
}
