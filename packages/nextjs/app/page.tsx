"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { counterAbi } from "@/lib/counterAbi";

const COUNTER_ADDRESS = process.env.NEXT_PUBLIC_COUNTER_ADDRESS as `0x${string}`;

export default function Home() {
  const [incByAmount, setIncByAmount] = useState("");
  const { isConnected } = useAccount();

  // Leer el valor actual del contador
  const { data: count, refetch: refetchCount } = useReadContract({
    address: COUNTER_ADDRESS,
    abi: counterAbi,
    functionName: "x",
    query: { enabled: isConnected },
  });

  // Hook para escribir en el contrato
  const { writeContract, data: txHash, isPending, error } = useWriteContract();

  // Esperar confirmación de la tx
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  // Refrescar el valor después de confirmar la tx
  if (isConfirmed) {
    refetchCount();
  }

  const handleInc = () => {
    writeContract({
      address: COUNTER_ADDRESS,
      abi: counterAbi,
      functionName: "inc",
    });
  };

  const handleIncBy = () => {
    const amount = parseInt(incByAmount);
    if (!amount || amount <= 0) return;
    writeContract({
      address: COUNTER_ADDRESS,
      abi: counterAbi,
      functionName: "incBy",
      args: [BigInt(amount)],
    });
    setIncByAmount("");
  };

  const isLoading = isPending || isConfirming;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-8 rounded-2xl bg-white p-10 shadow-lg dark:bg-zinc-900">
        <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">
          Counter DApp
        </h1>

        {/* Botón de conexión de RainbowKit */}
        <ConnectButton />

        {isConnected && (
          <>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Contrato:{" "}
              <span className="font-mono text-xs">{COUNTER_ADDRESS}</span>
            </p>

            {/* Valor actual */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Valor actual
              </span>
              <span className="text-6xl font-bold tabular-nums text-black dark:text-white">
                {count !== undefined ? count.toString() : "—"}
              </span>
            </div>

            {/* Botón inc() */}
            <button
              onClick={handleInc}
              disabled={isLoading}
              className="w-full rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {isConfirming
                ? "Confirmando..."
                : isPending
                  ? "Firma en wallet..."
                  : "Incrementar (+1)"}
            </button>

            {/* incBy() */}
            <div className="flex w-full gap-2">
              <input
                type="number"
                min="1"
                placeholder="Cantidad"
                value={incByAmount}
                onChange={(e) => setIncByAmount(e.target.value)}
                className="flex-1 rounded-full border border-zinc-300 px-4 py-3 text-sm text-black outline-none focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white"
              />
              <button
                onClick={handleIncBy}
                disabled={isLoading}
                className="rounded-full border border-black px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
              >
                Incrementar
              </button>
            </div>

            {/* Refrescar */}
            <button
              onClick={() => refetchCount()}
              className="text-sm text-zinc-500 underline transition-colors hover:text-black dark:hover:text-white"
            >
              Refrescar valor
            </button>

            {/* Error */}
            {error && (
              <p className="text-center text-sm text-red-500">
                {error.message.slice(0, 100)}
              </p>
            )}

            {/* Tx hash */}
            {txHash && (
              <p className="break-all text-center text-xs text-zinc-400">
                Última tx: {txHash}
                {isConfirmed && " ✓"}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
