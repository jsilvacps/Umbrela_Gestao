/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido." });

  const body = req.body as Record<string, unknown>;
  const action = body.action as string | undefined;
  if (!action) return res.status(400).json({ ok: false, erro: "action não informada." });

  try {
    if (action === "mp_dispositivos") {
      const token = body.token as string;
      if (!token) return res.status(400).json({ ok: false, erro: "Token não informado." });
      const r = await fetch("https://api.mercadopago.com/point/integration-api/devices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json() as any;
      if (!r.ok) return res.status(200).json({ ok: false, erro: json.message || `HTTP ${r.status}` });
      const devices = (json.devices || []).map((d: any) => ({
        id: d.id,
        label: d.operating_mode ? `${d.id} (${d.operating_mode})` : d.id,
      }));
      return res.status(200).json({ ok: true, devices });
    }

    if (action === "mp_cobrar") {
      const { token, device_id, total, subtipo, descricao } = body as any;
      if (!token || !device_id || !total) return res.status(400).json({ ok: false, erro: "Parâmetros inválidos." });
      const amount = Math.round(parseFloat(Number(total).toFixed(2)) * 100);
      const paymentType = subtipo === "credito" ? "credit_card" : subtipo === "alimentacao" ? "voucher_card" : "debit_card";
      const installments = paymentType === "credit_card" ? 1 : 1;
      const r = await fetch(
        `https://api.mercadopago.com/point/integration-api/devices/${device_id}/payment-intents`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ amount, description: descricao || "Venda", payment: { installments, type: paymentType }, additional_info: { external_reference: `venda_${Date.now()}` } }),
          signal: AbortSignal.timeout(8000),
        }
      );
      const json = await r.json() as any;
      if (!r.ok) return res.status(200).json({ ok: false, erro: json.message || `HTTP ${r.status}` });
      return res.status(200).json({ ok: true, payment_intent_id: json.id });
    }

    if (action === "mp_cancelar") {
      const { token, device_id } = body as any;
      if (!token || !device_id) return res.status(400).json({ ok: false, erro: "Parâmetros inválidos." });
      const r = await fetch(
        `https://api.mercadopago.com/point/integration-api/devices/${device_id}/payment-intents`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.ok || r.status === 204) return res.status(200).json({ ok: true });
      const json = await r.json().catch(() => ({})) as any;
      return res.status(200).json({ ok: false, erro: json.message || `HTTP ${r.status}` });
    }

    if (action === "mp_status") {
      const { token, payment_intent_id } = body as any;
      if (!token || !payment_intent_id) return res.status(400).json({ ok: false, erro: "Parâmetros inválidos." });
      const r = await fetch(
        `https://api.mercadopago.com/point/integration-api/payment-intents/${payment_intent_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await r.json() as any;
      if (!r.ok) return res.status(200).json({ ok: false, erro: json.message || `HTTP ${r.status}` });
      return res.status(200).json({ ok: true, state: json.state, payment_id: json.payment_id });
    }

    if (action === "mp_modo_pdv") {
      const { token, device_id } = body as any;
      if (!token || !device_id) return res.status(400).json({ ok: false, erro: "Parâmetros inválidos." });
      const r = await fetch(
        `https://api.mercadopago.com/point/integration-api/devices/${device_id}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ operating_mode: "PDV" }),
          signal: AbortSignal.timeout(8000),
        }
      );
      const json = await r.json().catch(() => ({})) as any;
      if (!r.ok) return res.status(200).json({ ok: false, erro: json.message || `HTTP ${r.status}` });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, erro: `action desconhecida: ${action}` });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: String(err) });
  }
}
