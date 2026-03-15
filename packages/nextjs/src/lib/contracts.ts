/**
 * contracts.ts — Registro central de contratos inteligentes desplegados.
 *
 * Este archivo centraliza dos cosas para cada contrato:
 * - Su DIRECCIÓN en la blockchain (dónde está desplegado).
 * - Su ABI (Application Binary Interface): la "interfaz" que describe qué
 *   funciones tiene el contrato y qué parámetros acepta/devuelve.
 *
 * Flujo de uso:
 * 1. Un módulo del backend importa la dirección y el ABI del contrato que necesita:
 *    import { CONTRACT_ADDRESSES, CAMPUS_ACCESS_CONTROL_ABI } from "@/lib/contracts";
 *
 * 2. Los usa con Viem para leer o escribir en el contrato:
 *    await adminWalletClient.writeContract({
 *      address: CONTRACT_ADDRESSES.campusAccessControl,
 *      abi: CAMPUS_ACCESS_CONTROL_ABI,
 *      functionName: "registerUser",
 *      args: [userAddress, ROLES.STUDENT],
 *    });
 *
 * Las direcciones son deterministas en Hardhat: al redesplegar los contratos
 * en el mismo orden, se generan las mismas direcciones. Si cambias el orden
 * de despliegue o añades contratos, hay que actualizar las direcciones aquí.
 *
 * Los ABIs se importan directamente de los artifacts que genera Hardhat
 * al compilar (hardhat/artifacts/...). Así, si se modifica un contrato
 * y se recompila, los cambios en el ABI se propagan automáticamente.
 *
 * Contratos del sistema CryptoCampus:
 * - CampusAccessControl: Control de acceso basado en roles (quién puede hacer qué).
 * - LibraryToken: Token ERC-20 para el sistema de biblioteca.
 * - ShopToken: Token ERC-20 para la tienda del campus.
 * - BadgeSystem: Sistema de badges/insignias NFT para logros académicos.
 * - PrintingService: Servicio de impresión que consume tokens.
 * - LibraryManager: Gestión de préstamos de libros.
 * - CampusShop: Tienda donde se intercambian tokens por productos/servicios.
 */

import CampusAccessControlArtifact from "../../../hardhat/artifacts/contracts/CampusAccessControl.sol/CampusAccessControl.json";
import LibraryTokenArtifact from "../../../hardhat/artifacts/contracts/LibraryToken.sol/LibraryToken.json";
import ShopTokenArtifact from "../../../hardhat/artifacts/contracts/ShopToken.sol/ShopToken.json";
import BadgeSystemArtifact from "../../../hardhat/artifacts/contracts/BadgeSystem.sol/BadgeSystem.json";
import PrintingServiceArtifact from "../../../hardhat/artifacts/contracts/PrintingService.sol/PrintingService.json";
import LibraryManagerArtifact from "../../../hardhat/artifacts/contracts/LibraryManager.sol/LibraryManager.json";
import CampusShopArtifact from "../../../hardhat/artifacts/contracts/CampusShop.sol/CampusShop.json";

/**
 * Direcciones de los contratos en la red local Hardhat (chain ID 31337).
 * Son deterministas: Hardhat asigna direcciones secuenciales basadas en
 * el nonce del deployer. El primer contrato siempre es 0x5Fb..., el segundo
 * 0xe7f..., etc.
 */
export const CONTRACT_ADDRESSES = {
  campusAccessControl: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  libraryToken:        "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  shopToken:           "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  badgeSystem:         "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  printingService:     "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  libraryManager:      "0x0165878A594ca255338adfa4d48449f69242Eb8F",
  campusShop:          "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
} as const;

/** ABIs extraídos de los artifacts de compilación de Hardhat */
export const CAMPUS_ACCESS_CONTROL_ABI = CampusAccessControlArtifact.abi;
export const LIBRARY_TOKEN_ABI         = LibraryTokenArtifact.abi;
export const SHOP_TOKEN_ABI            = ShopTokenArtifact.abi;
export const BADGE_SYSTEM_ABI          = BadgeSystemArtifact.abi;
export const PRINTING_SERVICE_ABI      = PrintingServiceArtifact.abi;
export const LIBRARY_MANAGER_ABI       = LibraryManagerArtifact.abi;
export const CAMPUS_SHOP_ABI           = CampusShopArtifact.abi;

/**
 * Hashes de roles para CampusAccessControl.
 *
 * En Solidity, los roles se identifican por el keccak256 de su nombre:
 *   bytes32 public constant STUDENT_ROLE = keccak256("STUDENT_ROLE");
 *
 * Aquí calculamos los mismos hashes con Viem para que coincidan exactamente.
 * Se usan al llamar a funciones como grantRole(ROLES.STUDENT, userAddress).
 */
import { keccak256, toBytes } from "viem";

export const ROLES = {
  STUDENT:   keccak256(toBytes("STUDENT_ROLE"))   as `0x${string}`,
  LIBRARIAN: keccak256(toBytes("LIBRARIAN_ROLE")) as `0x${string}`,
  PROFESSOR: keccak256(toBytes("PROFESSOR_ROLE")) as `0x${string}`,
  /** DEFAULT_ADMIN_ROLE en OpenZeppelin = 0x00...00 (32 bytes de ceros) */
  ADMIN:     "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
} as const;
