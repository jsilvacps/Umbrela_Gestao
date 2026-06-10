'use client';

import { useEffect, useRef, useState } from 'react';
import type React from 'react';

type Props = {
  onScanned: (codigo: string) => void;
  onClose: () => void;
};

// Tipagem da BarcodeDetector API (nativa Chromium / Android Chrome)
interface BarcodeResult { rawValue: string; format: string; }
interface BarcodeDetectorI {
  detect(source: HTMLVideoElement): Promise<BarcodeResult[]>;
}
declare const BarcodeDetector: {
  new(opts: { formats: string[] }): BarcodeDetectorI;
  getSupportedFormats(): Promise<string[]>;
};

export default function BarcodeScannerModal({ onScanned, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState('');
  const [lido, setLido] = useState(false);

  useEffect(() => {
    let ativo = true;
    let stream: MediaStream | null = null;
    let animFrame = 0;

    async function iniciar() {
      try {
        // 1. Abre câmera traseira em HD
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!ativo || !videoRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // 2. Verifica suporte ao BarcodeDetector (Chromium ≥ 83 / Android Chrome)
        if (!('BarcodeDetector' in window)) {
          setErro('Leitor de código não suportado neste navegador. Use Chrome no Android ou o app PDV.');
          return;
        }

        const detector = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'qr_code'],
        });

        // 3. Loop de leitura via requestAnimationFrame
        const scan = async () => {
          if (!ativo || lido || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0 && ativo && !lido) {
              setLido(true);
              onScanned(results[0].rawValue);
              return;
            }
          } catch {
            // frame sem código ou câmera não pronta — ignora
          }
          animFrame = requestAnimationFrame(scan);
        };

        animFrame = requestAnimationFrame(scan);
      } catch {
        if (ativo) setErro('Não foi possível acessar a câmera. Verifique as permissões.');
      }
    }

    iniciar();

    return () => {
      ativo = false;
      cancelAnimationFrame(animFrame);
      stream?.getTracks().forEach(t => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cantos: React.CSSProperties[] = [
    { top: -3, left:  -3, borderTop: '4px solid #16a34a', borderLeft:  '4px solid #16a34a', borderRadius: '10px 0 0 0' },
    { top: -3, right: -3, borderTop: '4px solid #16a34a', borderRight: '4px solid #16a34a', borderRadius: '0 10px 0 0' },
    { bottom: -3, left:  -3, borderBottom: '4px solid #16a34a', borderLeft:  '4px solid #16a34a', borderRadius: '0 0 0 10px' },
    { bottom: -3, right: -3, borderBottom: '4px solid #16a34a', borderRight: '4px solid #16a34a', borderRadius: '0 0 10px 0' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#000',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Vídeo tela cheia */}
      <video
        ref={videoRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
        }}
        muted
        playsInline
      />

      {/* Overlay — escurece bordas, janela clara no centro */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 'calc(50% - 90px)', background: 'rgba(0,0,0,0.55)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 'calc(50% - 90px)', background: 'rgba(0,0,0,0.55)' }} />
        <div style={{ position: 'absolute', top: 'calc(50% - 90px)', left: 0, width: 'calc(50% - 140px)', height: 180, background: 'rgba(0,0,0,0.55)' }} />
        <div style={{ position: 'absolute', top: 'calc(50% - 90px)', right: 0, width: 'calc(50% - 140px)', height: 180, background: 'rgba(0,0,0,0.55)' }} />

        {/* Moldura verde */}
        <div style={{
          position: 'absolute',
          top: 'calc(50% - 90px)', left: 'calc(50% - 140px)',
          width: 280, height: 180,
          border: '3px solid #4ade80',
          borderRadius: 12,
          boxSizing: 'border-box',
        }}>
          {cantos.map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...s }} />
          ))}

          {/* Linha animada */}
          {!lido && !erro && (
            <div style={{
              position: 'absolute', left: 8, right: 8, height: 2,
              background: 'linear-gradient(90deg, transparent, #4ade80, transparent)',
              borderRadius: 2,
              animation: 'scanLine 1.8s ease-in-out infinite',
            }} />
          )}
        </div>
      </div>

      {/* Barra superior */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
      }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>📷 Ler código de barras</div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff', fontSize: 20, width: 38, height: 38, borderRadius: 19,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700,
          }}
        >✕</button>
      </div>

      {/* Rodapé */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
        padding: '40px 24px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      }}>
        {erro ? (
          <div style={{
            background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444',
            borderRadius: 12, padding: '10px 18px',
            color: '#fca5a5', fontSize: 14, fontWeight: 600, textAlign: 'center',
          }}>{erro}</div>
        ) : lido ? (
          <div style={{
            background: 'rgba(22,163,74,0.25)', border: '1px solid #4ade80',
            borderRadius: 12, padding: '10px 18px',
            color: '#4ade80', fontSize: 16, fontWeight: 800,
          }}>✅ Código lido!</div>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center' }}>
            Aponte a câmera para o código de barras
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%', maxWidth: 320, height: 50,
            background: 'rgba(255,255,255,0.12)',
            border: '1.5px solid rgba(255,255,255,0.35)',
            borderRadius: 14, color: '#fff',
            fontWeight: 700, fontSize: 15, cursor: 'pointer',
          }}
        >Cancelar</button>
      </div>

      <style>{`
        @keyframes scanLine {
          0%   { top: 8px; }
          50%  { top: calc(100% - 10px); }
          100% { top: 8px; }
        }
      `}</style>
    </div>
  );
}
