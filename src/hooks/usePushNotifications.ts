"use client";
import { useEffect, useState, useCallback } from "react";
import { getEmpresaId } from "@/lib/supabaseClient";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications(operadorId?: string) {
  const [suportado, setSuportado] = useState(false);
  const [permissao, setPermissao] = useState<NotificationPermission>("default");
  const [inscrito, setInscrito] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSuportado("serviceWorker" in navigator && "PushManager" in window);
    setPermissao(Notification.permission);

    // Verifica se ja esta inscrito
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setInscrito(!!sub)),
    ).catch(() => {});
  }, []);

  const ativar = useCallback(async () => {
    if (!suportado) return { ok: false, erro: "Não suportado neste dispositivo" };
    setCarregando(true);
    try {
      const perm = await Notification.requestPermission();
      setPermissao(perm);
      if (perm !== "granted") return { ok: false, erro: "Permissão negada" };

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
        ),
      });

      const empresaId = getEmpresaId();
      const res = await fetch("/api/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          operador_id: operadorId,
          subscription: sub.toJSON(),
          endpoint: sub.endpoint,
        }),
      });
      const json = await res.json();
      if (json.ok) setInscrito(true);
      return json;
    } catch (err) {
      return { ok: false, erro: String(err) };
    } finally {
      setCarregando(false);
    }
  }, [suportado, operadorId]);

  const desativar = useCallback(async () => {
    setCarregando(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await fetch("/api/push-subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
      setInscrito(false);
    } finally {
      setCarregando(false);
    }
  }, []);

  return { suportado, permissao, inscrito, carregando, ativar, desativar };
}
