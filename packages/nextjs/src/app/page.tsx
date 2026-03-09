import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 dark:bg-black">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-black dark:text-white">
          CryptoCampus
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Plataforma universitaria basada en blockchain — UCM
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Iniciar sesión
        </Link>
        <Link
          href="/register"
          className="rounded-full border border-black px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-zinc-100 dark:border-white dark:text-white dark:hover:bg-zinc-900"
        >
          Registrarse
        </Link>
      </div>
    </main>
  );
}
