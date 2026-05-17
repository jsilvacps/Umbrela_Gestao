"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body style={{
        margin: 0, padding: 0,
        background: "#0c121a",
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", fontFamily: "Segoe UI, sans-serif",
      }}>
        <div style={{
          background: "#111827", borderRadius: 16, padding: 36,
          maxWidth: 560, width: "90%", border: "1px solid #1f2937",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ color: "#f87171", fontWeight: 900, fontSize: 20, marginBottom: 12 }}>
            Erro no Horti Gestão PDV
          </div>
          <div style={{
            background: "#1f2937", borderRadius: 8, padding: 14,
            color: "#9ca3af", fontSize: 13, fontFamily: "monospace",
            wordBreak: "break-all", textAlign: "left", marginBottom: 20,
            maxHeight: 160, overflow: "auto",
          }}>
            {error?.message || "Erro desconhecido"}
            {error?.stack && (
              <div style={{ marginTop: 8, color: "#6b7280", fontSize: 11 }}>
                {error.stack}
              </div>
            )}
          </div>
          <button
            onClick={reset}
            style={{
              background: "#15803d", color: "#fff", border: "none",
              borderRadius: 10, padding: "12px 28px",
              fontWeight: 700, fontSize: 15, cursor: "pointer",
            }}
          >
            🔄 Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
