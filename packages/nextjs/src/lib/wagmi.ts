/**
 * wagmi.ts — Configuración de Wagmi para interacción Web3 desde el frontend.
 *
 * Wagmi es una librería de React que facilita la conexión con wallets
 * Ethereum y la interacción con contratos inteligentes.
 *
 * Flujo:
 * 1. createConfig() crea la configuración central de Wagmi.
 * 2. Se define que la única chain soportada es Hardhat (red local, chain ID 31337).
 * 3. El transporte es HTTP (se conecta al nodo Hardhat en http://127.0.0.1:8545).
 * 4. ssr: true indica que la config es compatible con Server-Side Rendering
 *    de Next.js (evita errores de hidratación).
 *
 * Esta config se pasa a <WagmiProvider config={config}> en providers.tsx,
 * y desde ahí cualquier componente puede usar hooks como useAccount(),
 * useWriteContract(), etc.
 */

import { createConfig, http } from "wagmi";
import { hardhat } from "wagmi/chains";

export const config = createConfig({
  chains: [hardhat],       // Solo red local Hardhat (chain ID 31337)
  transports: {
    [hardhat.id]: http(),  // HTTP transport al nodo local (127.0.0.1:8545)
  },
  ssr: true,               // Compatible con SSR de Next.js
});
