"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Error capturado por error.tsx:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="mx-auto w-full max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-danger">
          Error 500
        </p>
        <h1 className="mt-3 text-4xl font-bold text-text sm:text-5xl">
          Algo ha fallado
        </h1>
        <p className="mt-4 text-base text-text-muted">
          Ha ocurrido un error inesperado al cargar esta página. Puedes
          intentarlo de nuevo o volver al inicio.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs font-mono text-text-muted">
            ref: {error.digest}
          </p>
        )}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Intentar de nuevo
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-border-default bg-transparent px-5 py-2.5 text-sm font-medium text-text transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-default focus-visible:ring-offset-2"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
