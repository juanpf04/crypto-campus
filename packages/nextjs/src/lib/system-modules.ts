/**
 * system-modules.ts — Catálogo central de módulos lógicos del sistema.
 *
 * El usuario admin razona en términos de MÓDULOS (Biblioteca, Tienda, etc.),
 * no de contratos individuales. Algunos módulos agrupan varios contratos
 * (Biblioteca = LibraryManager + LibraryToken; Tienda = CampusShop + ShopToken).
 *
 * Este archivo es la fuente única de verdad para la sección de pausa modular:
 * lo importan tanto los server actions, las API routes como la UI.
 */

import {
  CONTRACT_ADDRESSES,
  CAMPUS_ROLES_ABI,
  LIBRARY_TOKEN_ABI,
  SHOP_TOKEN_ABI,
  BADGE_SYSTEM_ABI,
  PRINTER_ABI,
  LIBRARY_MANAGER_ABI,
  CAMPUS_SHOP_ABI,
  ROOM_BOOKING_ABI,
} from "@/lib/contracts";

/** Claves de los 8 contratos desplegados con funcionalidad Pausable. */
export type ContractKey =
  | "campusRoles"
  | "libraryManager"
  | "libraryToken"
  | "campusShop"
  | "shopToken"
  | "badgeSystem"
  | "roomBooking"
  | "printer";

/**
 * Mapa contrato → { address, abi } para reusar en lecturas (paused) y
 * escrituras (pause/unpause) sin duplicar lógica de selección.
 */
export const CONTRACT_META: Record<
  ContractKey,
  { address: `0x${string}`; abi: typeof CAMPUS_ROLES_ABI; label: string }
> = {
  campusRoles:    { address: CONTRACT_ADDRESSES.campusRoles    as `0x${string}`, abi: CAMPUS_ROLES_ABI,    label: "CampusRoles" },
  libraryManager: { address: CONTRACT_ADDRESSES.libraryManager as `0x${string}`, abi: LIBRARY_MANAGER_ABI, label: "LibraryManager" },
  libraryToken:   { address: CONTRACT_ADDRESSES.libraryToken   as `0x${string}`, abi: LIBRARY_TOKEN_ABI,   label: "LibraryToken" },
  campusShop:     { address: CONTRACT_ADDRESSES.campusShop     as `0x${string}`, abi: CAMPUS_SHOP_ABI,     label: "CampusShop" },
  shopToken:      { address: CONTRACT_ADDRESSES.shopToken      as `0x${string}`, abi: SHOP_TOKEN_ABI,      label: "ShopToken" },
  badgeSystem:    { address: CONTRACT_ADDRESSES.badgeSystem    as `0x${string}`, abi: BADGE_SYSTEM_ABI,    label: "BadgeSystem" },
  roomBooking:    { address: CONTRACT_ADDRESSES.roomBooking    as `0x${string}`, abi: ROOM_BOOKING_ABI,    label: "RoomBooking" },
  printer:        { address: CONTRACT_ADDRESSES.printer        as `0x${string}`, abi: PRINTER_ABI,         label: "Printer" },
};

/** Definición de un módulo lógico expuesto al admin. */
export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  description: string;
  contracts: readonly ContractKey[];
  iconKey: "users" | "library" | "shop" | "badge" | "rooms" | "print";
  /** Texto opcional de advertencia mostrado al admin antes de pausar. */
  warning?: string;
}

export type ModuleId = "roles" | "library" | "shop" | "badges" | "rooms" | "print";

/**
 * 6 módulos lógicos (los 8 contratos repartidos en 6 grupos funcionales).
 * El orden en este array determina el orden de visualización en la UI.
 */
export const MODULES: readonly ModuleDefinition[] = [
  {
    id: "roles",
    name: "Control de acceso",
    description: "Roles y permisos de usuarios",
    contracts: ["campusRoles"],
    iconKey: "users",
    warning:
      "Pausar este módulo bloqueará crear, editar y eliminar usuarios. " +
      "NO bloquea las consultas de rol que hacen otros módulos (siguen funcionando).",
  },
  {
    id: "library",
    name: "Biblioteca",
    description: "Préstamos de libros y tokens de depósito",
    contracts: ["libraryManager", "libraryToken"],
    iconKey: "library",
  },
  {
    id: "shop",
    name: "Tienda",
    description: "Compra de productos y tokens de pago",
    contracts: ["campusShop", "shopToken"],
    iconKey: "shop",
  },
  {
    id: "badges",
    name: "Insignias",
    description: "Tareas, premios y recompensas",
    contracts: ["badgeSystem"],
    iconKey: "badge",
  },
  {
    id: "rooms",
    name: "Salas",
    description: "Reservas de salas de estudio",
    contracts: ["roomBooking"],
    iconKey: "rooms",
  },
  {
    id: "print",
    name: "Impresión",
    description: "Trabajos de impresión y créditos",
    contracts: ["printer"],
    iconKey: "print",
  },
] as const;

/** Helper: módulo por id, lanza si no existe. */
export function getModule(id: string): ModuleDefinition {
  const mod = MODULES.find((m) => m.id === id);
  if (!mod) throw new Error(`Módulo desconocido: ${id}`);
  return mod;
}

/** Estado posible de un módulo según el estado de sus contratos. */
export type ModuleStatus = "active" | "paused" | "partial";

/**
 * Calcula el estado de un módulo a partir del estado individual de sus contratos.
 * - "active":  ningún contrato del módulo está pausado.
 * - "paused":  todos los contratos del módulo están pausados.
 * - "partial": al menos uno pausado pero no todos (solo posible si el módulo tiene >1 contrato).
 */
export function deriveModuleStatus(pausedFlags: boolean[]): ModuleStatus {
  if (pausedFlags.every((p) => p)) return "paused";
  if (pausedFlags.every((p) => !p)) return "active";
  return "partial";
}
