import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { provider, token, ambiente } = await req.json();

    if (!token) return NextResponse.json({ ok: false, erro: "Token não informado." });

    if (provider === "focusnfe") {
      const base = ambiente === "producao"
        ? "https://api.focusnfe.com.br"
        : "https://homologacao.focusnfe.com.br";
      const credentials = Buffer.from(`${token}:`).toString("base64");
      const res = await fetch(`${base}/v2/empresas`, {
        headers: { Authorization: `Basic ${credentials}` },
      });
      if (res.ok || res.status === 403) {
        // 403 = token válido mas sem permissão de listar — ainda assim o token funciona
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ ok: false, erro: `HTTP ${res.status}` });
    }

    if (provider === "nfeio") {
      const base = ambiente === "producao"
        ? "https://api.nfe.io"
        : "https://api.nfe.io"; // NFe.io usa mesmo endpoint, ambiente via config
      const res = await fetch(`${base}/v1/companies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok || res.status === 403) {
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ ok: false, erro: `HTTP ${res.status}` });
    }

    return NextResponse.json({ ok: false, erro: "Provedor desconhecido." });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) });
  }
}
