import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * CampusModule
 *
 * Despliega todos los contratos del ecosistema CryptoCampus en orden.
 *
 * Orden de despliegue:
 *   1. CampusAccessControl  — sin dependencias
 *   2. LibraryToken         — necesita CampusAccessControl
 *   3. ShopToken            — necesita CampusAccessControl
 *   4. BadgeSystem          — necesita CampusAccessControl
 *   5. Printer              — necesita CampusAccessControl
 *   6. LibraryManager       — necesita CampusAccessControl + LibraryToken
 *   7. CampusShop           — necesita CampusAccessControl + ShopToken
 *
 * Post-despliegue:
 *   - LibraryToken.setTrustedSpender(LibraryManager)
 *   - ShopToken.setTrustedSpender(CampusShop)
 */
export default buildModule("CampusModule", (m) => {
  // URI base para contratos ERC-1155. En local se puede dejar vacío o con placeholder.
  const badgeUri    = m.getParameter("badgeUri",   "https://cryptocampus.local/badges/{id}.json");
  const libraryUri  = m.getParameter("libraryUri", "https://cryptocampus.local/library/{id}.json");
  const shopUri     = m.getParameter("shopUri",    "https://cryptocampus.local/shop/{id}.json");

  // 1. CampusAccessControl
  const accessControl = m.contract("CampusAccessControl");

  // 2. LibraryToken
  const libraryToken = m.contract("LibraryToken", [accessControl]);

  // 3. ShopToken
  const shopToken = m.contract("ShopToken", [accessControl]);

  // 4. BadgeSystem
  const badgeSystem = m.contract("BadgeSystem", [accessControl, badgeUri]);

  // 5. Printer
  const printer = m.contract("Printer", [accessControl]);

  // 6. LibraryManager
  const libraryManager = m.contract("LibraryManager", [
    accessControl,
    libraryToken,
    libraryUri,
  ]);

  // 7. CampusShop
  const campusShop = m.contract("CampusShop", [
    accessControl,
    shopToken,
    shopUri,
  ]);

  // Post-despliegue: configurar trusted spenders
  // LibraryManager puede gastar LibraryTokens de los estudiantes sin approve individual.
  m.call(libraryToken, "setTrustedSpender", [libraryManager], {
    id: "setLibraryTrustedSpender",
  });

  // CampusShop puede gastar ShopTokens de los estudiantes sin approve individual.
  m.call(shopToken, "setTrustedSpender", [campusShop], {
    id: "setShopTrustedSpender",
  });

  return {
    accessControl,
    libraryToken,
    shopToken,
    badgeSystem,
    printer,
    libraryManager,
    campusShop,
  };
});
