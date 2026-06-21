import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function urlDownload(v: string) {
  return `https://github.com/jsilvacps/Umbrela_Gestao/releases/download/v${v}/UmbrelaGestao-PDV-Setup-${v}.exe`;
}

export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresa_id");

  if (empresaId) {
    const { data } = await supabase
      .from("clientes_licenciados")
      .select("versao_liberada")
      .eq("empresa_id", Number(empresaId))
      .maybeSingle();

    if (data?.versao_liberada) {
      const v = data.versao_liberada as string;
      return NextResponse.json({ version: v, notas: "", download: urlDownload(v) });
    }
  }

  // Fallback: busca a versão global do version.json público
  try {
    const res = await fetch("https://umbrela-gestao.vercel.app/version.json", {
      next: { revalidate: 60 },
    });
    const json = await res.json();
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ version: "0.0.0", notas: "", download: "" });
  }
}
