'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  onScanned: (codigo: string) => void;
  onClose: () => void;
};

export default function BarcodeScannerModal({ onScanned, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState("");
  const [lido, setLido] = useState(false);

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let ativo = true;

    async function iniciar() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();

        if (!videoRef.current) return;

        controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (result, err) => {
            if (!ativo || lido) return;
            if (result) {
              setLido(true);
              onScanned(result.getText());
            }
            if (err && !(err.message?.includes('No MultiFormat'))) {
              // ignora erros de frame sem código
            }
          }
        );
      } catch (e: unknown) {
        if (ativo) setErro('Não foi possível acessar a câmera. Verifique as permissões.');
        console.error(e);
      }
    }

    iniciar();

    return () => {
      ativo = false;
      controls?.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, overflow: 'hidden',
        width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,.5)',
      }}>
        {/* Header */}
        <div style={{
          background: '#16a34a', color: '#fff', padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>📷 Ler código de barras</div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#fff',
            fontSize: 22, cursor: 'pointer', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Vídeo */}
        <div style={{ position: 'relative', background: '#000' }}>
          <video
            ref={videoRef}
            style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover' }}
            muted
            playsInline
          />
          {/* Mira */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}>
            <div style={{
              width: 240, height: 80, border: '2px solid #4ade80',
              borderRadius: 8, boxShadow: '0 0 0 1000px rgba(0,0,0,0.4)',
            }} />
          </div>
        </div>

        {/* Status */}
        <div style={{ padding: '16px 20px', textAlign: 'center' }}>
          {erro ? (
            <div style={{ color: '#ef4444', fontSize: 14, fontWeight: 600 }}>{erro}</div>
          ) : lido ? (
            <div style={{ color: '#16a34a', fontSize: 14, fontWeight: 700 }}>✅ Código lido com sucesso!</div>
          ) : (
            <div style={{ color: '#64748b', fontSize: 13 }}>
              Aponte a câmera para o código de barras do produto
            </div>
          )}
          <button onClick={onClose} style={{
            marginTop: 12, width: '100%', height: 42, border: '1px solid #d5dde7',
            borderRadius: 10, background: '#f8fafc', color: '#374151',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
