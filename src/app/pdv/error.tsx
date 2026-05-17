"use client";

export default function PDVError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      minHeight: "100vh", background: "#0c121a",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Segoe UI, sans-serif",
    }}>
      <div style={{
        background: "#111827", borderRadius: 16, padding: 32,
        maxWidth: 520, width: "90%", border: "1px solid #1f2937",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ color: "#f87171", fontWeight: 900, fontSize: 20, marginBottom: 12 }}>
          Erro no PDV
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
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={reset} style={{
            background: "#15803d", color: "#fff", border: "none",
            borderRadius: 10, padding: "12px 24px",
            fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}>
            🔄 Tentar novamente
          </button>
          <button onClick={() => window.location.href = "/setup"} style={{
            background: "#1f2937", color: "#9ca3af", border: "1px solid #374151",
            borderRadius: 10, padding: "12px 24px",
            fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}>
            ⚙️ Ir para Setup
          </button>
        </div>
      </div>
    </div>
  );
}
