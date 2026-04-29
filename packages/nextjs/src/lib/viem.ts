/**
 * viem.ts — Clientes de Viem para interactuar con la blockchain desde el servidor.
 *
 * Viem es una librería TypeScript para Ethereum, alternativa moderna a ethers.js.
 * Aquí se crean dos clientes que usa el backend (API routes) para operar on-chain:
 *
 * 1. adminAccount — La cuenta 0 de Hardhat (el deployer).
 *    - Se crea a partir de su clave privada (conocida y fija en Hardhat).
 *    - Esta cuenta desplegó todos los contratos y tiene roles de admin.
 *    - Tiene fondos ilimitados (10,000 ETH en Hardhat).
 *
 * 2. adminWalletClient — Cliente para ESCRIBIR en la blockchain.
 *    - Puede enviar transacciones firmadas con adminAccount.
 *    - Se usa para: registrar usuarios on-chain, asignar roles, transferir tokens, etc.
 *    - Flujo: adminWalletClient.writeContract({ abi, address, functionName, args })
 *      → firma la tx con la clave privada del admin → la envía al nodo Hardhat.
 *
 * 3. publicClient — Cliente para LEER de la blockchain (sin firma).
 *    - Solo operaciones de lectura: balances, datos de contratos, eventos, etc.
 *    - Flujo: publicClient.readContract({ abi, address, functionName, args })
 *      → hace una llamada estática al nodo (no gasta gas).
 *
 * Ambos clientes se conectan al nodo local Hardhat (http://127.0.0.1:8545)
 * vía transporte HTTP.
 *
 * NOTA: La clave privada de Hardhat Account[0] es pública y conocida.
 * Solo es segura para desarrollo local. En producción se usaría otra cosa.
 */

import { createWalletClient, createPublicClient, http, nonceManager } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";

// Clave privada del Account[0] de Hardhat — pública y fija para desarrollo
const HARDHAT_ACCOUNT_0_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

/**
 * Cuenta admin: tiene permisos de admin en los contratos y fondos ilimitados.
 * `nonceManager` serializa la asignación de nonce para evitar "nonce too low"
 * cuando se disparan varias txs en paralelo (p. ej. otorgar premio a N alumnos).
 */
export const adminAccount = privateKeyToAccount(HARDHAT_ACCOUNT_0_KEY, { nonceManager });

/** Cliente de escritura: envía transacciones firmadas por el admin */
export const adminWalletClient = createWalletClient({
  account: adminAccount,
  chain: hardhat,
  transport: http(), // Se conecta a http://127.0.0.1:8545
});

/** Cliente de lectura: consultas on-chain sin necesidad de firma */
export const publicClient = createPublicClient({
  chain: hardhat,
  transport: http(), // Se conecta a http://127.0.0.1:8545
});
