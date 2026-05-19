'use client';

/**
 * PresenceTracker — rastreia a presença do cliente no Supabase Realtime.
 * Incluído no layout raiz: enquanto a página estiver aberta, o empresa_id
 * aparece como "online" no canal 'horti-presence'.
 * Se não houver empresa_id configurado (ex: página master), não faz nada.
 */
import { useEffect } from 'react';
import { supabase, getEmpresaId } from '@/lib/supabaseClient';

export default function PresenceTracker() {
  useEffect(() => {
    const empresaId = getEmpresaId();
    if (!empresaId) return;

    const channel = supabase.channel('horti-presence', {
      config: { presence: { key: `empresa-${empresaId}` } },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          empresa_id: empresaId,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
