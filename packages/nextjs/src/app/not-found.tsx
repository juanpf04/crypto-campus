import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada — CryptoCampus",
  description: "La página que buscas no existe o ha sido movida.",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="mx-auto w-full max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Error 404
        </p>
        <h1 className="mt-3 text-4xl font-bold text-text sm:text-5xl">
          Página no encontrada
        </h1>
        <p className="mt-4 text-base text-text-muted">
          La página que buscas no existe, ha sido movida o el enlace que has
          seguido no es correcto.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
