import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── VAPID + Web Push (RFC 8291) via Web Crypto API nativo ────────────────────

const subtle = globalThis.crypto.subtle;

function b64u(buf: ArrayBuffer | Uint8Array): string {
  return Buffer.from(buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf)
    .toString("base64url");
}

function fromB64u(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

async function importVapidPrivateKey(): Promise<CryptoKey> {
  const pubBytes = fromB64u(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "");
  const privBytes = fromB64u(process.env.VAPID_PRIVATE_KEY ?? "");
  return subtle.importKey(
    "jwk",
    {
      kty: "EC", crv: "P-256",
      x: b64u(pubBytes.slice(1, 33)),
      y: b64u(pubBytes.slice(33, 65)),
      d: b64u(privBytes),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function buildVapidJwt(audience: string): Promise<string> {
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@horti.app";
  const privKey = await importVapidPrivateKey();
  const header = b64u(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64u(
    new TextEncoder().encode(
      JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 43200, sub: subject }),
    ),
  );
  const input = `${header}.${payload}`;
  const sig = await subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    new TextEncoder().encode(input),
  );
  return `${input}.${b64u(sig)}`;
}

// ── Criptografia de payload RFC 8291 (aes128gcm) ─────────────────────────────

async function encryptPayload(
  sub: { keys: { p256dh: string; auth: string } },
  plaintext: string,
): Promise<{ body: ArrayBuffer; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const authSecret = fromB64u(sub.keys.auth);
  const clientPublicKey = fromB64u(sub.keys.p256dh);

  // Gera par de chaves efêmero
  const serverKeyPair = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublicKeyRaw = new Uint8Array(
    await subtle.exportKey("raw", serverKeyPair.publicKey),
  );

  // Importa chave pública do cliente
  const clientKey = await subtle.importKey(
    "raw", clientPublicKey.buffer.slice(clientPublicKey.byteOffset, clientPublicKey.byteOffset + clientPublicKey.byteLength) as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" }, false, [],
  );

  // ECDH
  const sharedBits = new Uint8Array(
    await subtle.deriveBits({ name: "ECDH", public: clientKey }, serverKeyPair.privateKey, 256) as ArrayBuffer,
  );

  // Salt aleatório
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));

  // HKDF para derivar IKM
  const hkdfKey = await subtle.importKey("raw", sharedBits.buffer.slice(sharedBits.byteOffset, sharedBits.byteOffset + sharedBits.byteLength) as ArrayBuffer, "HKDF", false, ["deriveBits"]);

  // PRK_key = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" + client_pub + server_pub)
  const info = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...clientPublicKey,
    ...serverPublicKeyRaw,
  ]);
  const ikm = new Uint8Array(
    await subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authSecret as unknown as ArrayBuffer, info: info as unknown as ArrayBuffer },
      hkdfKey,
      256,
    ),
  );

  // Deriva chave de conteúdo e nonce
  const ikmKey = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const cekInfo = new Uint8Array([
    ...new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
  ]);
  const nonceInfo = new Uint8Array([
    ...new TextEncoder().encode("Content-Encoding: nonce\0"),
  ]);

  const cek = new Uint8Array(
    await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: cekInfo }, ikmKey, 128),
  );
  const nonce = new Uint8Array(
    await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, ikmKey, 96),
  );

  // Importa CEK para AES-GCM
  const aesKey = await subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);

  // Plaintext com padding (record = dados + 0x02)
  const plainBuf = new TextEncoder().encode(plaintext);
  const record = new Uint8Array(plainBuf.length + 1);
  record.set(plainBuf);
  record[plainBuf.length] = 0x02;

  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, record);

  // Header RFC 8291: salt(16) + rs(4) + keyid_len(1) + keyid(65)
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs, false);
  header[20] = 65;
  header.set(serverPublicKeyRaw, 21);

  const body = new Uint8Array(header.length + ciphertext.byteLength);
  body.set(header, 0);
  body.set(new Uint8Array(ciphertext), header.length);

  return { body: body.buffer, salt, serverPublicKey: serverPublicKeyRaw };
}

// ── Envio push ────────────────────────────────────────────────────────────────

async function sendPush(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payloadStr: string,
): Promise<number> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(audience);
  const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  const { body } = await encryptPayload(sub, payloadStr);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt},k=${pubKey}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
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
        const sub = row.subscription as { endpoint: string; keys: { p256dh: string; auth: string } };
        if (!sub?.keys?.p256dh || !sub?.keys?.auth) return;
        try {
          const status = await sendPush(sub, payload);
          if (status === 410 || status === 404) mortos.push(sub.endpoint);
          else if (status < 300) enviados++;
        } catch (e) {
          console.error("[push] erro ao enviar:", e);
        }
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
