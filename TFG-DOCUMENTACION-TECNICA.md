# CryptoCampus — Documentación técnica para la memoria del TFG

## Índice

1. [Qué es CryptoCampus](#1-qué-es-cryptocampus)
2. [Arquitectura: monorepo con pnpm workspaces](#2-arquitectura-monorepo-con-pnpm-workspaces)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Motor blockchain: Anvil por defecto, Hardhat opt-in](#4-motor-blockchain-anvil-por-defecto-hardhat-opt-in)
5. [Contratos inteligentes](#5-contratos-inteligentes)
6. [Sistema de recompensas automáticas](#6-sistema-de-recompensas-automáticas)
7. [Doble base de datos (blockchain + PostgreSQL)](#7-doble-base-de-datos-blockchain--postgresql)
8. [Modelo de datos — Prisma schema](#8-modelo-de-datos--prisma-schema)
9. [Wallets custodiales](#9-wallets-custodiales)
10. [Arquitectura frontend: Atomic Design](#10-arquitectura-frontend-atomic-design)
11. [Patrón de Server Actions](#11-patrón-de-server-actions)
12. [Hooks custom](#12-hooks-custom)
13. [Autenticación y seguridad](#13-autenticación-y-seguridad)
14. [Flujos end-to-end](#14-flujos-end-to-end)
15. [Patrones UX transversales](#15-patrones-ux-transversales)
16. [Pausa modular del sistema (kill-switch)](#16-pausa-modular-del-sistema-kill-switch)
17. [Sistema de testing dual](#17-sistema-de-testing-dual)
18. [Flujo de desarrollo](#18-flujo-de-desarrollo)
19. [Decisiones arquitectónicas relevantes](#19-decisiones-arquitectónicas-relevantes)
20. [Glosario](#20-glosario)
21. [Métricas del proyecto](#21-métricas-del-proyecto)

---

## 1. Qué es CryptoCampus

CryptoCampus es una **aplicación descentralizada (dApp)** universitaria que integra servicios del campus (biblioteca, tienda, insignias académicas, impresión y salas de estudio) con contratos inteligentes en Ethereum. El término "descentralizada" se refiere a que la lógica de negocio crítica (balances, préstamos, compras, acuñación de tokens, registros de actividad) se ejecuta en contratos inteligentes inmutables sobre la blockchain, aportando transparencia y trazabilidad a las operaciones.

A diferencia de una dApp pura donde los usuarios gestionan sus propias wallets (MetaMask, etc.), CryptoCampus utiliza un modelo de **wallets custodiales**: el servidor genera y gestiona las claves privadas cifradas con AES-256-GCM. Esto permite una experiencia convencional (login con email/contraseña) mientras mantiene las garantías de inmutabilidad de la blockchain como registro de verdad.

### Diagrama conceptual

```
┌──────────────┐       ┌────────────────┐       ┌─────────────────┐
│   Usuario    │       │   Next.js 16   │       │  PostgreSQL 15  │
│  (browser)   │◄─────►│  (SSR + RSC +  │◄─────►│   (metadata)    │
│              │       │ Server Actions)│       │                 │
└──────────────┘       └───────┬────────┘       └─────────────────┘
                               │
                               │ firma y lee vía viem
                               ▼
                       ┌───────────────┐
                       │ Anvil/Hardhat │   ← nodo Ethereum local
                       │   (chain 31337) │
                       ├───────────────┤
                       │  8 contratos   │   ← CampusRoles, tokens,
                       │   Solidity    │      managers, BadgeSystem…
                       └───────────────┘
```

La frontera **cliente ↔ servidor** se delimita con Server Actions (`"use server"`). Cualquier interacción con blockchain o Prisma pasa por el servidor — el navegador nunca ve claves privadas, ABIs completos ni credenciales.

---

## 2. Arquitectura: monorepo con pnpm workspaces

El proyecto se organiza como un **monorepo** — un único repositorio con dos paquetes independientes pero coordinados.

### Qué implica ser un monorepo

- **Dependencias compartidas**: pnpm gestiona las dependencias con un único lockfile (`pnpm-lock.yaml`), evitando duplicidades.
- **Scripts unificados**: Desde la raíz se compila, testea y despliega todo con un solo comando.
- **Aislamiento de paquetes**: Cada paquete tiene su `package.json` y `tsconfig` propios.
- **Compilación cruzada**: El paquete de Next.js importa directamente los ABIs compilados del paquete de Hardhat, creando un vínculo tipado entre ambas capas.

### Estructura del repositorio

```
CryptoCampus/
├── package.json                 # Workspace root — scripts globales
├── pnpm-workspace.yaml          # Configuración del monorepo
├── docker-compose.yaml          # PostgreSQL para desarrollo
├── scripts/
│   ├── dev.mjs                  # Orquestador de arranque (3xx líneas)
│   ├── seed.mjs                 # Lanzador de todos los seeds
│   └── reset-chain.mjs          # Borra estado on-chain local
│
├── packages/hardhat/            # Capa blockchain
│   ├── contracts/               # 8 contratos Solidity
│   ├── test/                    # Tests TypeScript + Foundry
│   └── ignition/modules/        # CampusModule.ts
│
└── packages/nextjs/             # Capa web full-stack
    ├── prisma/schema.prisma     # 26 modelos
    ├── scripts/                 # 12 scripts (seeds + resync + cleanup + db-doctor + datos históricos)
    ├── e2e/                     # Tests E2E (Playwright)
    └── src/
        ├── actions/             # 8 módulos (incluye system.ts, pausa modular)
        ├── app/                 # App Router — 128 pages + 117 API routes
        ├── components/          # ui/ + shared/ + forms/ + dashboard/ + printing/ + layout/
        ├── hooks/               # 5 hooks custom
        ├── lib/                 # utilidades server/cliente (incluye system-modules, contractErrors, historical, validators, themes)
        ├── contexts/            # 4 contextos React (Cart, Onboarding, Theme, Toast)
        └── types/               # tipos compartidos
```

---

## 3. Stack tecnológico

### Capa blockchain

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| Solidity | 0.8.28 | Lenguaje de contratos |
| Hardhat | 3.x | Entorno de desarrollo Solidity |
| Hardhat Ignition | 3.x | Sistema declarativo de despliegue |
| OpenZeppelin Contracts | 5.6.1 | Librería de contratos estándar (ERC-20, ERC-1155, AccessControl, Pausable) |
| Viem | 2.x | Cliente blockchain tipado para TypeScript |
| Foundry (Anvil + Forge) | latest | Nodo local persistente + tests en Solidity |

### Capa web (frontend + backend)

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| Next.js | 16.x | Framework full-stack React con App Router |
| React | 19.x | Librería de UI |
| TypeScript | 5.8 | Tipado estático |
| Tailwind CSS | 4 | Utility-first CSS |
| Prisma | 7 | ORM para PostgreSQL con cliente tipado |
| PostgreSQL | 15 | Base de datos relacional (via Docker) |
| iron-session | 8 | Sesiones cifradas en cookies httpOnly |
| bcryptjs | 3 | Hashing de contraseñas con salt |
| Recharts | 3 | Gráficos para dashboards |
| pdf-lib | 1 | Manipulación de PDFs (simulador de impresión) |
| qrcode.react | 4 | Generación de códigos QR (reservas de salas) |
| react-dropzone | 15 | Subida de archivos |
| pnpm | 10.33 | Gestor de paquetes para monorepo |
| ESLint | 9 | Linter |

---

## 4. Motor blockchain: Anvil por defecto, Hardhat opt-in

El arranque local (`scripts/dev.mjs`) utiliza por defecto **Anvil** (Foundry). Anvil:

- Arranca un nodo Ethereum local en `127.0.0.1:8545` con chain id `31337`.
- Guarda el estado en `.anvil-state.json` y lo recarga al reiniciar. Auto-save cada 30 s.
- Permite que **contratos desplegados, balances y transacciones persistan** entre reinicios de `pnpm dev`.

Alternativamente puede forzarse `hardhat node` (volátil, estado se pierde al parar) con `pnpm dev:hardhat`, el flag `--hardhat` o la variable `BLOCKCHAIN_NODE=hardhat`. Útil en entornos donde Foundry no se puede instalar.

El script detecta si los contratos ya están desplegados mediante una llamada `eth_getCode` a `CampusRoles`. Si el bytecode existe, se salta el deploy. Esto hace que los arranques sucesivos con Anvil persistente sean casi instantáneos.

---

## 5. Contratos inteligentes

### 5.1 Estándares ERC utilizados

- **ERC-20** (`LibraryToken`, `ShopToken`): Tokens fungibles para créditos. `LibraryToken` es el depósito para préstamos; `ShopToken` es la moneda de la tienda y del sistema de recompensas.
- **ERC-1155** (`LibraryManager`, `CampusShop`, `BadgeSystem`): Tokens multi-tipo. Un único contrato gestiona múltiples tipos de activos (libros, productos, insignias) donde cada `tokenId` representa un tipo y la cantidad representa copias/unidades.
- **AccessControl** de OpenZeppelin (`CampusRoles`): Gestión de roles on-chain con 4 roles (STUDENT, PROFESSOR, LIBRARIAN, ADMIN) y permisos granulares.

### 5.2 Contratos de producción (8)

| Contrato | Estándar | Función |
|----------|----------|---------|
| `CampusRoles` | AccessControl + Pausable | Control de acceso basado en roles. Punto central de permisos |
| `LibraryToken` | ERC-20 + Pausable | Token de depósito para préstamos. 0 decimales. `trustedSpender` para operaciones sin approve |
| `ShopToken` | ERC-20 + Pausable | Moneda de la tienda y sistema de recompensas. Misma estructura que LibraryToken |
| `LibraryManager` | ERC-1155 + ERC1155Supply + ReentrancyGuard + Pausable | Catálogo y préstamos. Cola FIFO automática. Cada tokenId = un título |
| `CampusShop` | ERC-1155 + ERC1155Supply + ReentrancyGuard + Pausable | Tienda con compras individuales y en lotes (batches). Devoluciones con recibos |
| `BadgeSystem` | ERC-1155 + ERC1155Supply + Pausable | Insignias académicas soulbound (`_update()` bloqueado). Profesores crean tareas, alumnos ganan badges |
| `Printer` | Pausable | Créditos de impresión. 1 crédito = 1 página. Admin/Librarian tienen créditos ilimitados |
| `RoomBooking` | ReentrancyGuard + Pausable | Reserva de salas. Slots por hora. Máx 4 h consecutivas, 1 reserva/día/estudiante |

### 5.3 Estándar de estilo Solidity

Todos los contratos siguen el [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html) oficial:

```
1. Type declarations (structs, enums)
2. State variables
3. Events
4. Errors (custom errors, no require con strings)
5. Modifiers
6. Functions:
   a. Constructor
   b. receive() / fallback() si existen
   c. External (mutables → view → pure)
   d. Public (mutables → view → pure)
   e. Internal
   f. Private
```

Dentro de cada grupo de visibilidad la mutabilidad va de menos restrictiva a más: `payable` → no-payable → `view` → `pure`. Naming: `CapWords` para contratos/structs/enums/eventos/errores, `mixedCase` para funciones/parámetros/locales, `SCREAMING_SNAKE_CASE` para `constant`/`immutable`, y leading `_` para internos/privados.

**NatSpec uniforme**: todos los miembros `external`/`public` (funciones, errores, eventos, state variables, modifiers, constructor) llevan `/// @notice` / `@dev` / `@param` / `@return` en estilo triple-slash. Sin mezclar bloques `/** */`.

**Optimizer**: `solc 0.8.28` con `runs: 200` y **`viaIR: true`** en ambos profiles (default + production). La pipeline IR reduce el tamaño del bytecode de los contratos grandes (BadgeSystem -28 %, LibraryManager -20 %, Printer -44 %), dejando los 8 contratos de producción muy por debajo del límite EIP-170 de 24 576 bytes (el mayor, BadgeSystem, ocupa el 58 %).

### 5.4 Patrones de seguridad

- **CEI (Checks-Effects-Interactions)**: Todas las funciones verifican, actualizan estado y después hacen llamadas externas. Previene reentrancia.
- **ReentrancyGuard**: Aplicado en funciones con transferencias ERC-1155 (`LibraryManager`, `CampusShop`, `RoomBooking`).
- **Pausable**: Los **8 contratos de producción** heredan `Pausable` de OpenZeppelin. Cada uno expone `pause()`/`unpause()` que solo el admin (`ADMIN_ROLE`, custom — no `DEFAULT_ADMIN_ROLE`, para evitar colisión con el centinela `NO_ROLE = bytes32(0)`) puede invocar. Al pausar, OpenZeppelin protege todas las funciones decoradas con `whenNotPaused` y revierte con el custom error `EnforcedPause()` (selector `0xd93c0665`). El sistema de pausa modular (§16) explota esto agrupando los 8 contratos en 6 módulos lógicos.
- **Custom errors**: En vez de `require("mensaje")` se usan errores tipados (`error NotStudent(address)`) que consumen menos gas y son más informativos.
- **Restricción de transferencias**: `LibraryManager` y `BadgeSystem` sobrescriben `_update()` para impedir transferencias directas entre usuarios; solo el contrato media las operaciones. En `BadgeSystem` esto implementa el patrón **soulbound** — las insignias no son intercambiables.
- **Helpers de rol uniformes**: todos los consumidores de `CampusRoles` (Printer, LibraryToken, ShopToken, LibraryManager, CampusShop, RoomBooking, BadgeSystem) chequean permisos con `campusRoles.isAdmin(addr)` / `isLibrarian(addr)` / `isProfessor(addr)` / `isStudent(addr)` en lugar de `hasRole(XXX_ROLE(), addr)`. Mismo resultado, una llamada externa en vez de dos y código más legible.
- **Funciones no expuestas pero presentes**: `CampusRoles.removeUser()` y `changeRole()` están implementadas, testeadas y son operativas pero deliberadamente no se exponen en la UI (los efectos sobre relaciones off-chain — préstamos activos, asignaturas vinculadas, badges — exceden el alcance del TFG). Documentado con NatSpec en el propio contrato.

### 5.5 Despliegue declarativo con Hardhat Ignition

El despliegue se define en [`packages/hardhat/ignition/modules/CampusModule.ts`](packages/hardhat/ignition/modules/CampusModule.ts). Ignition descubre dependencias entre contratos (ej. `LibraryManager` recibe la dirección de `LibraryToken` en el constructor) y orquesta el despliegue en el orden correcto. Tras desplegar, el script de `dev.mjs` llama a `setTrustedSpender()` para configurar los permisos cross-contract necesarios.

---

## 6. Sistema de recompensas automáticas

Una de las piezas distintivas de CryptoCampus es el **sistema de recompensas en ShopTokens**: ciertas acciones de usuario gatillan acuñación automática de SHPT sin intervención manual, persistiendo un log auditable.

### 6.1 Catálogo de recompensas

Definido en [`packages/nextjs/src/lib/shopRewardsMeta.ts`](packages/nextjs/src/lib/shopRewardsMeta.ts):

| Razón (`ShopTokenRewardReason`) | SHPT | Cuándo se otorga |
|---|---|---|
| `LOAN_RETURNED_ON_TIME` | 2 | Al devolver un préstamo antes de la fecha límite |
| `LOAN_RETURNED_EARLY` | 3 | Al devolver anticipadamente (bonus sobre el anterior) |
| `ROOM_BOOKED` | 1 | Por cada reserva de sala confirmada |
| `BADGE_AWARDED` | 5 × insignia | Por cada insignia académica concedida |
| `PRINT_JOB` | `ceil(pages / 10)` | Al completar un trabajo de impresión |
| `MODULE_FIRST_USE_LIBRARY` | 2 | Primera interacción con el módulo (una sola vez) |
| `MODULE_FIRST_USE_ROOMS` | 2 | Ídem |
| `MODULE_FIRST_USE_PRINTING` | 2 | Ídem |
| `MODULE_FIRST_USE_BADGES` | 2 | Ídem |
| `MODULE_FIRST_USE_SHOP` | 2 | Ídem |

### 6.2 Implementación

- **Helper central**: [`lib/shopRewards.ts`](packages/nextjs/src/lib/shopRewards.ts) expone `mintShopReward()` y `issueReward()`. El primero llama a `ShopToken.mint()` vía admin y registra en la tabla `ShopTokenReward`. El segundo es el wrapper que compone "acción principal + bonus de primer uso si procede".
- **Tipos compartidos cliente/servidor**: [`lib/shopRewardsMeta.ts`](packages/nextjs/src/lib/shopRewardsMeta.ts) aísla los enums y constantes del helper de servidor para no arrastrar Prisma/Viem al bundle del navegador.
- **Puntos de invocación**: `actions/library.ts` (devolución), `actions/rooms.ts` (reserva), `actions/printing.ts` (impresión), `actions/badges.ts` (award + canje), `actions/shop.ts` (primer uso).
- **UX**: tras la acción, el cliente recibe un array `RewardGrant[]` y muestra un toast por recompensa vía `toastRewards()` (helper en `lib/rewardToast.ts`).

---

## 7. Doble base de datos (blockchain + PostgreSQL)

CryptoCampus emplea un modelo de **doble ledger**:

- **Blockchain** (verdad inmutable): IDs on-chain, balances, estados de préstamos, transacciones de compra, depósitos. Sirve como registro de auditoría y garantiza que los datos no pueden manipularse.
- **PostgreSQL** (metadatos ricos): Nombres, descripciones, imágenes, emails, contraseñas, relaciones complejas. Permite queries SQL eficientes, paginación y búsqueda.

Cada entidad con representación on-chain tiene un **ID dual**: un `id` CUID en Prisma y un `tokenId`/`loanId`/`orderId` numérico on-chain. Los `txHash` (hashes de transacción) vinculan ambos mundos.

### Quién guarda qué (ejemplos)

| Dato | Blockchain | Prisma |
|---|---|---|
| Copias disponibles de un libro | ✅ `LibraryManager` (ERC-1155 supply) | No |
| Título, autor, ISBN | No | ✅ `LibraryItem` |
| Estado del préstamo | ✅ `LibraryManager.Loan.status` | ✅ `Loan.status` (redundante para queries rápidas) |
| Saldo de `LibraryTokens` | ✅ `LibraryToken` (ERC-20) | No |
| Precio y stock de un producto | ✅ `CampusShop` | No |
| Imagen, descripción, categoría | No | ✅ `Product` / `ProductBase` |
| `txHash` de una transacción | No | ✅ En la entidad correspondiente |

### Reconciliación

Si una transacción blockchain tiene éxito pero el guardado en Prisma falla, el sistema registra el `txHash` junto al contexto para reconciliación manual mediante `logPrismaRecovery()`. Esto permite replicar el efecto en Prisma en un paso posterior sin re-emitir la transacción.

---

## 8. Modelo de datos — Prisma schema

26 modelos en [`packages/nextjs/prisma/schema.prisma`](packages/nextjs/prisma/schema.prisma), agrupados por dominio. Las entidades con representación on-chain incluyen un flag `historical: Boolean` para diferenciar registros reales de los seeds de demo (ver §19).

### 8.1 Usuarios y autenticación

| Modelo | Qué guarda |
|---|---|
| `User` | email, `password` (bcrypt), `address` (wallet), `encryptedKey` (AES-256-GCM), `role`, `active` |

### 8.2 Academic (asignaturas y grupos)

| Modelo | Qué guarda |
|---|---|
| `Subject` | Asignatura maestra: nombre, código |
| `SubjectOffering` | Grupo: `subject` + `professor` + group (p. ej. "2ºA") + `academicYear` |
| `Enrollment` | Matrícula: `user × subjectOffering` (unique) |

### 8.3 Badges (insignias académicas)

| Modelo | Qué guarda |
|---|---|
| `SubjectBadge` | Insignia on-chain asociada a un offering (1:1 con SubjectOffering) |
| `Assignment` | Tarea que el profesor crea dentro del badge del offering |
| `PrizeCategory` | Categoría de premio dentro de una Assignment (nombre, recompensa en badges, max ganadores) |
| `TaskSubmission` | Entrega del alumno a una Assignment |
| `BadgeAward` | Registro de que un alumno ganó una insignia (soulbound on-chain) |
| `Reward` | Recompensa canjeable con badges del subject (`rewardId` on-chain) |
| `RewardRedemption` | Registro de un canje (un token quemado) |
| `UseRequest` | Solicitud de usar una recompensa ya canjeada (estados: PENDING/APPROVED/REJECTED/CANCELLED) |

### 8.4 Library (biblioteca)

| Modelo | Qué guarda |
|---|---|
| `LibraryItem` | Ítem prestable (libro/juego/videojuego) — `type`, `title`, `creator`, `totalCopies`, metadata, `tokenId` |
| `Loan` | Préstamo — `status` (QUEUED/RESERVED/PICKED_UP/RETURNED/CANCELLED/EXPIRED), fechas, `txHash` |

### 8.5 Rooms (salas)

| Modelo | Qué guarda |
|---|---|
| `Room` | Sala física — nombre, capacidad, localización, amenidades |
| `RoomBooking` | Reserva — `user`, `room`, `date`, `startHour`, `duration`, `cancelled`, `txHash` |

### 8.6 Printing (impresión)

| Modelo | Qué guarda |
|---|---|
| `Printer` | Impresora física — `id` (code), `name`, `location`, `active` |
| `PrintLog` | Registro de impresión — opciones de impresión, `creditsUsed`, `txHash` |

### 8.7 Shop (tienda)

| Modelo | Qué guarda |
|---|---|
| `ProductBase` | Producto base (sin color) — nombre, descripción, categoría, `slug` |
| `Product` | Variante (color, precio, stock, imagen) — ligado a `ProductBase`, `tokenId` on-chain |
| `Cart` | Carrito abierto del usuario (1:1 con User) |
| `CartItem` | Ítem del carrito con `quantity` |
| `Order` | Compra individual (un producto) — `status` (PAID/DELIVERED/RETURNED) |
| `OrderBatch` | Agrupación de compras en un mismo checkout — `txHash`, `totalPaid`, `generalStatus` |

### 8.8 Recompensas y auditoría

| Modelo | Qué guarda |
|---|---|
| `ShopTokenReward` | Log de cada mint automático de SHPT — `userId`, `amount`, `reason`, `txHash` |
| `CardTopupSimulation` | Registro de cada topup simulado de saldo (tarjeta falsa) |

### 8.9 Relaciones clave

```
User ──< Enrollment >── SubjectOffering ──> Subject
                              │
                              ├──> SubjectBadge ──< Assignment ──< PrizeCategory ──< BadgeAward >── User
                              │                                                          │
                              │                                                          └──< TaskSubmission >── User
                              │
                              └──> Reward ──< RewardRedemption >── User
                                        │
                                        └──< UseRequest >── User

User ──< Loan >── LibraryItem
User ──< RoomBooking >── Room
User ──< PrintLog >── Printer
User ──< OrderBatch >── Order ──> Product ──> ProductBase
User ──< ShopTokenReward >
```

---

## 9. Wallets custodiales

En vez de requerir MetaMask:

1. Al registrarse, el servidor genera una clave privada con `generatePrivateKey()` de Viem.
2. La clave se cifra con **AES-256-GCM** (IV aleatorio único por usuario) usando `process.env.SESSION_SECRET`.
3. Se almacena como `encryptedKey` en la tabla `User`.
4. Cuando el usuario necesita firmar una transacción, el servidor descifra la clave, crea un `WalletClient` temporal y firma.
5. Para operaciones administrativas (approve préstamos, crear productos, mintear recompensas), se usa la wallet del admin (Account #0 de Hardhat/Anvil).

**Ventaja**: UX convencional (email + contraseña). **Trade-off**: el servidor custodia las claves; la seguridad descansa en `SESSION_SECRET` y bcrypt.

---

## 10. Arquitectura frontend: Atomic Design

Los componentes siguen el patrón **Atomic Design** de Brad Frost, con una separación estricta por capas:

### Atoms (`components/ui/`) — 40 componentes

Elementos UI mínimos e independientes del dominio: `Button`, `Input`, `Card`, `Badge`, `Table`, `Modal`, `Pagination`, `Spinner`, `Skeleton`, `Drawer`, `Select`, `Tabs`, `Toggle`, `FilterPills`, `SearchInput`, etc.

Cada atom acepta variantes (`variant="primary"`, `size="sm"`) y un `className` para composición. No saben nada del dominio: `Button` es un botón, no un "botón de comprar".

### Molecules (`components/shared/`) — 56 componentes

Composiciones de atoms con propósito concreto, **sin lógica de negocio pesada** (sin `fetch` múltiples, sin orquestación de modales).

Ejemplos: `StatCard`, `StatusBadge`, `NavCard`, `LibraryItemCard`, `LoanCard`, `BookingCard`, `ProductCard`, `RewardCard`, `SectionTitle`, `CreditsBanner`, `ProductImage`, `ColorSwatchRow`, `BatchHeader`, `GroupedOrderItem`, `ModuleGuard`, `ModulePausedScreen`, `ModuleStatusCard`, `DangerConfirmModal`.

Todos re-exportados desde un barrel [`components/shared/index.ts`](packages/nextjs/src/components/shared/index.ts) (cobertura 100%), agrupados por dominio.

### Forms (`components/forms/`) — 14 componentes

Formularios moleculares con contrato `onSubmit(data)`: `LoginForm`, `ItemForm`, `ProductForm`, `ProductGroupForm`, `VariantForm`, `RewardForm`, `SubjectForm`, `SubjectOfferingForm`, `AssignmentForm`, `PrintJobForm`, `PrinterForm`, `RoomForm`, `UserForm`, etc.

Todos usan el hook `useForm()` para manejo de estado, validación síncrona y submit asíncrono con `submitError` unificado.

### Organisms (`components/dashboard/`) — 12 componentes

Piezas grandes por dominio que **orquestan hooks + Server Actions + modales**:

- **Shop**: `ShopCartDrawer`, `CartItemList`, `CartSummary`, `ProductDetailPanel`, `ProductAdminHeader`, `VariantDetailCard`, `VariantGrid`, `OrderBatchTable`, `OrderItemTable`, `OrderBatchDetailView`
- **Academic**: `SubjectExpandableRow`, `StudentRewardsInventoryTable`
- **Genérico**: `DataTable`

Son componentes "smart": tienen estado propio, saben con qué datos trabajan y delegan mutaciones al padre vía callbacks. Idealmente cada dominio tiene sus organisms propios.

### Layout (`components/layout/`) — 5 componentes

Elementos de estructura global: `Header`, `Sidebar`, `ProfessorSubjectsNav`, `StudentOnboardingModal`, etc.

### Pages (`app/(main)/`)

Componen organisms + molecules + forms con datos reales obtenidos de la API. Idealmente finas (<150 L) — las páginas complejas delegan en organisms. Algunas pages ejemplares tras el refactor pasan de 350-450 L a 80-150 L.

### Barrel exports

Cada directorio de componentes tiene un `index.ts` que re-exporta todo, permitiendo imports agregados: `import { Button, Card } from "@/components/ui"`.

---

## 11. Patrón de Server Actions

Next.js Server Actions son funciones marcadas con `"use server"` que se ejecutan en el servidor. CryptoCampus las usa como **capa de coordinación** entre blockchain y base de datos:

```
Frontend (React) → API Route (thin wrapper) → Server Action → { Blockchain, Prisma, Recompensas }
```

### Patrón canónico

```typescript
"use server";

export async function requestLoan(itemId: string) {
  // 1. Autenticación + autorización
  const session = await getSession();
  ensureRole(session, ["STUDENT"]);

  // 2. Validación de inputs
  const item = await prisma.libraryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Ítem no encontrado");

  // 3. Descifrado de clave del usuario y firma on-chain
  const wallet = await getUserWalletClient(session.userId!);
  const txHash = await wallet.writeContract({
    address: CONTRACT_ADDRESSES.libraryManager,
    abi: LIBRARY_MANAGER_ABI,
    functionName: "requestLoan",
    args: [BigInt(item.tokenId)],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  // 4. Persistencia de metadata en Prisma
  const loan = await prisma.loan.create({
    data: { userId: session.userId!, libraryItemId: item.id, status: "RESERVED", requestTxHash: txHash },
  });

  // 5. Recompensa (si aplica)
  const rewards = await issueReward({ userId: session.userId!, mainReason: ... });

  return { loan, rewards };
}
```

### Módulos de actions (8)

`academic.ts`, `badges.ts`, `library.ts`, `onboarding.ts`, `printing.ts`, `rooms.ts`, `shop.ts`, `system.ts` (admin, pausa modular — ver §16). La autenticación (login, sesión, control de acceso) vive en [`lib/auth.ts`](packages/nextjs/src/lib/auth.ts) en lugar de en `actions/` porque la usan tanto Server Actions como API routes y middleware.

### API Routes como thin wrappers

Las rutas API (`app/api/...`) son wrappers mínimos que:
1. Extraen parámetros del request
2. Llaman al Server Action correspondiente
3. Transforman errores en códigos HTTP apropiados (401, 403, 404, 409, 500)

Los helpers `getSession()`, `ensureRole()` y `logPrismaRecovery()` están centralizados en `lib/` para evitar duplicación entre acciones.

---

## 12. Hooks custom

| Hook | Propósito |
|---|---|
| `useAuthUser` | Carga la sesión actual del servidor (`/api/auth/me`). Usado en layouts y guards. |
| `useForm<T>` | Gestión de estado de formulario con validación síncrona y submit asíncrono. Expone `fields`, `errors`, `submitError`, `loading`, `setField`, `handleSubmit`. Usado por los 13 formularios. |
| `usePaginatedList<T>` | Hook genérico para listados paginados (offset/limit/filters/refresh). Encapsula `useState + useEffect + fetch + URLSearchParams` evitando ~40 líneas de boilerplate por página. Acepta `parseResponse` como escape hatch para endpoints con shape no estándar. Usado en ~17 pages. |
| `useToast` | Acceso al contexto de toasts. `addToast(message, variant)`. Usado en ~103 archivos. |
| `useTheme` | Acceso al contexto de tema (light/dark), persistido en localStorage. |

---

## 13. Autenticación y seguridad

### Sesiones

- **iron-session**: Cookies cifradas y firmadas. No requiere base de datos de sesiones.
- Flags: `httpOnly` (previene XSS), `sameSite: "lax"` (previene CSRF), `secure` en producción.
- Datos en sesión: `userId`, `address` (wallet), `role`.

### Protección de rutas

- **Middleware** (`proxy.ts`): Intercepta requests a `/{role}/*`. Redirige a `/login?returnUrl=...` si no autenticado. Si un usuario autenticado intenta acceder a `/login` → redirige a su `/{role}`. Si intenta acceder a la ruta de otro rol → redirige a la suya.
- **Server Actions**: Cada acción verifica rol con `ensureRole()`. Distingue entre "No autenticado" (→ HTTP 401) y "No autorizado" (→ HTTP 403).
- **Contratos**: Modifiers `onlyStudent()`, `onlyLibrarian()`, `onlyAdmin()` verifican roles on-chain via los helpers de `CampusRoles` (`isStudent`/`isLibrarian`/`isAdmin`/`isProfessor`), uniformes en los 7 contratos consumidores.

### Rate limiting

Endpoint `/api/auth/login` protegido con rate limiter en memoria:
- 10 intentos/minuto por IP
- Respuesta: HTTP 429 con header `Retry-After`

### Cifrado

- **Contraseñas**: bcrypt con salt (12 rondas)
- **Claves privadas**: AES-256-GCM con IV aleatorio único por usuario
- **Sesiones**: Cifrado simétrico via iron-session (mismo `SESSION_SECRET`)

---

## 14. Flujos end-to-end

### 14.1 Registro de un nuevo alumno

```
Admin → /admin/users/new
   │
   ├── Formulario UserForm
   │     email, name, role=STUDENT
   │     password (generada o manual)
   │
   └── actions/auth.ts::createUser()
         │
         ├── 1. Genera wallet: privateKey = generatePrivateKey()
         ├── 2. Cifra clave: encryptedKey = encrypt(privateKey, SESSION_SECRET)
         ├── 3. Hash pwd: bcrypt.hash(password, 12)
         ├── 4. prisma.user.create({...})
         ├── 5. On-chain: CampusRoles.grantRole(STUDENT_ROLE, address) — admin firma
         ├── 6. On-chain: LibraryToken.mint(address, 10) — depósitos iniciales
         └── Retorna { user, passwordIfGenerated }
```

### 14.2 Préstamo de biblioteca

```
Alumno → /student/library → Click "Pedir prestado"
   │
   └── actions/library.ts::requestLoan(itemId)
         │
         ├── Verifica rol STUDENT + saldo de LibraryToken suficiente
         ├── Desencripta clave del alumno
         ├── walletClient.writeContract(LibraryManager.requestLoan(tokenId))
         │     ├── Si hay copias: marca RESERVED
         │     └── Si no: cola FIFO (status QUEUED, queuePosition)
         ├── prisma.loan.create({ userId, libraryItemId, status, requestTxHash })
         └── issueReward({ mainReason: MODULE_FIRST_USE_LIBRARY }) si primera vez
   │
   Estado resultante: RESERVED (3 días para recoger) o QUEUED
   │
   │── Alumno recoge físicamente
   │     └── Librarian marca como PICKED_UP (fecha dueDate = today + 14 días)
   │
   └── Alumno devuelve
         └── actions/library.ts::returnLoan(loanId)
               ├── LibraryManager.returnLoan() on-chain
               ├── Loan.status → RETURNED
               └── issueReward({
                     mainReason: fechaActual ≤ dueDate
                       ? LOAN_RETURNED_ON_TIME (+2 SHPT)
                       : LOAN_RETURNED_ON_TIME (+2) + LOAN_RETURNED_EARLY (+3)
                   })
```

### 14.3 Compra en tienda (checkout con carrito)

```
Alumno navega /student/shop
   │
   ├── Añade productos: POST /api/shop/cart con productId + quantity
   │     CartItem creado/actualizado en Prisma
   │
   └── Click "Finalizar compra" → /student/shop/cart
         │
         └── actions/shop.ts::checkout()
               │
               ├── Verifica saldo SHPT >= sum(subtotal)
               ├── CampusShop.purchaseBatch(productIds[], quantities[]) on-chain
               │     (genera batchId único, marca stock)
               ├── prisma.orderBatch.create({...}) + orders anidadas
               ├── prisma.cartItem.deleteMany() — vacía carrito
               ├── issueReward({ mainReason: MODULE_FIRST_USE_SHOP }) si primera
               └── Retorna { batchId, newBalance, rewards }
```

### 14.4 Ciclo de una insignia académica

```
Profesor crea estructura
   │
   ├── /professor/subjects/[offeringId]/assignments/new
   │     Assignment + array de PrizeCategory
   │     BadgeSystem.createTaskWithCategories() on-chain
   │
   ├── Alumno entrega (TaskSubmission en Prisma — opcional flow de entrega)
   │
   ├── Profesor aprueba entregas y concede badges
   │     actions/badges.ts::awardBadge(studentId, prizeCategoryId)
   │       ├── BadgeSystem.mintBadge(subjectBadgeId, student) on-chain
   │       ├── prisma.badgeAward.create()
   │       └── issueReward({ mainReason: BADGE_AWARDED, mainAmount: 5 })
   │
   └── Alumno canjea por recompensa
         /student/badges/rewards → click canjear
            actions/badges.ts::redeemReward(rewardId)
               ├── BadgeSystem.burn(subjectBadgeId, student, badgeCost)
               ├── BadgeSystem.mintReward(rewardId, student) ← token del reward
               └── prisma.rewardRedemption.create()
      │
      └── Pedir uso real
            actions/badges.ts::requestUseReward(redemptionId)
               → UseRequest status=PENDING
            Profesor aprueba/rechaza → status APPROVED/REJECTED
```

---

## 15. Patrones UX transversales

### Loading states — siempre Skeleton, nunca Spinner en pages

Regla estricta del proyecto:

- **En pages**: usar `SkeletonPage`, `SkeletonTable`, `SkeletonCard` o `Skeleton` (atoms de `components/ui/Skeleton`).
- **Spinner** está reservado para el estado loading dentro de `Button` (`<Button loading>...</Button>`).

No hay `loading.tsx` por ruta individual — solo a nivel layout. Todas las pages son `"use client"` con `useEffect` y el skeleton vive dentro de ellas.

### Toasts y recompensas

Cada acción premiable devuelve un array `RewardGrant[]`. Helper `toastRewards(addToast, rewards)` dispara un toast por cada recompensa con su cantidad y razón.

### Modales de confirmación

Acciones destructivas (borrar, devolver, aprobar pagos) siempre pasan por `ConfirmModal` (molecule en `shared/`) para evitar clicks accidentales.

### Paginación

17 pages listas con datos paginados usan `usePaginatedList<T>` + el atom `Pagination`. El hook gestiona offset, filters y auto-reset al cambiar filtros.

### Onboarding del alumno

La primera vez que un STUDENT entra en la plataforma, un `StudentOnboardingModal` explica los módulos y otorga los bonus de primer uso si se cumplen las condiciones.

### Validación compartida

[`lib/validators.ts`](packages/nextjs/src/lib/validators.ts) centraliza dos reglas reutilizadas en `LoginForm`, `UserForm` y servidor:

- `validateEmail`: obligatorio, contiene `@`, termina en `@ucm.es`, hay usuario antes del `@`.
- `validatePassword`: ≥ 8 caracteres, al menos 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial.

Esto garantiza que cliente y servidor aplican exactamente las mismas reglas y los mensajes de error son consistentes.

### Tema claro/oscuro

[`lib/themes.ts`](packages/nextjs/src/lib/themes.ts) define dos paletas (`light`, `dark`) como mapas de CSS custom properties (`--primary`, `--bg`, `--text`, `--border`, etc.). `applyTheme(themeId)` sobrescribe esas variables en `document.documentElement` en runtime, sin recargar la página. La preferencia se persiste en `localStorage` vía `ThemeContext` y se expone con `useTheme()`. Hay un atom `ThemeSwitcher` en `components/shared/` para alternar.

### Colores de gráficos

Los color maps usados por las gráficas Recharts (PieChart, BarChart) están centralizados en [`lib/dashboard-colors.ts`](packages/nextjs/src/lib/dashboard-colors.ts) (`LIBRARY_TYPE_COLORS`, `USER_ROLE_COLORS`, `ASSIGNMENT_STATUS_COLORS`). Cualquier nueva gráfica debe consumir desde aquí en lugar de hardcodear colores.

---

## 16. Pausa modular del sistema (kill-switch)

Una de las garantías clave de un sistema con dinero on-chain es poder **detener operaciones en caliente** ante un incidente (vulnerabilidad descubierta, fork de red, dato corrupto, etc.). CryptoCampus implementa un kill-switch granular sobre los 8 contratos, expuesto al admin como **6 módulos lógicos** y reforzado con dos capas de defensa (server-rendering + traducción de errores).

### 16.1 Por qué 6 módulos sobre 8 contratos

El admin razona en términos de funcionalidades del campus, no de contratos. Algunas funcionalidades dependen de varios contratos coordinados, así que pausar contratos sueltos dejaría estados incoherentes:

| Módulo lógico (`ModuleId`) | Contratos | Justificación |
|---|---|---|
| `roles` | `CampusRoles` | Aislado: solo gobierna registro de usuarios |
| `library` | `LibraryManager` + `LibraryToken` | Sin LIB no se pueden hacer préstamos; pausar uno y dejar el otro provoca errores confusos |
| `shop` | `CampusShop` + `ShopToken` | Misma razón: sin SHPT no hay tienda funcional, y además se mintean recompensas en SHPT |
| `badges` | `BadgeSystem` | Aislado: tareas, awards y rewards conviven en el mismo contrato |
| `rooms` | `RoomBooking` | Aislado |
| `print` | `Printer` | Aislado |

`deriveModuleStatus()` produce tres valores: `active` (todos OK), `paused` (todos los contratos del módulo pausados) y `partial` (al menos uno pausado pero no todos — solo posible si el módulo tiene > 1 contrato y hubo un fallo a mitad). La UI pinta `partial` en color naranja como aviso.

### 16.2 Defensa en profundidad

#### Capa A — `ModuleGuard` (server-side)

[`components/shared/ModuleGuard.tsx`](packages/nextjs/src/components/shared/ModuleGuard.tsx) es un **Server Component** que envuelve los `layout.tsx` de cada sección protegida:

```tsx
// app/(main)/student/library/(library-routes)/layout.tsx
import { ModuleGuard } from "@/components/shared/ModuleGuard";

export default function StudentLibraryRoutesLayout({ children }: { children: ReactNode }) {
  return <ModuleGuard moduleId="library">{children}</ModuleGuard>;
}
```

El guard:
1. Si el usuario es `ADMIN`, deja pasar (necesita acceso para despausar).
2. Si no, llama a `getCachedModuleStatus(moduleId)` ([`lib/system-modules-status.ts`](packages/nextjs/src/lib/system-modules-status.ts)) que lee `paused()` de los contratos del módulo en paralelo, cacheado con `unstable_cache` y `revalidate: 5s` bajo el tag `module-status`.
3. Si el estado no es `active`, renderiza `<ModulePausedScreen>` con un Card explicativo y botón "Volver al panel".

Como es server-side, el HTML de la pantalla de bloqueo viene **pre-renderizado**: no hay flash, funciona aunque el usuario tipee la URL directamente.

#### Capa B — `translateContractError` (defensa en error)

[`lib/contractErrors.ts`](packages/nextjs/src/lib/contractErrors.ts) detecta el revert de un contrato pausado por dos marcadores: el string `"EnforcedPause"` y el selector `0xd93c0665`. Si lo encuentra, sustituye el stack-trace críptico por:

> "Esta funcionalidad (Biblioteca) está pausada por el administrador. Inténtalo más tarde."

Las Server Actions críticas (`library.ts`, `printing.ts`, `rooms.ts`, `shop.ts`, `badges.ts`) lo aplican en su `catch`:

```typescript
} catch (error) {
  if (isContractPauseError(error)) throw translateContractError(error, "Biblioteca");
  throw new Error(`Error al solicitar préstamo: ${...}`);
}
```

Esto **cubre el agujero de la capa A**: como `getCachedModuleStatus` cachea 5 s, entre que el admin pausa y todos los layouts revalidan puede haber peticiones que crucen el guard pero choquen contra el contrato. La capa B asegura un mensaje legible incluso en esa ventana.

### 16.3 Distribución de los layouts con guard

28 `layout.tsx` con `ModuleGuard` distribuidos por módulo:

| Ruta | `moduleId` |
|---|---|
| `librarian/items/`, `librarian/loans/`, `student/library/(library-routes)/`, `admin/library/` | `library` |
| `librarian/printing/`, `professor/printing/`, `student/library/printing/`, `admin/printing/` | `print` |
| `librarian/rooms/`, `student/library/rooms/`, `admin/rooms/` | `rooms` |
| `professor/badges/`, `professor/rewards/`, `professor/use-requests/`, `professor/pending-reviews/`, `professor/students/`, `professor/subjects/`, `student/badges/`, `admin/badges/` | `badges` |
| `student/shop/`, `admin/shop/` | `shop` |
| `admin/users/` | `roles` |

**Detalle del route group `(library-routes)`**: El guard NO va en el layout raíz de `student/library/` porque las subrutas `printing/` y `rooms/` pertenecen a otros módulos y deben sobrevivir si el módulo `library` se pausa. Para acotar el guard solo a las páginas propias de biblioteca (catálogo, detalle, mis préstamos) se usa el route group `(library-routes)/`. Los paréntesis hacen que la URL final no incluya `(library-routes)`, así que las URLs públicas no cambian — pero el subárbol queda envuelto por su propio layout con guard.

### 16.4 Server Actions admin (`actions/system.ts`)

Patrón consistente con el resto del repo (`adminWalletClient.writeContract` → `waitForTransactionReceipt` → check `status === "success"`), más **idempotencia** (lectura previa del estado actual + skip si ya está en el estado destino).

| Función | Descripción |
|---|---|
| `getModulesStatus()` | Lee `paused()` de los 8 contratos en paralelo. Detecta primero si el nodo responde (`getBlockNumber()`); si no, devuelve `{ nodeOnline: false }` para que la UI muestre banner |
| `pauseModule(id)` / `unpauseModule(id)` | Itera secuencialmente los contratos del módulo. Devuelve `ContractActionResult[]` con `outcome: "skipped"|"executed"|"failed"` por contrato |
| `pauseAllModules()` / `unpauseAllModules()` | Itera todos los módulos secuencialmente. No revierte parciales: si un contrato falla, sigue con los siguientes y devuelve detalle completo |

La idempotencia hace que reintentar tras una pausa parcial sea seguro. La iteración secuencial (en lugar de paralelizar) es deliberada: más predecible y permite que un fallo intermedio se observe sin saturar el RPC.

### 16.5 Endpoints API y panel admin

```
GET  /api/admin/system/status                     → getModulesStatus
POST /api/admin/system/modules/[moduleId]/pause   → pauseModule
POST /api/admin/system/modules/[moduleId]/unpause → unpauseModule
POST /api/admin/system/all/pause                  → pauseAllModules
POST /api/admin/system/all/unpause                → unpauseAllModules
```

El panel [`/admin/system`](packages/nextjs/src/app/(main)/admin/system/page.tsx):
- Sin polling automático: carga al montar + botón "Actualizar" + re-fetch tras cada mutación.
- Banner rojo "Nodo blockchain no responde" si `getBlockNumber()` falla.
- Grid de tarjetas `<ModuleStatusCard>` (una por módulo lógico) con indicador `active/paused/partial` y botones pausar/despausar.
- Card de "Pausa de emergencia" con botones globales `Pausar todo` / `Despausar todo`.
- "Pausar todo" exige `<DangerConfirmModal>` con frase de confirmación literal (`PAUSAR TODO`) — inspirado en los flujos GitHub de borrar repo: imposible pausar todo el sistema por accidente.
- Toasts diferenciados: `success` si todos los contratos respondieron, `info` si todos eran skipped (sin cambios), `danger` si alguno falló.

### 16.6 Trade-offs del diseño

- **Ventaja**: kill-switch granular sin redeploys ni migraciones. El admin puede aislar un módulo afectado sin tirar el resto del sistema.
- **Coste**: cada Server Action que escribe on-chain debe acordarse de aplicar `translateContractError`. Si se olvida, el usuario verá un stack-trace ilegible.
- **Cache 5 s**: equilibrio entre consistencia (queremos que la pausa se note rápido) y carga del RPC (lecturas en cada navegación serían demasiado). 5 s en el peor caso es aceptable para un campus.
- **No persistencia de motivos**: la pausa no guarda quién/cuándo/por qué (solo el `txHash` queda en el log de la blockchain). Para una versión productiva se añadiría un modelo `PauseEvent` en Prisma con `userId`, `reason`, `timestamp`.

---

## 17. Sistema de testing en 4 capas

El proyecto cubre cuatro capas de testing automatizado más la verificación de tipos.

### 17.1 Tests de contratos en TypeScript (`node:test`)

Framework nativo de Node.js usando `viem` para llamadas. Patrón:
```ts
describe("LibraryManager", function () {
  async function deploySystem() { /* despliega contratos frescos */ }
  it("Should execute loan flow", async function () {
    const { libraryManager } = await deploySystem();
    // ... assertions con assert.equal()
  });
});
```

267 tests sobre los 8 contratos. Ejecutados por `pnpm test`.

### 17.2 Tests de contratos en Solidity (Foundry/forge-std)

Tests escritos directamente en Solidity con `vm.prank`, `vm.expectRevert`, etc.:
```solidity
contract LibraryManagerTest is CampusTestBase {
  function setUp() public { /* deploy + setup */ }
  function test_RequestLoan() public {
    vm.prank(student1);
    libraryManager.requestLoan(1);
    assertEq(...);
  }
}
```

140 tests Solidity organizados en:

- **Tests unitarios por contrato**: `CampusRoles.t.sol`, `LibraryToken.t.sol`, `ShopToken.t.sol`, `Printer.t.sol`, `LibraryManager.t.sol`, `CampusShop.t.sol`, `RoomBooking.t.sol`, `BadgeSystem.t.sol`.
- **Tests de integración por dominio**: `Integration.Library.t.sol`, `Integration.Shop.t.sol`, `Integration.Badges.t.sol`, `Integration.Cross.t.sol`. Cada uno despliega solo los contratos que necesita, lo que reduce el bytecode de cada archivo y mantiene la separación de responsabilidades.
- **Base compartida**: [`test/helpers/CampusTestBase.sol`](packages/hardhat/test/helpers/CampusTestBase.sol) abstrae actores nombrados (`librarian`, `professor`, `student1`, `student2`) y helpers de registro (`_initAndRegisterStandardUsers`), evitando duplicación entre archivos.

Total combinado: **407 tests** (140 Solidity + 267 NodeJS) ejecutados por `pnpm test`.

### 17.3 Tests unitarios del Next.js (Vitest + Testing Library)

100 tests sobre utilidades, hooks y atoms:

| Capa | Archivos |
|---|---|
| Utilidades (`lib/`) | `formatters.test.ts`, `validators.test.ts`, `historical.test.ts`, `system-modules.test.ts`, `contractErrors.test.ts`, `shop-utils.test.ts`, `utils.test.ts` |
| Tipos | `types/index.test.ts` |
| Hooks | `useForm.test.ts` |
| Atoms | `Button.test.tsx`, `EmptyState.test.tsx`, `SearchInput.test.tsx` |

```bash
pnpm --filter nextjs run test          # ejecución única
pnpm --filter nextjs run test:watch    # watch mode
pnpm --filter nextjs run test:coverage # cobertura V8
```

### 17.4 Tests E2E (Playwright)

Suite de extremo a extremo en [`packages/nextjs/e2e/`](packages/nextjs/e2e/):

- `auth-flows.spec.ts`: login, registro, sesión, redirecciones por rol.
- `home.spec.ts`: render del home y navegación.

```bash
pnpm --filter nextjs run test:e2e          # suite rápida
pnpm --filter nextjs run test:e2e:full     # suite completa (RUN_E2E_FULL=1)
```

### 17.5 Verificación estática

- `tsc --noEmit` para type check.
- `next build` para detectar errores SSR/SSG.
- ESLint para estilo + reglas React.

### 17.6 Integración continua

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) ejecuta en cada push y pull request a `main`:

1. Setup pnpm 10.33.0 + Node 24.15.0.
2. `pnpm install --frozen-lockfile`.
3. `prisma generate`.
4. ESLint (`pnpm --filter nextjs run lint`).
5. Compile contratos (`pnpm compile`).
6. Tests de contratos (`pnpm test`) — los 407 tests Hardhat + Foundry.
7. Tests Next.js (`pnpm --filter nextjs run test`) — los 100 unitarios Vitest.
8. `next build` con variables dummy para satisfacer las lecturas a nivel de módulo (`DATABASE_URL`, `SESSION_SECRET`).

Timeout total: 20 minutos. La build de producción se valida en cada commit que llega a `main`.

---

## 18. Flujo de desarrollo

Un solo comando arranca todo el entorno:

```bash
pnpm dev
```

Orquestado por `scripts/dev.mjs`:

1. **Docker**: `docker compose up -d db` — levanta PostgreSQL en `localhost:5435`.
2. **Prisma**: genera el cliente si hace falta.
3. **Fresh mode** (`--fresh`): borra `.anvil-state.json`, `ignition/deployments/` y resetea la BD.
4. **Schema**: `prisma db push` sincroniza el esquema.
5. **Motor blockchain**: arranca Anvil (por defecto) o Hardhat (con `--hardhat`) en `127.0.0.1:8545`.
6. **Detección de deploy**: `eth_getCode` a `CampusRoles`. Si el bytecode existe, salta el deploy.
7. **Deploy** (si hace falta): Hardhat Ignition despliega todos los contratos + `setTrustedSpender()`.
8. **Resync**: alinea usuarios existentes on-chain (para reiniciar con Anvil persistente).
9. **Seeds idempotentes**: admin → académico → productos → insignias → biblioteca → salas → impresoras → cleanup.
10. **Next.js**: arranca el servidor en `http://localhost:3000`.

En arranques sucesivos con Anvil persistente los pasos 7 y 9 son casi instantáneos (todo detectado como ya existente).

### Seeds y mantenimiento (12 scripts `.mjs`)

En `packages/nextjs/scripts/`:

- `seed-admin`: crea admin @ `admin@ucm.es`.
- `seed-librarian`: crea bibliotecario.
- `seed-academic`: asignaturas, ofertas, profesores y alumnos de demo.
- `seed-products` + `seed-library` + `seed-rooms` + `seed-printers`: datos de catálogo.
- `seed-badges`: badges demo.
- `seed-historical`: datos solo-Prisma de 3 a 12 meses atrás (`Loan`, `RoomBooking`, `PrintLog`, `OrderBatch` con `historical: true`) para que dashboards y gráficas se vean ricos en demos sin gastar miles de transacciones on-chain.
- `resync-users`: reconstruye grants de rol on-chain para usuarios existentes (útil al reiniciar Anvil).
- `cleanup-uploads`: purga archivos subidos huérfanos (`public/uploads/print/`).
- `db-doctor`: diagnostica drift Prisma↔blockchain. Recorre las entidades con representación on-chain (`Loan`, `Order`, `RoomBooking`, …) y comprueba que los `tokenId/loanId/orderId` siguen vivos en el contrato. Lista filas huérfanas. Útil cuando aparece "Estado inconsistente: Prisma tiene N, blockchain M" durante los seeds.

Todos los seeds son **idempotentes**: detectan filas existentes por clave de unión y saltan, así que se pueden re-ejecutar tantas veces como se quiera sin duplicar datos. `seed-historical` no toca blockchain en absoluto y no crea `ShopTokenReward`, así que respeta el bonus de "primer uso" del usuario real.

---

## 19. Decisiones arquitectónicas relevantes

### Monorepo con pnpm workspaces

Alternativas consideradas: repos separados, npm workspaces, Turborepo. Se eligió pnpm + monorepo por:
- Workspaces nativos + cross-packages imports.
- Hoisting eficiente (no duplica dependencias).
- Velocidad en CI.
- Sin overhead adicional como Turborepo.

### Wallets custodiales

Alternativas: MetaMask (cada usuario su wallet), signer vía API externa. Se eligió custodial por la naturaleza cerrada del campus (usuarios conocidos, control total) y la importancia de la UX convencional.

### Doble ledger (blockchain + Prisma)

Alternativas: solo blockchain (eventos como fuente), solo Prisma con auditoría propia. Se eligió doble ledger porque:
- Blockchain aporta inmutabilidad y transparencia (valor TFG).
- SQL permite queries complejas, búsqueda, paginación eficientes.
- Los `tokenId` + `txHash` garantizan trazabilidad.

### Refactor de modularización

El proyecto pasó por un refactor grande donde:

- Se extrajeron **10 organisms** a `components/dashboard/` (antes mezclados en `shared/` o como smart pages con 400+ líneas).
- Se creó el hook `usePaginatedList` que **elimina la duplicación de boilerplate** de paginación en 17 pages.
- Se consolidó el formulario de nueva tarea (profesor + admin) en `forms/AssignmentForm`.
- Se completó el barrel de `components/shared/index.ts` a 49/49 archivos cubiertos.
- Se limpió código muerto: 9 componentes, 6 API routes, 4 Server Actions y 1 tipo TypeScript huérfanos.

### Features incorporadas post-refactor

- **Matrículas funcionales** en `/admin/subjects/[offeringId]/students`: modal multi-select para añadir alumnos + botón de desmatricular por fila (`POST /api/academic/enrollments`, `DELETE /api/academic/enrollments/[id]`).
- **Inventario de recompensas por alumno**: nueva acción `getOfferingRewardsInventory`, endpoint `/api/badges/offerings/[offeringId]/rewards-inventory` y dos vistas — `/professor/students/rewards` (profesor, filtro por asignatura propia) y `/admin/rewards/inventory` (admin, filtros obligatorios asignatura + profesor).
- **Pausa modular del sistema** (último hito): kill-switch admin sobre los 8 contratos, agrupados en 6 módulos lógicos. Ver §16 para el detalle. Nuevos archivos clave: `actions/system.ts`, `lib/system-modules.ts`, `lib/system-modules-status.ts`, `lib/contractErrors.ts`, `components/shared/ModuleGuard.tsx`, `components/shared/ModulePausedScreen.tsx`, `components/shared/ModuleStatusCard.tsx`, `components/shared/DangerConfirmModal.tsx`, panel `/admin/system/`, 17 layouts con `ModuleGuard`.
- **Vistas de impresión reutilizables por rol** en [`components/printing/`](packages/nextjs/src/components/printing/): `PrintingHomeView`, `PrintingHistoryView`, `PrintingDetailView` parametrizadas por `basePath` y `parentLink` opcional. Compartidas entre `/student/library/printing/`, `/professor/printing/` y `/librarian/printing/`. Eliminan tres copias casi idénticas de la simulación de impresión.
- **Datos históricos solo-Prisma**: las entidades `Loan`, `OrderBatch`, `Order`, `PrintLog`, `RoomBooking` incluyen un flag `historical: Boolean`. El script [`scripts/seed-historical.mjs`](packages/nextjs/scripts/seed-historical.mjs) genera 3-12 meses de actividad (`historical: true`, sin tocar blockchain) para que dashboards y gráficas se vean ricos en demos. La lógica de "primer uso de módulo" lo respeta porque no se crean `ShopTokenReward`. Helpers de consulta en [`lib/historical.ts`](packages/nextjs/src/lib/historical.ts) discriminan entre series reales y demo cuando hace falta.

---

## 20. Glosario

| Término | Definición |
|---|---|
| **dApp** | Decentralized Application. App cuya lógica crítica corre en smart contracts. CryptoCampus es custodial: el servidor firma por el usuario. |
| **Custodial** | Modelo donde un tercero (aquí el backend) gestiona las claves privadas del usuario. |
| **Offering** | Instancia concreta de una asignatura — profesor titular + grupo + curso académico. |
| **Badge** | Insignia académica on-chain, asociada a un offering. Soulbound (no transferible). |
| **Prize Category** | Categoría de premio dentro de una tarea (p. ej. "Mejor diseño"). Define cuántos badges otorga y cuántos ganadores puede tener. |
| **Award** | Registro de que un profesor concedió una badge a un alumno por un premio. |
| **Reward** | Recompensa que los alumnos canjean quemando badges de un offering. |
| **Redemption** | Registro de que un alumno canjeó una recompensa (un token de reward mintea). |
| **Use Request** | Solicitud del alumno para usar una recompensa ya canjeada. Pasa por aprobación del profesor. |
| **Batch** | Grupo de compras realizadas en un mismo checkout de la tienda. Se registra en blockchain como una sola transacción. |
| **Soulbound** | Token no transferible. Anclado a la wallet que lo recibe. `BadgeSystem` lo implementa sobrescribiendo `_update()`. |
| **CEI** | Patrón de programación segura en Solidity: Checks, Effects, Interactions. Previene reentrancia. |
| **Barrel** | Archivo `index.ts` que re-exporta todo de una carpeta para imports agregados. |
| **Atomic Design** | Metodología de Brad Frost que organiza componentes en: atoms → molecules → organisms → templates → pages. |
| **Server Action** | Función Next.js marcada con `"use server"`. Se ejecuta en el servidor y puede llamarse directamente desde componentes cliente. |
| **Ignition** | Sistema declarativo de despliegue de Hardhat. Gestiona dependencias y orden de despliegue. |
| **trustedSpender** | Patrón de `LibraryToken`/`ShopToken` que permite a un contrato específico (ej. `LibraryManager`) gastar tokens de un usuario sin `approve` previo. |
| **Pausable** | Mixin de OpenZeppelin que añade `pause()`/`unpause()` y el modifier `whenNotPaused`. Al pausar, las funciones protegidas revierten con el custom error `EnforcedPause()`. |
| **EnforcedPause** | Custom error emitido por OpenZeppelin Pausable cuando una función `whenNotPaused` se invoca con el contrato pausado. Selector `0xd93c0665`. |
| **Module (CryptoCampus)** | Agrupación lógica de 1-2 contratos relacionados (`library` = `LibraryManager + LibraryToken`, `shop` = `CampusShop + ShopToken`, etc.). Unidad sobre la que opera la pausa de admin. |
| **ModuleGuard** | Server Component que envuelve los `layout.tsx` de cada sección. Lee el estado del módulo y renderiza `ModulePausedScreen` si no está activo (admin tiene bypass). |
| **DangerConfirmModal** | Modal reforzado que exige escribir una frase exacta (p. ej. `PAUSAR TODO`) para confirmar. Usado en acciones destructivas globales. |
| **Route group** | Carpeta entre paréntesis (`(library-routes)`, `(auth)`, `(main)`) que agrupa rutas con un layout compartido sin afectar a la URL pública. Útil para acotar guards/contextos a un subconjunto de rutas. |

---

## 21. Métricas del proyecto

| Métrica | Valor |
|---------|-------|
| Contratos Solidity en producción | 8 |
| Tests de contratos | 407 (140 Solidity + 267 NodeJS) |
| Tests unitarios Next.js (Vitest) | 100 |
| Tests E2E Next.js (Playwright) | 2 specs (`auth-flows`, `home`) |
| Atoms (`components/ui/`) | 40 |
| Moléculas (`components/shared/`) | 56 |
| Formularios (`components/forms/`) | 14 |
| Organisms (`components/dashboard/`) | 12 |
| Vistas de impresión reutilizables (`components/printing/`) | 3 |
| Componentes de layout | 5 |
| Páginas (`page.tsx`) | 128 |
| API endpoints (`route.ts`) | 117 |
| Módulos de Server Actions | 8 |
| Hooks custom | 5 |
| Modelos de base de datos (Prisma) | 26 |
| Contextos React | 4 (Cart, Onboarding, Theme, Toast) |
| Scripts de mantenimiento (`.mjs`) | 12 (seeds + históricos + cleanup + resync + db-doctor) |
| Layouts con `ModuleGuard` | 28 |
| Módulos lógicos pausables | 6 (cubren los 8 contratos) |
| Workflows de CI | 1 (`.github/workflows/ci.yml`) |

---

## Documentos relacionados

- [README.md](./README.md) — onboarding, instalación, comandos, troubleshooting.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — referencia arquitectónica exhaustiva.
- [packages/nextjs/RUTAS.md](./packages/nextjs/RUTAS.md) — tabla exhaustiva de rutas de páginas por rol.
- [packages/nextjs/API_ACCESS_AUDIT.md](./packages/nextjs/API_ACCESS_AUDIT.md) — auditoría de control de acceso en endpoints.
