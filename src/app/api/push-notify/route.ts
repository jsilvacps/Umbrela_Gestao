import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ?? "mailto:admin@horti.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? "",
);

export async function POST(req: NextRequest) {
  try {
    const { empresa_id, title, body, tag } = await req.json();
    if (!empresa_id || !body)
      return NextResponse.json({ ok: false, error: "dados obrigatorios" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("subscription, endpoint")
      .eq("empresa_id", empresa_id);

    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, enviados: 0 });

    const payload = JSON.stringify({ title: title ?? "Horti Gestão", body, tag: tag ?? "horti-adm" });
    const mortos: string[] = [];
    let enviados = 0;

    await Promise.allSettled(
      subs.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription as webpush.PushSubscription, payload);
          enviados++;
        } catch (err: unknown) {
          // Remove subscriptions expiradas (410 Gone)
          if ((err as { statusCode?: number })?.statusCode === 410) mortos.push(row.endpoint);
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
