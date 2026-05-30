'use client';

import { useEffect, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };

export default function PWAInstallBanner() {
  const [prompt, setPrompt]       = useState<BeforeInstallPromptEvent | null>(null);
  const [visivel, setVisivel]     = useState(false);
  const [isIOS, setIsIOS]         = useState(false);
  const [instalado, setInstalado] = useState(false);

  useEffect(() => {
    // Já está rodando como PWA instalado → não mostra nada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalado(true);
      return;
    }

    // Usuário já dispensou hoje → não mostra
    const dispensado = localStorage.getItem('pwa_dispensado');
    if (dispensado && Date.now() - Number(dispensado) < 24 * 60 * 60 * 1000) return;

    // iOS (Safari) não tem beforeinstallprompt — mostra instrução manual
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
    if (ios) {
      setIsIOS(true);
      const t = setTimeout(() => setVisivel(true), 2000);
      return () => clearTimeout(t);
    }

    // Android / Chrome — captura o evento antes que o navegador mostre o banner nativo
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisivel(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function instalar() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setVisivel(false);
    setPrompt(null);
  }

  function dispensar() {
    localStorage.setItem('pwa_dispensado', String(Date.now()));
    setVisivel(false);
  }

  if (instalado || !visivel) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#052e16', borderTop: '2px solid #16a34a',
      padding: '14px 18px', display: 'flex', alignItems: 'center',
      gap: 12, boxShadow: '0 -4px 24px rgba(0,0,0,0.35)',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      animation: 'slideUp 0.3s ease',
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity:0; } to { transform: translateY(0); opacity:1; } }`}</style>

      {/* Ícone */}
      <img src="/icon-72x72.png" alt="Horti Gestão" width={44} height={44}
        style={{ borderRadius: 10, flexShrink: 0 }} />

      {/* Texto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#f0fdf4', fontWeight: 700, fontSize: 14 }}>
          Instalar Horti Gestão
        </div>
        <div style={{ color: '#86efac', fontSize: 12, marginTop: 2 }}>
          {isIOS
            ? 'Toque em compartilhar ↑ e depois "Adicionar à Tela de Início"'
            : 'Adicione à tela inicial para acesso rápido, sem abrir o navegador'}
        </div>
      </div>

      {/* Botões */}
      {!isIOS && (
        <button onClick={instalar} style={{
          background: '#16a34a', color: '#fff', border: 'none',
          borderRadius: 8, padding: '9px 18px', fontWeight: 700,
          fontSize: 13, cursor: 'pointer', flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          📲 Instalar
        </button>
      )}
      <button onClick={dispensar} style={{
        background: 'transparent', color: '#64748b', border: 'none',
        fontSize: 20, cursor: 'pointer', padding: '4px 8px', flexShrink: 0,
      }}>
        ✕
      </button>
    </div>
  );
}
