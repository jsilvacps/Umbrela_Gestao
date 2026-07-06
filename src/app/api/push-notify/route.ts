import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSign } from "crypto";

// ── VAPID JWT (ES256 via Node crypto) ────────────────────────────────────────

function b64u(buf: Buffer | Uint8Array) {
  return Buffer.from(buf).toString("base64url");
}

function buildVapidJwt(audience: string) {
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@horti.app";
  const privateKeyB64 = process.env.VAPID_PRIVATE_KEY ?? "";

  const header = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64u(
    Buffer.from(
      JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }),
    ),
  );
  const data = `${header}.${payload}`;

  // Converte chave VAPID (raw EC P-256) para PEM
  const rawKey = Buffer.from(privateKeyB64, "base64url");
  // PKCS8 para P-256: sequência fixa de 36 bytes + chave de 32 bytes
  const pkcs8 = Buffer.concat([
    Buffer.from("308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420", "hex"),
    rawKey,
    Buffer.from("a144034200", "hex"),
    // public key placeholder — não usado para assinar
    Buffer.alloc(65),
  ]);
  const pem = `-----BEGIN PRIVATE KEY-----\n${pkcs8.toString("base64").match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;

  const sign = createSign("SHA256");
  sign.update(data);
  const der = sign.sign({ key: pem, dsaEncoding: "ieee-p1363" });
  return `${data}.${b64u(der)}`;
}

// ── Envio sem criptografia de payload (notificação vazia + data via tag) ─────
// O SW usa o campo "data" do push event para montar a mensagem.
// Para evitar a complexidade do RFC 8291, enviamos o payload como texto
// simples sem criptografia — funciona quando o endpoint é FCM/VAPID sem
// content-encoding obrigatório.

async function sendPush(
  sub: { endpoint: string; keys?: { p256dh?: string; auth?: string } },
  payloadStr: string,
): Promise<number> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = buildVapidJwt(audience);
  const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  const body = Buffer.from(payloadStr, "utf8");

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt},k=${pubKey}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      TTL: "86400",
    },
    body,
  });
  return res.status;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { empresa_id, title, body, tag } = await req.json();
    if (!empresa_id || !body)
      return NextResponse.json({ ok: false, error: "dados obrigatorios" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );

    const { data: emp } = await supabase
      .from("empresa")
      .select("notif_adm_ids")
      .eq("empresa_id", empresa_id)
      .maybeSingle();
    const admIds: string[] = (emp as { notif_adm_ids?: string[] } | null)?.notif_adm_ids ?? [];

    let query = supabase
      .from("push_subscriptions")
      .select("subscription, endpoint")
      .eq("empresa_id", empresa_id);
    if (admIds.length > 0) query = query.in("operador_id", admIds);

    const { data: subs } = await query;
    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, enviados: 0 });

    const payload = JSON.stringify({ title: title ?? "Horti Gestão", body, tag: tag ?? "horti-adm" });
    const mortos: string[] = [];
    let enviados = 0;

    await Promise.allSettled(
      subs.map(async (row) => {
        const sub = row.subscription as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
        try {
          const status = await sendPush(sub, payload);
          if (status === 410 || status === 404) mortos.push(sub.endpoint);
          else if (status < 300) enviados++;
        } catch { /* ignora */ }
      }),
    );

    if (mortos.length > 0)
      await supabase.from("push_subscriptions").delete().in("endpoint", mortos);

    return NextResponse.json({ ok: true, enviados });
  } catch (err) {
    console.error("[push-notify]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
