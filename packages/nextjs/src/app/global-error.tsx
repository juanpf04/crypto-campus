"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Error fatal capturado por global-error.tsx:", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#0b0d12",
          color: "#f4f4f5",
        }}
      >
        <div style={{ width: "100%", maxWidth: "28rem", textAlign: "center" }}>
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#f87171",
              margin: 0,
            }}
          >
            Error crítico
          </p>
          <h1
            style={{
              marginTop: "0.75rem",
              fontSize: "2.25rem",
              fontWeight: 700,
              lineHeight: 1.2,
              margin: "0.75rem 0 0 0",
            }}
          >
            La aplicación ha fallado
          </h1>
          <p style={{ marginTop: "1rem", color: "#a1a1aa" }}>
            Ha ocurrido un error que ha impedido cargar la aplicación. Puedes
            intentar recargar.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: "0.5rem",
                fontSize: "0.75rem",
                fontFamily: "ui-monospace, monospace",
                color: "#a1a1aa",
              }}
            >
              ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "2rem",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              backgroundColor: "#3b82f6",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
            }}
          >
            Recargar
          </button>
        </div>
      </body>
    </html>
  );
}
