/**
 * contracts.ts
 *
 * Direcciones y ABIs de los contratos desplegados en la red local Hardhat.
 * Las direcciones corresponden al despliegue en chain-31337 (localhost).
 *
 * Los ABIs se importan directamente desde los artifacts de Hardhat,
 * así si se recompilan los contratos los cambios se propagan automáticamente.
 *
 * Si redespliegas los contratos, actualiza las direcciones de CONTRACT_ADDRESSES.
 */

import CampusAccessControlArtifact from "../../hardhat/artifacts/contracts/CampusAccessControl.sol/CampusAccessControl.json";
import LibraryTokenArtifact from "../../hardhat/artifacts/contracts/LibraryToken.sol/LibraryToken.json";
import ShopTokenArtifact from "../../hardhat/artifacts/contracts/ShopToken.sol/ShopToken.json";
import BadgeSystemArtifact from "../../hardhat/artifacts/contracts/BadgeSystem.sol/BadgeSystem.json";
import PrintingServiceArtifact from "../../hardhat/artifacts/contracts/PrintingService.sol/PrintingService.json";
import LibraryManagerArtifact from "../../hardhat/artifacts/contracts/LibraryManager.sol/LibraryManager.json";
import CampusShopArtifact from "../../hardhat/artifacts/contracts/CampusShop.sol/CampusShop.json";

// Direcciones del despliegue local (chain-31337)
export const CONTRACT_ADDRESSES = {
  campusAccessControl: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  libraryToken:        "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  shopToken:           "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  badgeSystem:         "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  printingService:     "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  libraryManager:      "0x0165878A594ca255338adfa4d48449f69242Eb8F",
  campusShop:          "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
} as const;

// ABIs extraídos de los artifacts
export const CAMPUS_ACCESS_CONTROL_ABI = CampusAccessControlArtifact.abi;
export const LIBRARY_TOKEN_ABI         = LibraryTokenArtifact.abi;
export const SHOP_TOKEN_ABI            = ShopTokenArtifact.abi;
export const BADGE_SYSTEM_ABI          = BadgeSystemArtifact.abi;
export const PRINTING_SERVICE_ABI      = PrintingServiceArtifact.abi;
export const LIBRARY_MANAGER_ABI       = LibraryManagerArtifact.abi;
export const CAMPUS_SHOP_ABI           = CampusShopArtifact.abi;

// Roles de CampusAccessControl.
// Se calculan con viem para garantizar que coinciden exactamente con lo que
// devuelve el contrato (keccak256 del string UTF-8, igual que Solidity).
import { keccak256, toBytes } from "viem";

export const ROLES = {
  STUDENT:   keccak256(toBytes("STUDENT_ROLE"))   as `0x${string}`,
  LIBRARIAN: keccak256(toBytes("LIBRARIAN_ROLE")) as `0x${string}`,
  PROFESSOR: keccak256(toBytes("PROFESSOR_ROLE")) as `0x${string}`,
} as const;
