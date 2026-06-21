import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function versaoGlobal() {
  try {
    const raw = readFileSync(join(process.cwd(), "public/version.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return { version: "0.0.0", notas: "", download: "" };
  }
}

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

  // Sem empresa ou sem versão específica → retorna a versão global
  return NextResponse.json(versaoGlobal());
}
