# CryptoCampus — Arquitectura del proyecto

Documento de referencia técnica. Explica cada decisión arquitectónica, qué hace cada carpeta, cómo fluyen los datos y las convenciones del proyecto. Complementa:

- [README.md](./README.md) — onboarding y comandos
- [TFG-DOCUMENTACION-TECNICA.md](./TFG-DOCUMENTACION-TECNICA.md) — enfoque de memoria académica con flujos end-to-end y glosario

---

## Índice

1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Estructura del monorepo](#3-estructura-del-monorepo)
4. [Smart Contracts (`packages/hardhat`)](#4-smart-contracts-packageshardhat)
5. [Base de datos — Prisma schema](#5-base-de-datos--prisma-schema)
6. [Aplicación Next.js (`packages/nextjs`)](#6-aplicación-nextjs-packagesnextjs)
7. [Flujo de datos: blockchain vs Prisma](#7-flujo-de-datos-blockchain-vs-prisma)
8. [Autenticación y sesiones](#8-autenticación-y-sesiones)
9. [Roles y permisos](#9-roles-y-permisos)
10. [Sistema de recompensas automáticas](#10-sistema-de-recompensas-automáticas)
11. [Motor blockchain: Anvil vs Hardhat](#11-motor-blockchain-anvil-vs-hardhat)
12. [Convenciones de código](#12-convenciones-de-código)
13. [Cómo arrancar el proyecto](#13-cómo-arrancar-el-proyecto)

---

## 1. Visión general

CryptoCampus es una plataforma universitaria para la UCM que integra **cinco módulos** usando blockchain como capa de verdad:

| Módulo | Descripción |
|---|---|
| **Biblioteca** | Préstamo de libros, juegos de mesa y videojuegos con `LibraryToken` como depósito. Cola FIFO si no hay copias |
| **Tienda** | Compra de productos/merchandising con `ShopTokens`. Checkout en lote, devoluciones con recibos |
| **Insignias académicas (Badges)** | Sistema de insignias soulbound emitidas por profesores. Canjeables por recompensas |
| **Impresión** | Créditos por alumno, simulador con opciones (color/dúplex/páginas/hoja) |
| **Salas de estudio** | Reserva por franja horaria, 1 al día por alumno, máx 4 h consecutivas. QR de confirmación |

### Principio fundamental de diseño

**La blockchain es la fuente de verdad para ownership y estado financiero. Prisma es la fuente de verdad para metadatos y relaciones.**

- On-chain: precios, stock, saldos, roles, estados de préstamo/pedido, eventos auditables
- Prisma: nombres, descripciones, imágenes, ISBN, categorías, relaciones complejas, historial legible

### Tipo de dApp: custodial

CryptoCampus **no** es una dApp estándar con MetaMask. Es una aplicación web tradicional con blockchain en el backend:

- Las wallets se generan server-side al registrar un usuario.
- El usuario nunca ve ni maneja su clave privada (cifrada con AES-256-GCM en `User.encryptedKey`).
- Las transacciones on-chain las firma el backend en nombre del usuario.
- La UX es idéntica a una app web convencional (email + contraseña).

---

## 2. Stack tecnológico

### Frontend / Backend (`packages/nextjs`)
- **Next.js 16** (App Router + React Server Components) — framework full-stack
- **React 19** — librería de UI
- **TypeScript 5.8** — tipado estático en todo el proyecto
- **Tailwind CSS 4** — estilos utility-first
- **Prisma 7** — ORM para PostgreSQL con cliente tipado
- **iron-session** — sesiones cifradas en cookies httpOnly
- **bcryptjs** — hash de contraseñas
- **Viem 2** — cliente blockchain server-side (la wallet del admin y las de los alumnos firman vía viem puro)
- **Wagmi 2** — hooks React lado cliente, solo para configuración de red (lecturas puntuales)
- **Recharts 3** — gráficos en dashboards
- **pdf-lib 1** — manipulación de PDFs (simulador de impresión)
- **qrcode.react 4** — generación de QR (reservas de salas)

### Blockchain (`packages/hardhat`)
- **Solidity 0.8.28** — contratos inteligentes
- **Hardhat 3** — entorno de desarrollo
- **Hardhat Ignition 3** — sistema de despliegue declarativo
- **OpenZeppelin Contracts 5.6** — contratos base (ERC-20, ERC-1155, AccessControl, Pausable, ReentrancyGuard)
- **Viem** — cliente blockchain en tests y server actions
- **Foundry (Anvil + Forge)** — nodo local persistente (Anvil) y testing en Solidity (Forge)

### Base de datos
- **PostgreSQL 15** — base de datos relacional (puerto 5435 en local, levantada con Docker)

### Herramientas
- **pnpm 10.33 workspaces** — monorepo con `packages/hardhat` y `packages/nextjs`
- **Node crypto (AES-256-GCM)** — cifrado de claves privadas en BD

---

## 3. Estructura del monorepo

```
CryptoCampus/
├── packages/
│   ├── hardhat/                  # Contratos Solidity + despliegue + tests
│   └── nextjs/                   # Aplicación web full-stack
│
├── scripts/
│   ├── dev.mjs                   # Orquestador de arranque (Anvil + Prisma + Next)
│   ├── seed.mjs                  # Lanzador de todos los seeds
│   └── reset-chain.mjs           # Borra estado on-chain local
│
├── docker-compose.yaml           # PostgreSQL (puerto 5435)
├── ARCHITECTURE.md               # Este archivo
├── README.md                     # Onboarding
├── TFG-DOCUMENTACION-TECNICA.md  # Memoria TFG
├── CLAUDE.md                     # Guía para Claude Code
├── package.json                  # Workspace root (scripts globales)
└── pnpm-workspace.yaml
```

---

## 4. Smart Contracts (`packages/hardhat`)

### Archivos importantes

```
packages/hardhat/
├── contracts/                               # Código Solidity (8 producción + Example)
├── ignition/modules/CampusModule.ts         # Despliegue declarativo de todos los contratos
├── artifacts/                               # ABIs generados (consumidos desde Next.js)
└── ignition/deployments/chain-31337/
    └── deployed_addresses.json              # Direcciones tras el primer deploy
```

### 4.1 Los 8 contratos de producción

#### `CampusRoles` — AccessControl + Pausable
- **Responsabilidad**: Registro de usuarios y gestión de roles
- **Roles**: `STUDENT_ROLE`, `PROFESSOR_ROLE`, `LIBRARIAN_ROLE`, y `DEFAULT_ADMIN_ROLE` (admin)
- **Funciones clave**: `registerUser(address, role)`, `hasRole(role, address)`, `grantRole()`, `revokeRole()`
- **Nota**: Solo el admin (Account #0 de Anvil/Hardhat) puede registrar usuarios y asignar roles

#### `LibraryToken` — ERC-20 + Pausable
- **Símbolo**: LIB
- **Decimales**: 0 (unidades enteras)
- **Responsabilidad**: Token de depósito para préstamos
- **Flujo**: Al solicitar préstamo, el usuario "gasta" 1 LIB → al devolver, lo recupera
- **`trustedSpender`**: `LibraryManager` puede mover tokens del alumno sin `approve` previo
- **Mint**: Solo el admin. En el registro se minetan 10 LIB iniciales por alumno

#### `ShopToken` — ERC-20 + Pausable
- **Símbolo**: SHPT
- **Decimales**: 0
- **Responsabilidad**: Moneda de la tienda y sistema de recompensas
- **`trustedSpender`**: `CampusShop` y el admin. El sistema de recompensas automáticas también mintea aquí
- **Mint**: admin (+ recompensas automáticas según las acciones del usuario)

#### `LibraryManager` — ERC-1155 + ERC1155Supply + ReentrancyGuard + Pausable
- **Responsabilidad**: Catálogo de ítems + gestión de préstamos + cola FIFO
- **`tokenId`** = id de un título (libro, juego, videojuego). `supply` = número de copias
- **Funciones**: `addItem(copies)`, `requestLoan(itemId)`, `pickupLoan(loanId)`, `returnLoan(loanId)`, `expireReservation(loanId)`
- **Cola FIFO**: si `availableCopies == 0`, la solicitud entra en `QUEUED`. Al devolverse una copia, la primera en cola pasa a `RESERVED` automáticamente
- **Vinculación con Prisma**: `tokenId` ↔ `LibraryItem.tokenId`, `loanId` ↔ `Loan.loanId`

#### `CampusShop` — ERC-1155 + ERC1155Supply + ReentrancyGuard + Pausable
- **Responsabilidad**: Tienda (catálogo, compras, devoluciones)
- **`tokenId`** = variante de producto (ej. camiseta roja talla M). Cada variante tiene `price` y `stock`
- **Funciones**: `addProduct(price, stock)`, `purchaseBatch(ids[], amounts[])`, `returnItem(orderId)`
- **Batches**: Una compra con múltiples productos genera un `batchId` único para agrupar
- **Vinculación con Prisma**: `tokenId` ↔ `Product.tokenId`, `batchId` ↔ `OrderBatch.batchId`

#### `BadgeSystem` — ERC-1155 + ERC1155Supply + Pausable
- **Responsabilidad**: Insignias académicas soulbound + recompensas canjeables
- **Tokens de dos tipos**:
  - **SubjectBadge tokens** (1 por offering): ganados por los alumnos, soulbound (no transferibles)
  - **Reward tokens**: creados por profesores, consumen badges para mintearse
- **Soulbound**: `_update()` sobrescrito para bloquear transferencias entre usuarios (solo mint/burn)
- **Funciones**: `createSubjectBadge()`, `createAssignment()`, `createPrizeCategory()`, `awardBadge()`, `createReward()`, `redeemReward()`, `burnReward()`

#### `Printer` — Pausable
- **Responsabilidad**: Créditos de impresión por alumno
- **Constantes**: `INITIAL_CREDITS = 200` al registrarse
- **Funciones**: `print(student, pages)`, `setCredits(student, credits)`, `getCredits(student)`
- **Admin/Librarian**: Créditos ilimitados (bypass en la Server Action, no en el contrato)
- **Eventos**: `PrintJobExecuted(student, pages, remainingCredits)`

#### `RoomBooking` — ReentrancyGuard + Pausable
- **Responsabilidad**: Reservas de salas de estudio
- **Granularidad**: Slots por hora. Máx 4 h consecutivas, 1 reserva por día por alumno
- **Funciones**: `bookSlot(roomId, startHour, duration)`, `cancelBooking(bookingId)`
- **Validación**: El contrato impide solapes, extras y múltiples reservas mismo día

### 4.2 Direcciones desplegadas (chain 31337)

Las direcciones son **deterministas** en Hardhat/Anvil si se despliega siempre desde cero en el mismo orden:

```
CampusRoles:    0x5FbDB2315678afecb367f032d93F642f64180aa3
LibraryToken:   0x...
ShopToken:      0x...
LibraryManager: 0x...
CampusShop:     0x...
BadgeSystem:    0x...
Printer:        0x...
RoomBooking:    0x...
```

Tras el primer deploy de Ignition, las direcciones exactas quedan en `packages/hardhat/ignition/deployments/chain-31337/deployed_addresses.json`. El frontend las lee desde [`packages/nextjs/src/lib/contracts.ts`](packages/nextjs/src/lib/contracts.ts) que las re-exporta tipadas.

### 4.3 Optimización de gas

Se eliminaron todos los strings de los structs on-chain. Nombres, descripciones, títulos, autores e ISBN viven en Prisma. La blockchain solo guarda lo que necesita para ejecutar lógica: precios, cantidades, estados, direcciones. Esto reduce el coste de gas y simplifica las upgrades.

### 4.4 Patrones de seguridad

- **CEI (Checks-Effects-Interactions)**: Todas las funciones verifican, actualizan estado y después hacen llamadas externas. Previene reentrancia.
- **ReentrancyGuard**: Aplicado en funciones con transferencias ERC-1155.
- **Pausable**: Todos los contratos pueden pausarse por el admin en emergencia.
- **Custom errors**: En vez de `require("...")` se usan errores tipados (`error NotStudent(address)`). Gas más barato y más informativos.
- **Restricción de transferencias**: `LibraryManager` y `BadgeSystem` sobrescriben `_update()` para impedir transferencias directas (solo el contrato media).

---

## 5. Base de datos — Prisma schema

**Archivo**: [`packages/nextjs/prisma/schema.prisma`](packages/nextjs/prisma/schema.prisma).

27 modelos en total. Resumen por dominio:

### 5.1 Usuarios y autenticación

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  password      String   // bcrypt (12 rondas)
  name          String
  address       String   @unique   // wallet address on-chain
  encryptedKey  String             // AES-256-GCM
  role          UserRole
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  // relaciones: Enrollments, Loans, Orders, BadgeAwards, ...
}
```

- `address`: dirección pública de la wallet generada server-side.
- `encryptedKey`: clave privada cifrada. **Nunca se expone al frontend**.
- `role`: refleja el rol on-chain (`CampusRoles`) para evitar consultas blockchain en cada request.

### 5.2 Academic (asignaturas)

```prisma
model Subject           { id, name, code unique }
model SubjectOffering   { id, subjectId, professorId, group, academicYear (unique compuesto) }
model Enrollment        { id, userId, subjectOfferingId (unique compuesto) }
```

Cada `SubjectOffering` es una instancia concreta de una asignatura (profesor + grupo + curso). Un alumno se matricula en ofertas concretas.

### 5.3 Badges (insignias académicas)

```prisma
model SubjectBadge       { id, subjectOfferingId unique, tokenId }
model Assignment         { id, subjectBadgeId, name, description, deadline, autoClose }
model PrizeCategory      { id, assignmentId, name, badgeReward, maxWinners }
model TaskSubmission     { id, assignmentId, studentId, ... }
model BadgeAward         { id, prizeCategoryId, userId, subjectBadgeId, awardedAt, txHash }
model Reward             { id, subjectBadgeId, name, description, category, badgeCost, supply, active, rewardId }
model RewardRedemption   { id, rewardId, userId, redeemedAt, txHash }
model UseRequest         { id, rewardId, studentId, status (PENDING/APPROVED/REJECTED/CANCELLED) }
```

Un `Assignment` contiene una o más `PrizeCategory`. Cuando el profesor concede un award, se crea un `BadgeAward` y se mintea el token on-chain.

### 5.4 Library (biblioteca)

```prisma
model LibraryItem  { id, tokenId, type, title, creator, totalCopies, coverUrl, category, active, ... }
model Loan         { id, loanId, userId, libraryItemId, status (QUEUED/RESERVED/PICKED_UP/RETURNED/EXPIRED/CANCELLED), requestDate, reservationDate, dueDate, txHash }
```

Un `Loan` pasa por una máquina de estados. El `LibraryManager` on-chain garantiza las transiciones atómicas.

### 5.5 Rooms (salas)

```prisma
model Room         { id, name, capacity, location, amenities, active }
model RoomBooking  { id, userId, roomId, date, startHour, duration, cancelled, txHash }
```

### 5.6 Printing (impresión)

```prisma
model Printer   { id, name, location, active }
model PrintLog  { id, userId, printerId, filename, pages, copies, color, duplex, paperSize, orientation, creditsUsed, txHash }
```

### 5.7 Shop (tienda)

```prisma
model ProductBase  { id, name, description, category, slug unique }
model Product      { id, productBaseId, tokenId, color, variantLabel, price, stock, imageUrl, active }
model Cart         { id, userId unique }
model CartItem     { id, cartId, productId, quantity }
model Order        { id, orderId, userId, productId, pricePaid, status (PAID/DELIVERED/RETURNED), txHash, purchaseDate, deliveryDate, returnDate }
model OrderBatch   { id, batchId, userId, totalPaid, generalStatus, txHash, purchaseDate }
// Order.batchId ↔ OrderBatch.id
```

### 5.8 Recompensas y simulación

```prisma
model ShopTokenReward        { id, userId, amount, reason (enum), txHash, createdAt }
model PaymentSimulationLog   { ... }
model CardTopupSimulation    { ... }
```

`ShopTokenReward` es el ledger auditable de todas las recompensas automáticas que se han minteado.

### 5.9 Principio de vinculación Prisma ↔ Blockchain

Cada entidad con representación on-chain tiene un campo `tokenId` (o `loanId`/`orderId`/`batchId`/`rewardId`) que es el uint256 devuelto por el contrato al crearla. Este ID es la clave de unión entre los dos ledgers. Los `txHash` permiten trazar cada acción a su transacción on-chain.

---

## 6. Aplicación Next.js (`packages/nextjs`)

### Estructura de carpetas

```
packages/nextjs/
├── src/
│   ├── app/                  # App Router (rutas)
│   ├── actions/              # Server Actions (8 módulos)
│   ├── components/           # ui/ + shared/ + forms/ + dashboard/ + layout/
│   ├── lib/                  # viem, prisma, crypto, session, shopRewards, contracts, ...
│   ├── hooks/                # 5 hooks custom
│   ├── contexts/             # 4 React Contexts
│   ├── types/                # tipos compartidos
│   └── proxy.ts              # middleware de protección de rutas
├── prisma/
│   ├── schema.prisma
│   └── seed.ts               # utilidad CLI para reejecutar seeds
├── scripts/                  # 10 scripts .mjs (seeds, resync, cleanup)
├── public/                   # assets estáticos + uploads
├── tsconfig.json             # alias @/ → ./src/
└── next.config.ts
```

### 6.1 `src/app/` — Rutas y páginas

Next.js App Router mapea carpetas a URLs. Cada `page.tsx` es una página; cada `layout.tsx` envuelve sus hijos.

#### Grupos de rutas

- `(auth)/` — grupo sin prefijo: `/login`
- `(main)/` — área privada protegida por middleware `proxy.ts`

#### Rutas por rol (resumen)

Ver [RUTAS.md](./packages/nextjs/RUTAS.md) para el listado exhaustivo. Estructura base:

```
src/app/
├── layout.tsx                        # Root layout: Providers
├── page.tsx                          # Homepage pública (preview)
├── (auth)/login/page.tsx             # Formulario login
│
├── (main)/
│   ├── layout.tsx                    # Sidebar + Header + contextos globales
│   │
│   ├── admin/                        # Rol ADMIN
│   │   ├── page.tsx                  # Dashboard con stats globales
│   │   ├── users/...                 # Gestión de usuarios
│   │   ├── subjects/...              # Asignaturas y grupos
│   │   ├── library/...               # Ítems, préstamos, salas, impresión
│   │   ├── shop/...                  # Productos, transacciones, pedidos
│   │   ├── rewards/...               # Recompensas globales e inventario por alumno
│   │   └── ...
│   │
│   ├── professor/                    # Rol PROFESSOR
│   │   ├── page.tsx                  # Dashboard con sus asignaturas
│   │   ├── subjects/[offeringId]/... # Alumnos, tareas, recompensas, solicitudes
│   │   ├── students/...              # Todos sus alumnos + inventario recompensas
│   │   └── ...
│   │
│   ├── librarian/                    # Rol LIBRARIAN
│   │   ├── page.tsx
│   │   ├── items/, loans/, rooms/, printing/ ...
│   │
│   └── student/                      # Rol STUDENT
│       ├── page.tsx                  # Dashboard personal
│       ├── library/...               # Catálogo, mis préstamos, salas, impresión
│       ├── shop/...                  # Catálogo, carrito, pedidos, topup
│       └── badges/...                # Mis insignias, recompensas, solicitudes
│
└── api/                              # API Routes — thin wrappers de server actions
    ├── auth/, admin/, academic/,
    ├── library/, rooms/, printer/,
    ├── badges/, shop/, ...
```

### 6.2 `src/actions/` — Server Actions

**Regla**: Toda lógica que toca Prisma o firma transacciones blockchain vive aquí.

Los 8 módulos:

| Módulo | Responsabilidad |
|---|---|
| `auth.ts` | `createUser`, `loginUser`, `logoutUser`, `getMe`, `updatePassword` |
| `academic.ts` | `listSubjects`, `createSubject`, `createOffering`, `enrollStudent`, `unenrollStudent`, `listAvailableStudents`, ... |
| `badges.ts` | `createSubjectBadge`, `createAssignment`, `awardBadge`, `createReward`, `redeemReward`, `requestUseReward`, `getOfferingRewardsInventory`, ... |
| `library.ts` | `addItem`, `requestLoan`, `pickupLoan`, `returnLoan`, `listMyLoans`, `listRequests`, `getLibraryStats`, ... |
| `rooms.ts` | `listRooms`, `bookSlot`, `cancelBooking`, `getAvailability`, `listMyBookings`, ... |
| `printing.ts` | `executeMyPrintJob`, `getMyPrinterCredits`, `listMyPrinterLogs`, `createPrinter`, `getMyPrintsByMonth`, ... |
| `shop.ts` | `listProducts`, `addToCart`, `checkout`, `returnOrder`, `createProduct`, `topup`, ... |
| `onboarding.ts` | `markModuleFirstUse`, helpers de primer uso para gatillar recompensas bonus |

### 6.3 Patrón canónico de una Server Action

```typescript
"use server";

export async function requestLoan(itemId: string) {
  const session = await getSession();
  ensureRole(session, ["STUDENT"]);

  const item = await prisma.libraryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Ítem no encontrado");

  const wallet = await getUserWalletClient(session.userId!);
  const txHash = await wallet.writeContract({
    address: CONTRACT_ADDRESSES.libraryManager,
    abi: LIBRARY_MANAGER_ABI,
    functionName: "requestLoan",
    args: [BigInt(item.tokenId)],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const loan = await prisma.loan.create({
    data: { userId: session.userId!, libraryItemId: item.id, status: "RESERVED", requestTxHash: txHash },
  });

  const rewards = await issueReward({
    userId: session.userId!,
    userAddress: session.address!,
    mainReason: null,
    moduleFirstUse: "LIBRARY",
  });

  return { loan, rewards };
}
```

Pasos:
1. Sesión + role guard (`ensureRole`).
2. Validación de inputs y estado.
3. Ejecución on-chain (descifra clave del usuario → `walletClient.writeContract`).
4. Espera `waitForTransactionReceipt` → confirma tx minada.
5. Persistencia de metadata en Prisma.
6. Recompensas automáticas si aplica (`issueReward`).
7. Devuelve resultado al cliente.

### 6.4 API Routes como thin wrappers

Las rutas API (`app/api/...`) son wrappers mínimos sobre actions. Responsabilidades:

1. Extraer parámetros del request (body, query, params).
2. Llamar al Server Action correspondiente.
3. Transformar errores en códigos HTTP (`401`, `403`, `404`, `409`, `500`).

Ejemplo:
```ts
// app/api/library/loans/route.ts
export async function POST(req: NextRequest) {
  try {
    const { itemId } = await req.json();
    const result = await requestLoan(itemId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    const status = message === "No autenticado" ? 401
      : message === "No autorizado" ? 403
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
```

### 6.5 `src/components/` — Componentes React (Atomic Design)

Ver sección 10 de [TFG-DOCUMENTACION-TECNICA.md](./TFG-DOCUMENTACION-TECNICA.md) para detalle. Resumen:

| Capa | Carpeta | Nº | Qué tiene |
|---|---|---|---|
| Atoms | `components/ui/` | 36 | `Button`, `Input`, `Card`, `Table`, `Modal`, `Pagination`, etc. Sin lógica de negocio |
| Molecules | `components/shared/` | 49 | `StatCard`, `LoanCard`, `ProductCard`, `SectionTitle`, `NavCard`, etc. Sin side-effects pesados |
| Forms | `components/forms/` | 13 | Formularios con `onSubmit(data)` (`LoginForm`, `ItemForm`, `AssignmentForm`, ...) |
| Organisms | `components/dashboard/` | 13 | `ShopCartDrawer`, `OrderBatchTable`, `SubjectExpandableRow`, `StudentRewardsInventoryTable`, etc. Orquestan hooks + actions |
| Layout | `components/layout/` | 4 | `Header`, `Sidebar`, `ProfessorSubjectsNav`, `StudentOnboardingModal` |

Cada carpeta tiene un `index.ts` que re-exporta todo (barrel). La carpeta `shared/` tiene cobertura 100% (49/49).

### 6.6 `src/lib/` — Utilidades y configuración

```
src/lib/
├── prisma.ts                # Singleton de PrismaClient (patrón Next.js dev con HMR)
├── contracts.ts             # ABIs importados de artifacts + CONTRACT_ADDRESSES + ROLE_CONSTANTS
├── viem.ts                  # adminWalletClient (Account #0) + publicClient server-side
├── wagmi.ts                 # Configuración Wagmi client-side (chain hardhat, SSR: true)
├── session.ts               # SessionOptions de iron-session + SessionData
├── crypto.ts                # encrypt/decrypt AES-256-GCM para claves privadas
├── auth.ts                  # getSession(), ensureRole(), ensureAdmin() helpers
├── shopRewards.ts           # mintShopReward, issueReward (server-only)
├── shopRewardsMeta.ts       # Enums + constantes (cliente/servidor safe)
├── rewardToast.ts           # toastRewards() helper cliente
├── formatters.ts            # formatShortDate, formatCredits, etc.
├── library-constants.ts     # opciones filtros, labels
├── shop-constants.ts        # idem
├── shop-utils.ts            # helpers de shop (slug, buildGroupSummary, ...)
├── rate-limit.ts            # Rate limiter en memoria
└── utils.ts                 # cn() (clsx + tailwind-merge)
```

#### Por qué existe `viem.ts` separado de `wagmi.ts`

- `wagmi.ts`: cliente (browser). Configura la conexión de red para hooks de lectura puntuales.
- `viem.ts`: **servidor**. Contiene el `adminWalletClient` (Account #0) y el `publicClient`. La clave privada del admin nunca sale del servidor.

#### Por qué `shopRewardsMeta.ts` separado de `shopRewards.ts`

- `shopRewardsMeta.ts`: enums, constantes y tipos. **Safe para importar desde cliente**.
- `shopRewards.ts`: helpers server-only (`mintShopReward`, `issueReward`). Importa Prisma + Viem. No se puede arrastrar al bundle del navegador.

### 6.7 `src/proxy.ts` — Middleware de protección de rutas

Intercepta todas las peticiones a `/{role}/*` y `/login`:

- Usuario no autenticado intentando entrar en rutas de rol → redirige a `/login?returnUrl=...`
- Usuario autenticado intentando entrar en `/login` → redirige a `/{suRol}`
- Usuario autenticado intentando entrar en la ruta de otro rol → redirige a `/{suRol}`

### 6.8 `src/hooks/` — Hooks custom (5)

| Hook | Propósito |
|---|---|
| `useAuthUser` | Carga la sesión actual (`/api/auth/me`). Usado en layouts y guards |
| `useForm<T>` | Gestión de formularios con validación + submit async (`fields`, `errors`, `submitError`, `loading`, `setField`, `handleSubmit`) |
| `usePaginatedList<T>` | Listados paginados. Encapsula offset/limit/filters/refresh, elimina boilerplate en ~17 pages |
| `useToast` | Acceso al contexto de toasts (crear/eliminar notificaciones) |
| `useTheme` | Acceso al contexto de tema (light/dark persistido en localStorage) |

### 6.9 `src/contexts/` — Contextos React (4)

| Contexto | Propósito |
|---|---|
| `CartContext` | Carrito compartido entre todas las pages de `/student/shop/*`. Controla apertura del drawer y estado del checkout overlay |
| `OnboardingContext` | Gestiona la primera entrada del STUDENT — controla apertura del modal |
| `ThemeContext` | Tema light/dark, persistencia en localStorage |
| `ToastContext` | Notificaciones globales (toast stack + `addToast` API) |

### 6.10 `src/types/index.ts` — Tipos compartidos

```typescript
UserRole = "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN"
SessionUser = { id, email, name, role, address }
ServiceRoute, ServiceSection, ROLE_FOLDERS, ...
```

---

## 7. Flujo de datos: blockchain vs Prisma

### Crear un ítem de biblioteca (ejemplo canónico)

```
Admin hace click en "Añadir libro"
  ↓
<ItemForm onSubmit={addItem} />
  ↓
actions/library.ts → addItem({ title, creator, type, totalCopies, ... })
  ↓
  1. adminWalletClient.writeContract(LibraryManager.addItem(totalCopies))
     → devuelve txHash
     → el evento ItemAdded emite itemId (uint256)
  2. publicClient.waitForTransactionReceipt(txHash)
  3. prisma.libraryItem.create({
       title, creator, type, tokenId: itemId, coverUrl, metadata: {...},
     })
  ↓
Respuesta al componente: { success: true, item: { id, title, tokenId } }
```

### Quién guarda qué

| Dato | Blockchain | Prisma |
|---|---|---|
| Copias disponibles | ✅ `LibraryManager` (supply) | No |
| Título, autor, ISBN | No | ✅ `LibraryItem` |
| Estado del préstamo | ✅ `LibraryManager.loans.status` | ✅ `Loan.status` (redundante para queries rápidas) |
| `txHash` del préstamo | No | ✅ `Loan.requestTxHash` |
| Saldo de LibraryToken | ✅ `LibraryToken` (ERC-20) | No |
| Precio de un producto | ✅ `CampusShop` | No |
| Nombre del producto | No | ✅ `Product.name` |
| Insignia ganada por un alumno | ✅ `BadgeSystem` (balance ERC-1155) | ✅ `BadgeAward` (registro con `txHash`) |

---

## 8. Autenticación y sesiones

### Registro de otros roles (PROFESSOR, LIBRARIAN, ADMIN)

Solo el admin puede crear usuarios con otros roles. Flujo desde `/admin/users/new`:

```
actions/auth.ts::createUser()
   ├── 1. Valida email único
   ├── 2. Genera wallet: privateKey = generatePrivateKey()
   ├── 3. Cifra clave: encryptedKey = encrypt(privateKey, SESSION_SECRET)
   ├── 4. bcrypt.hash(password, 12)
   ├── 5. prisma.user.create({...})
   ├── 6. On-chain: CampusRoles.grantRole(ROLE, address)  — admin firma
   ├── 7. On-chain: LibraryToken.mint(address, 10)       — solo si STUDENT
   └── Retorna { user, passwordIfGenerated }
```

### Login

```
POST /api/auth/login { email, password }
   ├── prisma.user.findUnique({ where: { email } })
   ├── bcrypt.compare(password, user.password)
   ├── getIronSession()
   │   └── session.userId = user.id; session.role = user.role; session.address = user.address
   └── session.save()
      → Cookie httpOnly cifrada con SESSION_SECRET
```

### Cómo se firma una tx en nombre del usuario

```typescript
// En una Server Action
const session = await getSession();
const user = await prisma.user.findUnique({ where: { id: session.userId! } });
const privateKey = decrypt(user.encryptedKey);           // AES-256-GCM
const account = privateKeyToAccount(privateKey as `0x${string}`);
const userWalletClient = createWalletClient({
  account,
  chain: hardhat,
  transport: http(),
});
const txHash = await userWalletClient.writeContract({ ... });
```

---

## 9. Roles y permisos

### On-chain (`CampusRoles`)

| Rol | Capacidades on-chain |
|---|---|
| `DEFAULT_ADMIN_ROLE` | Todo. Registrar usuarios, asignar roles, mintear tokens, pausar contratos |
| `PROFESSOR_ROLE` | Crear subject badges, assignments, prize categories, rewards. Otorgar badges |
| `LIBRARIAN_ROLE` | Añadir ítems, aprobar/rechazar préstamos, confirmar devoluciones |
| `STUDENT_ROLE` | Solicitar préstamos, comprar, canjear recompensas, reservar salas, imprimir |

### En la app (middleware + server actions)

| Ruta | Roles permitidos |
|---|---|
| `/admin/*` | ADMIN |
| `/librarian/*` | LIBRARIAN (ADMIN también tiene acceso redirigiendo explícitamente) |
| `/professor/*` | PROFESSOR (ADMIN) |
| `/student/*` | STUDENT (ADMIN) |

El ADMIN puede acceder a todas las vistas usando la URL directa. Server Actions verifican con `ensureRole()` y los modifiers on-chain verifican con `CampusRoles.hasRole()`.

---

## 10. Sistema de recompensas automáticas

Ver [TFG-DOCUMENTACION-TECNICA.md — sección 6](./TFG-DOCUMENTACION-TECNICA.md#6-sistema-de-recompensas-automáticas) para el detalle completo.

Resumen:

- Cada vez que un usuario completa una acción premiable, el backend llama `issueReward()` de `lib/shopRewards.ts`.
- El helper:
  1. Determina si procede recompensa principal + bonus de primer uso del módulo.
  2. Por cada una, llama `ShopToken.mint()` vía `adminWalletClient`.
  3. Registra la fila en `ShopTokenReward` (auditoría completa).
  4. Devuelve un array `RewardGrant[]` que el cliente muestra como toast.

Razones y cantidades definidas en `lib/shopRewardsMeta.ts` (safe cliente/servidor). Los puntos de invocación están en `actions/library.ts`, `actions/rooms.ts`, `actions/printing.ts`, `actions/badges.ts` y `actions/shop.ts`.

---

## 11. Motor blockchain: Anvil vs Hardhat

Por defecto `pnpm dev` usa **Anvil** (Foundry) con estado persistente en `.anvil-state.json`:
- Auto-guarda cada 30 s y recarga al reiniciar.
- Contratos desplegados, balances y transacciones **persisten** entre reinicios.

Para forzar Hardhat (volátil):
- `pnpm dev:hardhat`, o flag `--hardhat`, o `BLOCKCHAIN_NODE=hardhat pnpm dev`.

El script `scripts/dev.mjs`:
1. Arranca el nodo elegido.
2. Detecta si los contratos ya están desplegados (`eth_getCode` a `CampusRoles`). Si sí, salta el deploy.
3. Si es necesario (fresh o primer arranque), corre `hardhat ignition deploy` + `setTrustedSpender()`.
4. `resync-users.mjs` alinea usuarios on-chain (grants de rol) con los que haya en Prisma.
5. Ejecuta los seeds idempotentes.
6. Arranca Next.js.

Al cambiar de motor: `pnpm reset:all` para evitar divergencia entre estado on-chain y Prisma.

---

## 12. Convenciones de código

### Nombrado de archivos

- Páginas Next.js: `page.tsx` (obligatorio)
- Layouts: `layout.tsx` (obligatorio)
- Componentes: PascalCase → `LibraryItemCard.tsx`, `ItemForm.tsx`
- Server Actions: camelCase de función → `addItem`, `requestLoan`
- Tipos: PascalCase con sufijo descriptivo → `SessionUser`, `UserRole`

### Imports

- `@/lib/...` — utilidades
- `@/actions/...` — Server Actions
- `@/components/...` — componentes (el barrel permite `@/components/shared` para los de dominio)
- `@/hooks/...` — hooks custom
- `@/contexts/...` — Contextos React
- `@/types` — tipos compartidos

### Server Actions

- Comentarios numerados por sección (`─── 1. Nombre ───`) explicando qué hace cada bloque.
- Siempre empiezan con `"use server";`.
- Siempre verifican sesión + rol antes de ejecutar.
- Errores tipados; el wrapper API traduce a HTTP.

### Componentes

- Un componente por archivo; el nombre del archivo coincide con el export.
- Los atoms no importan de `@/actions` ni `@/hooks` (salvo `useToast` para `Button` loading).
- Las moléculas reciben callbacks, no gatillan fetch pesados.
- Los organismos orquestan; las pages delegan.

### Loading states

- **Páginas**: siempre `Skeleton*` (atoms). Nunca `Spinner`.
- **Botones**: `<Button loading>...` que internamente usa `Spinner`.
- **No** crear `loading.tsx` por ruta individual — solo a nivel layout.

### Contratos Solidity

- Siguen el [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html).
- NatSpec en todas las funciones públicas.
- Custom errors (no `require` con strings).
- CEI pattern.
- `Pausable` + `ReentrancyGuard` donde aplique.

### Variables de entorno

```
DATABASE_URL         # PostgreSQL connection string (puerto 5435)
SESSION_SECRET       # ≥32 chars, para iron-session + AES-256-GCM
BLOCKCHAIN_NODE      # opcional: "anvil" (default) | "hardhat"
```

---

## 13. Cómo arrancar el proyecto

Ver [README.md](./README.md) para la guía completa de onboarding. Resumen:

```bash
# 1. Clonar + instalar
git clone <repo>
cd CryptoCampus
pnpm install

# 2. Crear .env en packages/nextjs
echo 'DATABASE_URL="postgresql://root:root@localhost:5435/cryptocampusdb?schema=public"' > packages/nextjs/.env
echo 'SESSION_SECRET="mi-secreto-local-de-al-menos-32-caracteres"' >> packages/nextjs/.env

# 3. Arrancar todo (Docker debe estar corriendo; necesita Foundry o pasar --hardhat)
pnpm dev
```

### Puertos

- Next.js: `http://localhost:3000`
- Nodo Ethereum: `http://127.0.0.1:8545` (chain 31337)
- PostgreSQL: `localhost:5435`
- Prisma Studio (opcional, `pnpm run db:studio`): `http://localhost:5555`
