/**
 * useOnlineStatus.ts
 * Hook que retorna true quando há conexão com a internet.
 * Escuta os eventos native browser online/offline.
 */

import { useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const setOn  = () => setOnline(true);
    const setOff = () => setOnline(false);
    window.addEventListener("online",  setOn);
    window.addEventListener("offline", setOff);
    return () => {
      window.removeEventListener("online",  setOn);
      window.removeEventListener("offline", setOff);
    };
  }, []);

  return online;
}
