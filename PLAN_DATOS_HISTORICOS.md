# Plan — Datos históricos solo-Prisma para estadísticas

> **Estado:** pendiente de implementar. Plan revisado y consolidado tras auditoría exhaustiva del código (mayo 2026).
>
> **Decisión confirmada:** opción A — flag `historical: Boolean` explícito en los 5 modelos relevantes + IDs/txHashes nullable + seed dedicado idempotente + reglas de filtrado por tipo de query + marcador visible en UI + ajuste de `db-doctor`.
>
> Este documento incluye archivo:línea concretos para cada cambio. Actúa como checklist y referencia. Las líneas se basan en el commit `b1f87a0` (rama `main`); pueden moverse ±5 si hay edits previos.

---

## Tabla de contenidos

1. [Contexto y motivación](#1-contexto-y-motivación)
2. [Decisión consolidada y alcance](#2-decisión-consolidada-y-alcance)
3. [Cambios al schema Prisma](#3-cambios-al-schema-prisma)
4. [Reglas de clasificación de queries](#4-reglas-de-clasificación-de-queries)
5. [Inventario completo: actions/library.ts](#5-inventario-completo-actionslibraryts)
6. [Inventario completo: actions/shop.ts](#6-inventario-completo-actionsshopts)
7. [Inventario completo: actions/rooms.ts](#7-inventario-completo-actionsroomsts)
8. [Inventario completo: actions/printing.ts](#8-inventario-completo-actionsprintingts)
9. [Helper nuevo: lib/historical.ts](#9-helper-nuevo-libhistoricalts)
10. [Cambios en componentes UI](#10-cambios-en-componentes-ui)
11. [Cambios obligatorios en db-doctor](#11-cambios-obligatorios-en-db-doctor)
12. [Edge case: bonus de primer uso](#12-edge-case-bonus-de-primer-uso)
13. [Nuevo seed: seed-historical.mjs](#13-nuevo-seed-seed-historicalmjs)
14. [Integración: seed.mjs, dev.mjs, package.json](#14-integración-seedmjs-devmjs-packagejson)
15. [Migración Prisma](#15-migración-prisma)
16. [Orden de implementación](#16-orden-de-implementación)
17. [Plan de verificación](#17-plan-de-verificación)
18. [Riesgos y mitigaciones](#18-riesgos-y-mitigaciones)
19. [Fuera de scope](#19-fuera-de-scope)
20. [TL;DR](#20-tldr)

---

## 1. Contexto y motivación

CryptoCampus se vende como _custodial dApp_ donde la blockchain es la **capa de confianza** para préstamos, pedidos, impresiones y reservas. El modelo actual:

- **On-chain** → estado auditable (`loanId`, `orderId`, `bookingId`, `txHash`).
- **Prisma** → metadatos human-readable (nombres, descripciones, imágenes, relaciones).

Cada acción de usuario hoy emite una transacción y persiste el resultado con su `txHash`. Existe un script `db-doctor.mjs` que verifica que `count(Prisma) === nextXId(on-chain)` para detectar drift.

**Problema:** las gráficas y dashboards (panel admin/profesor/estudiante/librarian) salen vacías o muy pobres en una instalación recién seedeada. Generar miles de tx demo on-chain en cada `dev:new` sería:

- Lento (segundos/minutos extra al bootstrap).
- Innecesario: nadie va a auditar préstamos del 2025 en una demo de TFG.
- Conceptualmente caro: gas y storage on-chain para datos puramente decorativos.

**Solución:** datos históricos viven solo en Prisma, marcados con `historical: true`. Cuentan en estadísticas pero **no son accionables** (no tienen contrapartida on-chain, así que ningún `writeContract` puede tocarlos).

**No es un smell de diseño en este contexto** porque:

1. Es un proyecto académico, no producción.
2. El flag deja explícito qué es real (con respaldo on-chain) y qué es histórico.
3. Se documenta en UI cuando aplica.
4. Los flujos accionables filtran el flag → cero riesgo de manipular o llegar a estados inconsistentes con la cadena.

---

## 2. Decisión consolidada y alcance

### 2.1 Modelos afectados (5)

| Modelo | Contrato | ID on-chain | Tabla en schema |
|---|---|---|---|
| `Loan` | `LibraryManager` | `loanId` | [schema.prisma:297](packages/nextjs/prisma/schema.prisma#L297) |
| `OrderBatch` | `CampusShop` | `batchId` | [schema.prisma:446](packages/nextjs/prisma/schema.prisma#L446) |
| `Order` | `CampusShop` | `orderId` | [schema.prisma:461](packages/nextjs/prisma/schema.prisma#L461) |
| `RoomBooking` | `RoomBooking` | `bookingId` | [schema.prisma:336](packages/nextjs/prisma/schema.prisma#L336) |
| `PrintLog` | `Printer` (sin id propio, solo `txHash`) | — | [schema.prisma:368](packages/nextjs/prisma/schema.prisma#L368) |

### 2.2 Modelos NO afectados

- `BadgeAward`, `Reward`, `RewardRedemption`, `UseRequest`, `TaskSubmission`: la mecánica de insignias tiene poco sentido histórico para gráficas básicas (el dashboard del profesor sí pinta `awardsByMonth` y `assignmentsByMonth`, pero queda fuera de scope inicial). Se replicará el patrón si una gráfica concreta lo pide.
- `Subject`, `SubjectOffering`, `Enrollment`, `Product`, `LibraryItem`, `Room`, `Printer`: son **catálogo**, no historial. Los seedeas como hoy.
- `ShopTokenReward`: **no se toca**. Es el ledger de recompensas. Si crearas filas históricas aquí romperías la detección de "primer uso" en `lib/shopRewards.ts:hasRewardOfType()`. Ver §12.
- `User`, `Cart`, `CartItem`: catálogo / estado vivo.

### 2.3 Reglas de oro

1. **Cualquier `writeContract` o `readContract` con un id on-chain → la query origen DEBE filtrar `historical: false`.** Además se añade un guard explícito `if (!entity.<idField>) throw` por defensa en profundidad.
2. **Listas operativas** (pendientes de recoger, devolver, entregar, cancelar; reservas activas/futuras) → filtran `historical: false`.
3. **Stats, gráficas, "mis cosas", historiales** → incluyen históricos sin filtro.
4. **Solo el seed escribe `historical: true`.** Ninguna server action en runtime crea filas históricas. No se expone endpoint para hacerlo.
5. **`txHash` y `<idField>` siempre nullable cuando `historical: true`**, nunca cuando `historical: false`.

---

## 3. Cambios al schema Prisma

Archivo: [`packages/nextjs/prisma/schema.prisma`](packages/nextjs/prisma/schema.prisma).

### 3.1 Loan ([schema.prisma:297](packages/nextjs/prisma/schema.prisma#L297))

```prisma
model Loan {
  id               String     @id @default(cuid())
  loanId           Int?       @unique          // antes: Int @unique  ← nullable
  libraryItemId    String
  userId           String
  status           LoanStatus
  requestDate      DateTime
  reservationDate  DateTime?
  pickupDate       DateTime?
  dueDate          DateTime?
  returnDate       DateTime?
  overdue          Boolean    @default(false)
  // requestTxHash, pickupTxHash, returnTxHash YA SON nullable — no tocar.
  historical       Boolean    @default(false)  // ← nuevo

  libraryItem LibraryItem @relation(fields: [libraryItemId], references: [id])
  user        User        @relation(fields: [userId], references: [id])

  @@index([userId, historical])                // ← nuevo, acelera queries de stats
  @@index([status, historical])                // ← nuevo, acelera listados operativos
}
```

### 3.2 OrderBatch ([schema.prisma:446](packages/nextjs/prisma/schema.prisma#L446))

```prisma
model OrderBatch {
  id            String       @id @default(cuid())
  batchId       Int?         @unique           // antes: Int @unique   ← nullable
  userId        String
  totalPaid     Int
  generalStatus OrderStatus
  txHash        String?                        // antes: String        ← nullable
  purchaseDate  DateTime
  historical    Boolean      @default(false)   // ← nuevo

  user   User    @relation(fields: [userId], references: [id])
  orders Order[]

  @@index([userId, historical])
  @@index([generalStatus, historical])
}
```

### 3.3 Order ([schema.prisma:461](packages/nextjs/prisma/schema.prisma#L461))

```prisma
model Order {
  id           String      @id @default(cuid())
  orderId      Int?        @unique             // antes: Int @unique   ← nullable
  batchId      String                          // FK Prisma a OrderBatch (no es batchId on-chain)
  userId       String
  productId    String
  pricePaid    Int
  status       OrderStatus
  txHash       String?                         // antes: String        ← nullable
  purchaseDate DateTime
  deliveryDate DateTime?
  returnDate   DateTime?
  historical   Boolean     @default(false)     // ← nuevo

  batch   OrderBatch @relation(fields: [batchId], references: [id])
  user    User       @relation(fields: [userId], references: [id])
  product Product    @relation(fields: [productId], references: [id])

  @@index([userId, historical])
  @@index([status, historical])
}
```

### 3.4 RoomBooking ([schema.prisma:336](packages/nextjs/prisma/schema.prisma#L336))

```prisma
model RoomBooking {
  id          String   @id @default(cuid())
  bookingId   Int?     @unique                 // antes: Int @unique   ← nullable
  userId      String
  roomId      String
  date        DateTime
  startHour   Int
  duration    Int
  cancelled   Boolean  @default(false)
  txHash      String?                          // antes: String        ← nullable
  historical  Boolean  @default(false)         // ← nuevo

  user User @relation(fields: [userId], references: [id])
  room Room @relation(fields: [roomId], references: [id])

  @@index([userId, historical])
  @@index([date, cancelled, historical])
}
```

### 3.5 PrintLog ([schema.prisma:368](packages/nextjs/prisma/schema.prisma#L368))

```prisma
model PrintLog {
  id            String   @id @default(cuid())
  userId        String
  printerId     String
  filename      String
  pages         Int
  copies        Int
  color         Boolean
  duplex        Boolean
  paperSize     String
  orientation   String
  creditsUsed   Int
  txHash        String?                         // antes: String        ← nullable
  createdAt     DateTime @default(now())
  historical    Boolean  @default(false)        // ← nuevo

  user    User    @relation(fields: [userId], references: [id])
  printer Printer @relation(fields: [printerId], references: [id])

  @@index([userId, historical])
  @@index([createdAt, historical])              // ← acelera getMyPrintsByMonth
}
```

### 3.6 Confirmaciones obligatorias antes de tocar el schema

- Verificar exactamente qué campos `txHash*` existen en cada modelo (nombres pueden divergir: `requestTxHash`, `pickupTxHash`, `returnTxHash` en `Loan`; `txHash` plano en los demás). Hacer `Read schema.prisma` y confirmar línea por línea.
- Confirmar que **`Order.batchId` es FK Prisma a `OrderBatch.id`**, no el `batchId` on-chain. El `batchId` on-chain vive solo en `OrderBatch.batchId`.

---

## 4. Reglas de clasificación de queries

| Tipo | Filtro `historical: false` | Ejemplo |
|---|---|---|
| **Operativa** (precede a `writeContract`) | Sí + guard `if (!entity.<idField>) throw` | `cancelLoan`, `markOrderDelivered` |
| **Listado operativo** (admin/librarian: pendientes, en curso) | Sí | `listPendingPickups`, `listPendingOrders` |
| **Stat agregada** (count, groupBy, byMonth, top X) | No (incluye) | `getLibraryStats`, `getMyPrintsByMonth` |
| **"Mis cosas" del estudiante** (historial personal) | No (incluye) | `getMyLoans`, `listMyOrders`, `listMyBatches`, `getMyBookings` |
| **Detalle por ID** (puede consumirse desde admin para auditar histórico) | No (incluye, pero la UI condiciona acciones) | `getOrderDetail`, `getBatchDetail` |
| **Métrica viva instantánea** ("activos AHORA", "hoy") | Sí (no tiene sentido contar pasados) | `roomBooking.count({ date: { gte: today }})` |
| **Read-only listener de evento on-chain** | No (es reactivo a la cadena, no toca históricos por construcción) | `handleLoanReservedEvent` |

Adicionalmente:

- **Si la query ya filtra por ventana temporal (últimos 6 meses)**, el filtro de fecha ya excluye cualquier histórico anterior a esa ventana. **No quites el filtro de fecha**, déjalo y deja `historical` libre — los históricos dentro de la ventana cuentan.
- **Si una query usa `include: { libraryItem: true }`** o similar, las FKs siguen funcionando con históricos (el catálogo siempre está poblado).

---

## 5. Inventario completo: `actions/library.ts`

Archivo: [`packages/nextjs/src/actions/library.ts`](packages/nextjs/src/actions/library.ts) (1126 líneas).

### 5.1 Queries Prisma sobre `Loan`

| Línea aprox. | Función | Operación | Categoría | Cambio |
|---|---|---|---|---|
| 420 | `handleLoanReservedEvent` | `loan.update` | Listener on-chain | **No filtrar.** Es reactivo, los históricos no llegarán nunca a este path |
| 442 | `requestLoan` | `loan.findFirst` | Pre-create check | Añadir `historical: false` |
| 500 | `requestLoan` | `loan.create` | Crear con default | N/A (default `false`) |
| 566 | `cancelLoan` | `loan.findUnique` | Operativa | **Filtrar `historical: false` + guard `if (!loan.loanId)`** |
| 583 | `cancelLoan` | `loan.update` | Tras writeContract | Sigue al guard, no requiere filtro extra |
| 607 | `confirmPickup` | `loan.findUnique` | Operativa | **Filtrar + guard** |
| 627 | `confirmPickup` | `loan.update` | Tras writeContract | — |
| 653 | `confirmReturn` | `loan.findUnique` | Operativa | **Filtrar + guard** |
| 670 | `confirmReturn` | `loan.update` | Tras writeContract | — |
| 722 | `forceReturn` | `loan.findUnique` | Operativa | **Filtrar + guard** |
| 735 | `forceReturn` | `loan.update` | Tras writeContract | — |
| 763 | `expireReservation` | `loan.findUnique` | Operativa | **Filtrar + guard** |
| 776 | `expireReservation` | `loan.update` | Tras writeContract | — |
| 808 | `listLoans` | `loan.findMany` | Listado operativo (admin) | **Filtrar `historical: false`** |
| 818 | `listLoans` | `loan.count` | idem | **Filtrar** |
| 835 | `listPendingPickups` | `loan.findMany` | Listado operativo (librarian) | **Filtrar** |
| 845 | `listPendingPickups` | `loan.count` | idem | **Filtrar** |
| 859 | `getMyLoans` | `loan.findMany` | "Mis préstamos" estudiante | **No filtrar** (incluye históricos) |
| 938-944 | `getLibraryStats` | `loan.count` (varios) | Stat agregada | **No filtrar** |
| 946 | `getLibraryStats` | `loan.groupBy` | Top items | **No filtrar** |
| 952 | `getLibraryStats` | `loan.findMany` | Recientes (top 5) | **No filtrar** |
| 960-964 | `getLibraryStats` | `loan.findMany` | Últimos 6 meses | **No filtrar** (filtro temporal ya está) |

### 5.2 `writeContract` / `readContract` con `loan.loanId`

Todas dentro de funciones operativas que ya filtran (después del cambio):

- L479-482 `requestLoan` `writeContract(requestLoan, [...])` — sin `loanId` (lo crea)
- L489-492 `requestLoan` `readContract(getLoanInfo, [newId])` — sin tocar Loan existente
- L574-577 `cancelLoan` `writeContract(cancelLoan, [BigInt(loan.loanId)])` ← **guard nuevo**
- L611-615 `confirmPickup` `writeContract(confirmPickup, [...])` ← **guard**
- L620-623 `confirmPickup` `readContract(getLoanInfo, [...])` ← **guard**
- L657-660 `confirmReturn` `writeContract(confirmReturn, [...])` ← **guard**
- L726-729 `forceReturn` `writeContract(forceReturn, [...])` ← **guard**
- L767-770 `expireReservation` `writeContract(expireReservation, [...])` ← **guard**
- L872-876 `getMyLoans` `readContract(getQueuePosition, [BigInt(loan.loanId)])` ← **guard especial**: si es histórico, devolver `null` para `queuePosition` (no lanzar). Los históricos están todos en estado `RETURNED`, así que el `getQueuePosition` ni siquiera se invoca para ellos en la práctica, pero conviene blindar.

Patrón de guard recomendado:

```ts
if (loan.historical || loan.loanId === null) {
  throw new Error("Operación no disponible: registro histórico sin contraparte on-chain");
}
```

### 5.3 Componentes UI relevantes

- [`components/shared/LoanCard.tsx`](packages/nextjs/src/components/shared/LoanCard.tsx) — usa `title`, `creator`, `status`, `dueDate`, `reservationDate`, `queuePosition`. **NO usa `loanId` ni `txHash`.** Solo necesita aceptar un prop opcional `historical?: boolean` y pintar un badge gris "Histórico" cuando sea `true`.
- [`app/(main)/student/page.tsx`](packages/nextjs/src/app/(main)/student/page.tsx) — dashboard estudiante. Banner de alertas cuenta `activeLoans`, `readyToPickup`, `overdueLoans`. Como **todos los históricos están `RETURNED`**, ninguno entra en esos contadores. **Sin cambios.**
- [`app/(main)/librarian/loans/pickups/page.tsx`](packages/nextjs/src/app/(main)/librarian/loans/pickups/page.tsx) — operativa, ya filtrada.
- [`app/(main)/librarian/loans/returns/page.tsx`](packages/nextjs/src/app/(main)/librarian/loans/returns/page.tsx) — operativa, ya filtrada.
- [`app/(main)/admin/library/loans/page.tsx`](packages/nextjs/src/app/(main)/admin/library/loans/page.tsx) — operativa. Si pinta `txHash` o `loanId`, render condicional (no debería, según el agente).

---

## 6. Inventario completo: `actions/shop.ts`

Archivo: [`packages/nextjs/src/actions/shop.ts`](packages/nextjs/src/actions/shop.ts) (2548 líneas).

### 6.1 Queries Prisma sobre `Order` y `OrderBatch`

| Línea | Función | Operación | Categoría | Cambio |
|---|---|---|---|---|
| 1412 | `purchase` | `orderBatch.create` | Crear | N/A |
| 1427 | `purchase` | `order.create` | Crear | N/A |
| 1458 | `purchase` | `order.updateMany` | Auto-deliver tras `markDelivered` | **Filtrar `historical: false`** (defensa, aunque por construcción son fresh) |
| 1735 | `purchaseFromCart` | `orderBatch.create` | Crear | N/A |
| 1750 | `purchaseFromCart` | `order.create` | Crear | N/A |
| 1784 | `purchaseFromCart` | `order.updateMany` | Auto-deliver | **Filtrar** |
| 1846 | `listMyOrders` | `order.findMany` | "Mis pedidos" estudiante | **No filtrar** |
| 1857 | `listMyOrders` | `order.count` | idem | **No filtrar** |
| 1875 | `getOrderDetail` | `order.findUnique` | Detalle por ID | **No filtrar** (UI condiciona acciones) |
| 1921 | `listAllOrders` | `order.findMany` | Admin lista todo | **No filtrar** |
| 1935 | `listAllOrders` | `order.count` | idem | **No filtrar** |
| 1956 | `markOrderDelivered` | `order.findUnique` | Operativa | **Filtrar + guard `if (!order.orderId)`** |
| 1973 | `markOrderDelivered` | `order.update` | Tras writeContract | — |
| 1996 | `processReturn` | `order.findUnique` | Operativa | **Filtrar + guard** |
| 2020 | `processReturn` | `order.update` | Tras writeContract | — |
| 2055 | `requestReturn` | `order.findUnique` | Operativa | **Filtrar + guard** |
| 2087 | `requestReturn` | `order.update` | Tras writeContract | — |
| 2128 | `listMyBatches` | `orderBatch.findMany` | "Mis batches" estudiante | **No filtrar** |
| 2144 | `listMyBatches` | `orderBatch.count` | idem | **No filtrar** |
| 2183 | `getBatchDetail` | `orderBatch.findUnique` | Detalle por ID | **No filtrar** |
| 2245 | `listAllBatches` | `orderBatch.findMany` | Admin | **No filtrar** |
| 2262 | `listAllBatches` | `orderBatch.count` | Admin | **No filtrar** |
| 2299 | `getBatchDetail` (admin) | `orderBatch.findUnique` | Detalle | **No filtrar** |
| 2359 | `getShopStats` | `order.count` | Stat | **No filtrar** |
| 2360 | `getShopStats` | `order.groupBy` | Stat por status | **No filtrar** |
| 2427 | `listAllTransactions` | `order.findMany` | Log auditoría | **No filtrar** |

### 6.2 `writeContract` con `orderId` o `batchId` — guards obligatorios

| Línea | Función | Llamada | Guard a añadir |
|---|---|---|---|
| 1448-1452 | `purchase` (auto-deliver) | `markDelivered([BigInt(orderId)])` | N/A (orderIds vienen del contrato fresh) |
| 1774-1778 | `purchaseFromCart` (auto-deliver) | `markDelivered([BigInt(order.orderId)])` | N/A |
| **1964-1965** | `markOrderDelivered` | `markDelivered([BigInt(order.orderId)])` | `if (order.historical || order.orderId === null) throw` |
| **2010-2011** | `processReturn` | `processReturn([BigInt(order.orderId)])` | idem |
| **2077-2078** | `requestReturn` | `requestReturn([BigInt(order.orderId)])` | idem |

### 6.3 Componentes UI relevantes

| Archivo | Cambio |
|---|---|
| [`components/shared/BatchHeader.tsx`](packages/nextjs/src/components/shared/BatchHeader.tsx) | Aceptar `batchId: number \| null` y `historical?: boolean`. Cuando `historical`, pintar badge "Histórico" en la cabecera. Cuando `batchId === null`, ocultar la fila "Batch ID #N" o sustituir por "—" |
| [`components/shared/BatchStatusBadge.tsx`](packages/nextjs/src/components/shared/BatchStatusBadge.tsx) | Sin cambios (solo recibe status) |
| [`components/shared/GroupedOrderItem.tsx`](packages/nextjs/src/components/shared/GroupedOrderItem.tsx) | Sin cambios (no usa orderId/txHash) |
| [`components/dashboard/OrderBatchTable.tsx`](packages/nextjs/src/components/dashboard/OrderBatchTable.tsx) | Si pinta `batchId` o link blockchain, render condicional: `{batch.txHash ? <Link>Tx</Link> : <span className="text-text-muted">Histórico</span>}` |
| [`components/dashboard/OrderItemTable.tsx`](packages/nextjs/src/components/dashboard/OrderItemTable.tsx) | idem para `orderId` y `txHash` |
| [`components/dashboard/OrderBatchDetailView.tsx`](packages/nextjs/src/components/dashboard/OrderBatchDetailView.tsx) | Banner "Pedido histórico (sin firma on-chain, no admite acciones)" cuando `batch.historical` |
| [`app/(main)/admin/shop/orders/[id]/page.tsx`](packages/nextjs/src/app/(main)/admin/shop/orders/) | Botones de "Marcar entregado", "Procesar devolución" deshabilitados con tooltip "Histórico, no accionable" cuando `order.historical` |
| [`app/(main)/student/shop/orders/[id]/page.tsx`](packages/nextjs/src/app/(main)/student/shop/orders/) | Botón "Solicitar devolución" deshabilitado cuando `order.historical` |

---

## 7. Inventario completo: `actions/rooms.ts`

Archivo: [`packages/nextjs/src/actions/rooms.ts`](packages/nextjs/src/actions/rooms.ts) (589 líneas).

### 7.1 Queries Prisma sobre `RoomBooking`

| Línea | Función | Operación | Categoría | Cambio |
|---|---|---|---|---|
| 331 | `bookRoom` | `roomBooking.findFirst` | Anti-solape (1/día) | **Filtrar `historical: false`** (defensa: las históricas son pasadas, pero blindamos por si alguna fecha cae sobre hoy) |
| 369 | `bookRoom` | `roomBooking.create` | Crear con `bookingId` | N/A |
| 412 | `cancelBooking` | `roomBooking.findUnique` | Operativa | **Filtrar + guard `if (!booking.bookingId)`** |
| 445 | `cancelBooking` | `roomBooking.update` | Tras writeContract | — |
| 485 | `getRoomAvailability` | `roomBooking.findMany` | Disponibilidad (fallback Prisma) | **Filtrar** (no mostrar slots ocupados por históricas) |
| 510 | `getMyBookings` | `roomBooking.findMany` | "Mis reservas" estudiante | **No filtrar** (historial personal) |
| 545 | `listBookings` | `roomBooking.findMany` | Admin lista | **Filtrar** (operativa) |
| 555 | `listBookings` | `roomBooking.count` | idem | **Filtrar** |
| 570 | `getRoomStats` | `roomBooking.count` total | Stat (¿agregada o viva?) | **Decisión:** dejar SIN filtro si la stat se interpreta como "histórica de uso de salas". **Filtrar** si se interpreta como "operativas activas". Recomendación: sin filtro. |
| 571 | `getRoomStats` | `roomBooking.count({ date: { gte: today } })` | Hoy | N/A (filtro temporal ya excluye históricos pasados) |
| 579 | `getRoomStats` | `roomBooking.count({ cancelled: true })` | Total canceladas | **No filtrar** (stat) |

### 7.2 `writeContract` con `bookingId`

| Línea | Función | Llamada | Guard |
|---|---|---|---|
| 353-357 | `bookRoom` | `bookRoom(...)` (no usa bookingId) | N/A |
| **425-429** | `cancelBooking` (estudiante) | `cancelBooking([BigInt(booking.bookingId)])` | `if (booking.historical \|\| booking.bookingId === null) throw` |
| **429-436** | `cancelBooking` (admin path) | idem | idem |

### 7.3 Componentes UI relevantes

- [`components/shared/BookingCard.tsx`](packages/nextjs/src/components/shared/BookingCard.tsx) L34-36 ya tiene render condicional sobre `bookingId` para el QR (`bookingId ? <QR/> : ""`). **Sin cambios funcionales.** Añadir badge gris "Histórico" cuando recibe la prop `historical`.
- [`components/shared/RoomSelectorCard.tsx`](packages/nextjs/src/components/shared/RoomSelectorCard.tsx) — sin cambios (no usa bookingId).
- [`components/shared/RoomAvailabilityGrid.tsx`](packages/nextjs/src/components/shared/RoomAvailabilityGrid.tsx) — depende de `getRoomAvailability` que ya filtra. Sin cambios.

---

## 8. Inventario completo: `actions/printing.ts`

Archivo: [`packages/nextjs/src/actions/printing.ts`](packages/nextjs/src/actions/printing.ts) (687 líneas).

### 8.1 Queries Prisma sobre `PrintLog`

| Línea | Función | Operación | Categoría | Cambio |
|---|---|---|---|---|
| 171 | `listMyPrinterLogs` | `printLog.findMany` | Historial usuario | **No filtrar** |
| 247 | `listPrinterLogsForAdmin` | `printLog.findMany` | Historial admin/auditoría | **No filtrar** |
| 548 | `executePrinterJob` | `printLog.create` | Crear | N/A |
| 657 | `getMyPrintsByMonth` | `printLog.findMany` | Gráfica mensual usuario (caso de uso PRINCIPAL del plan) | **No filtrar** (filtro temporal de 6 meses ya existente) |

### 8.2 `writeContract` con un id de PrintLog

**No existe.** `Printer.print(student, pages)` se invoca con `userAddress` y `BigInt(pages)`, no con un id de log preexistente. Cada impresión es una tx nueva, los logs históricos no se "re-imprimen". **Sin guards adicionales.**

### 8.3 Componentes UI relevantes

- [`components/printing/PrintingHomeView.tsx`](packages/nextjs/src/components/printing/PrintingHomeView.tsx) — simulador de impresión, no muestra logs. Sin cambios.
- [`components/printing/PrintingHistoryView.tsx`](packages/nextjs/src/components/printing/PrintingHistoryView.tsx) — historial paginado. **Pinta filas** que pueden ser históricas. Aceptar prop opcional `historical` por fila y pintar badge gris. El campo `txHash` está en el tipo pero **no se renderiza** actualmente — sin cambios visuales necesarios.
- [`components/printing/PrintingDetailView.tsx`](packages/nextjs/src/components/printing/PrintingDetailView.tsx) — detalle de un log. Si decides pintar `txHash` en algún momento, render condicional. Por ahora sin cambios.

---

## 9. Helper nuevo: `lib/historical.ts`

Para no repetir el guard en cada acción y para aislarlo si se decide cambiar el comportamiento (p.ej. devolver un error tipado en lugar de un `Error` genérico), crear:

**Archivo nuevo:** [`packages/nextjs/src/lib/historical.ts`](packages/nextjs/src/lib/historical.ts)

```ts
/**
 * historical.ts — Helpers para entidades con flag `historical`.
 *
 * Los registros históricos viven solo en Prisma (no tienen contraparte on-chain).
 * Cualquier acción que vaya a llamar a un contrato debe pasarlos por estos
 * guards para fallar pronto y con un mensaje claro.
 */

interface HistoricalEntity {
  historical?: boolean;
}

/** Revierte si la entidad es histórica. Usar antes de cualquier writeContract/readContract. */
export function ensureNotHistorical(
  entity: HistoricalEntity | null | undefined,
  entityName = "Registro",
): void {
  if (!entity) return;
  if (entity.historical) {
    throw new Error(
      `${entityName} histórico (sin firma on-chain). Esta acción no está disponible.`,
    );
  }
}

/**
 * Revierte si la entidad es histórica O si su id on-chain es null.
 * Más estricto que `ensureNotHistorical` — útil cuando vas a usar el id como argumento.
 */
export function ensureOnChainId<T extends { historical?: boolean }>(
  entity: T | null | undefined,
  idField: keyof T,
  entityName = "Registro",
): asserts entity is T & Record<typeof idField, NonNullable<T[typeof idField]>> {
  if (!entity) {
    throw new Error(`${entityName} no encontrado`);
  }
  if (entity.historical) {
    throw new Error(
      `${entityName} histórico (sin firma on-chain). Esta acción no está disponible.`,
    );
  }
  if (entity[idField] === null || entity[idField] === undefined) {
    throw new Error(
      `${entityName} sin id on-chain. Esta acción no está disponible.`,
    );
  }
}

/** Filtro de Prisma reutilizable. */
export const ONLY_LIVE = { historical: false } as const;
```

Usarlo en cada operación:

```ts
import { ensureOnChainId, ONLY_LIVE } from "@/lib/historical";

const loan = await prisma.loan.findUnique({
  where: { id: loanId, ...ONLY_LIVE },
});
ensureOnChainId(loan, "loanId", "Préstamo");
// a partir de aquí TS sabe que loan.loanId es number (no null)
await wallet.writeContract({ ..., args: [BigInt(loan.loanId)] });
```

> **Nota:** `findUnique` con `where` extendido no funciona si la clave única es solo `id`. Usa `findFirst({ where: { id, historical: false } })` cuando el filtro es necesario, o haz `findUnique({ where: { id } })` y luego comprueba con el helper. Recomendación: **`findUnique` para cargar + `ensureOnChainId` después**, mucho más limpio que cambiar todos los `findUnique` a `findFirst`.

---

## 10. Cambios en componentes UI

### 10.1 Componente nuevo `<HistoricalBadge />`

**Archivo:** [`packages/nextjs/src/components/shared/HistoricalBadge.tsx`](packages/nextjs/src/components/shared/HistoricalBadge.tsx)

```tsx
import { Badge } from "@/components/ui/Badge";

export function HistoricalBadge() {
  return (
    <Badge variant="neutral" title="Registro previo a la integración blockchain. No tiene firma on-chain.">
      Histórico
    </Badge>
  );
}
```

Exportar desde [`components/shared/index.ts`](packages/nextjs/src/components/shared/index.ts).

### 10.2 Banner reutilizable en detalles

Reutilizar `<AlertCalloutCard>` (ya existente) con variant `info`:

```tsx
{order.historical && (
  <AlertCalloutCard variant="info" icon={icons.info} title="Pedido histórico">
    Este registro es anterior a la integración blockchain. No tiene firma on-chain
    y no admite acciones (entrega, devolución).
  </AlertCalloutCard>
)}
```

### 10.3 Lista cerrada de archivos UI a tocar

| Archivo | Cambio |
|---|---|
| `components/shared/LoanCard.tsx` | Aceptar `historical?: boolean`, pintar `<HistoricalBadge />` |
| `components/shared/BookingCard.tsx` | idem |
| `components/printing/PrintingHistoryView.tsx` | Por fila, badge si `log.historical` |
| `components/shared/BatchHeader.tsx` | Badge si `batch.historical`. `batchId` con render condicional |
| `components/dashboard/OrderBatchTable.tsx` | Render condicional de `txHash` y `batchId` |
| `components/dashboard/OrderItemTable.tsx` | idem para Order |
| `components/dashboard/OrderBatchDetailView.tsx` | Banner `<AlertCalloutCard>` si `historical` |
| `app/(main)/student/shop/orders/[id]/page.tsx` | Deshabilitar botón "Solicitar devolución" si histórico |
| `app/(main)/admin/shop/orders/[id]/page.tsx` | Deshabilitar "Marcar entregado" / "Procesar devolución" si histórico |
| Footer en cards de gráficas (`DashboardBarChart`, `DashboardPieChart`) | Texto pequeño "Incluye datos históricos previos a la integración blockchain" — solo en gráficas que usan agregados (no en stats vivas) |

---

## 11. Cambios obligatorios en `db-doctor`

Archivo: [`packages/nextjs/scripts/db-doctor.mjs`](packages/nextjs/scripts/db-doctor.mjs).

`db-doctor` compara `nextXId` on-chain con `count(Prisma)`. Sin cambios, **falsamente reportará drift** porque las filas históricas no tienen `loanId`/`orderId`/`bookingId`/`batchId` y no se pueden buscar en el contrato.

### 11.1 Cambios en cada chequeo

```js
// ANTES (línea ~117 aprox):
const prismaCount = await prisma[entity.model].count();

// DESPUÉS:
const prismaCount = await prisma[entity.model].count({
  where: { [entity.idField]: { not: null } },  // solo filas con contraparte on-chain
});
```

```js
// ANTES (línea ~131-136 aprox):
const orphans = await prisma[entity.model].findMany({
  where: { [entity.idField]: { gt: onChainCount } },
  select: { id: true, [entity.idField]: true },
});

// DESPUÉS:
const orphans = await prisma[entity.model].findMany({
  where: {
    [entity.idField]: { gt: onChainCount },
    historical: false,
  },
  select: { id: true, [entity.idField]: true },
});
```

### 11.2 Reporte adicional

Añadir línea informativa al final de cada entidad:

```js
const historicalCount = await prisma[entity.model].count({ where: { historical: true } });
if (historicalCount > 0) {
  log(cyan(`  ${entity.label}: ${historicalCount} registro(s) histórico(s) (solo Prisma, esperado).`));
}
```

Esto deja claro al lector que las filas extra no son drift, son históricas.

### 11.3 Verificación de los 5 modelos

Confirmar que `entity.model` cubre los 5: `loan`, `order`, `orderBatch`, `roomBooking`. **`PrintLog` no lo cubre `db-doctor` actualmente** (no tiene id on-chain) — sin cambios para PrintLog.

---

## 12. Edge case: bonus de primer uso

Definido en [`lib/shopRewards.ts:27-36`](packages/nextjs/src/lib/shopRewards.ts#L27):

```ts
export async function hasRewardOfType(userId, reason): Promise<boolean> {
  const existing = await prisma.shopTokenReward.findFirst({
    where: { userId, reason },
    ...
  });
  return existing !== null;
}
```

`MODULE_FIRST_USE_LIBRARY`, `MODULE_FIRST_USE_SHOP`, etc. se otorgan solo si **no existe ningún `ShopTokenReward`** con ese `reason` para el usuario.

### 12.1 Decisión: NO crear `ShopTokenReward` en `seed-historical.mjs`

Esto preserva intacto el bonus de primer uso. El usuario hace su primera acción real (un préstamo, una compra, etc.) y recibe los 2 SHPT del bonus aunque ya tenga 10 préstamos históricos.

**Justificación:**
1. Es coherente con la narrativa: el usuario "estrena" el sistema on-chain con su primera acción real.
2. Los `ShopTokenReward` son un ledger del minteo on-chain de SHPT. Crearlos sin contrapartida real corrompe la auditoría del balance.
3. Simplifica el seed (no hace falta variar reasons, no hay que minetar SHPT al admin como contrapartida, etc.).

### 12.2 Implicación visible para el usuario

En el dashboard del estudiante puede aparecer:
- "10 préstamos completados" (de los históricos).
- Toast `"+2 SHPT por tu primer préstamo"` cuando hace el primer real.

Es una incoherencia narrativa menor pero **NO es un bug funcional**. Documentar en una nota visible al estudiante (opcional) o ignorar.

### 12.3 Verificación

Tras seed-historical, antes del primer login real del estudiante:

```sql
SELECT COUNT(*) FROM "ShopTokenReward" WHERE "userId" = '<student-id>';
-- Debe ser 0
```

Tras la primera acción real: count > 0 con el reason de primer uso del módulo correspondiente.

---

## 13. Nuevo seed: `seed-historical.mjs`

**Archivo nuevo:** [`packages/nextjs/scripts/seed-historical.mjs`](packages/nextjs/scripts/seed-historical.mjs)

### 13.1 Cantidades objetivo

Por estudiante (con ~10-13 STUDENTs que crea `seed-academic.mjs`):

| Tipo | Min | Max | Total esperado |
|---|---|---|---|
| Préstamos `RETURNED` (`Loan`) | 5 | 15 | 50-200 |
| Reservas pasadas (`RoomBooking`, fecha < hoy) | 3 | 10 | 30-130 |
| Trabajos de impresión (`PrintLog`) | 10 | 30 | 100-400 |
| Pedidos (`OrderBatch` + 1-4 `Order` cada uno, status `DELIVERED`) | 2 | 6 batches | 20-80 batches |

**Distribución temporal:** uniforme entre `hoy - 12 meses` y `hoy - 1 mes`. Los seeds NO crean datos del último mes — esa franja es para actividad real.

**Distribución de productos/items:** Pareto (top 20% items reciben 60% de los préstamos) para que las gráficas "top X" tengan forma realista.

### 13.2 Estructura

```js
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import prismaClientPkg from "@prisma/client";
const { PrismaClient } = prismaClientPkg;
import { PrismaPg } from "@prisma/adapter-pg";

// — Carga manual de .env (igual que seed-academic.mjs) ——————————————
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
const envContent = readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envContent.split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim().replace(/^"|"$/g, "")))
);

// — Helpers de logging ——————————————————————————————————————
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const log = (msg) => console.log(`${cyan("[seed-historical]")} ${msg}`);

// — Targets ——————————————————————————————————————————————
const LOANS_PER_STUDENT = 10;
const BOOKINGS_PER_STUDENT = 6;
const PRINTS_PER_STUDENT = 20;
const ORDER_BATCHES_PER_STUDENT = 4;

// — Helpers de fecha y random ————————————————————————————————
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickPareto(arr, alpha = 1.16) { /* simula Pareto sobre el array */
  const u = Math.random();
  const idx = Math.floor(arr.length * (1 - Math.pow(u, 1 / alpha)));
  return arr[Math.min(idx, arr.length - 1)];
}
function randomDateInRange(monthsAgoMax, monthsAgoMin) {
  const now = new Date();
  const start = new Date(now); start.setMonth(start.getMonth() - monthsAgoMax);
  const end = new Date(now);   end.setMonth(end.getMonth() - monthsAgoMin);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function addDaysRandom(date, minDays, maxDays) {
  return addDays(date, minDays + Math.floor(Math.random() * (maxDays - minDays + 1)));
}

// — Generadores por dominio ————————————————————————————————
async function seedHistoricalLoans(prisma, students, items, count) {
  log(yellow(`Generando ${count} préstamos históricos...`));
  const data = [];
  for (let i = 0; i < count; i++) {
    const student = pickRandom(students);
    const item = pickPareto(items);
    const requestDate = randomDateInRange(12, 1);
    const reservationDate = requestDate;
    const pickupDate = addDaysRandom(requestDate, 1, 3);
    const dueDate = addDays(pickupDate, 14);
    const returnDate = addDaysRandom(pickupDate, 5, 14);
    const overdue = returnDate > dueDate;
    data.push({
      loanId: null,                            // sin contraparte on-chain
      libraryItemId: item.id,
      userId: student.id,
      status: "RETURNED",
      requestDate, reservationDate, pickupDate, dueDate, returnDate, overdue,
      historical: true,
    });
  }
  await prisma.loan.createMany({ data });
  log(green(`  ✓ ${data.length} préstamos históricos creados`));
}

async function seedHistoricalBookings(prisma, students, rooms, count) {
  // Cuidado: una reserva por usuario por día; evitamos colisiones con seed-academic.
  // Como las fechas son pasadas y aleatorias, la prob de duplicado userId+date es baja,
  // pero hacemos createMany con skipDuplicates:false y catcheamos por seguridad.
  log(yellow(`Generando ${count} reservas históricas...`));
  // ... lógica con fechas en pasado, duración 1-4h, startHour 8-20
}

async function seedHistoricalPrints(prisma, students, printers, count) {
  log(yellow(`Generando ${count} trabajos de impresión históricos...`));
  // ... pages 1-50, copies 1-3, color/duplex/paperSize aleatorios, creditsUsed = pages*copies
}

async function seedHistoricalOrders(prisma, students, products, batchCount) {
  log(yellow(`Generando ~${batchCount} batches históricos con sus orders...`));
  // ... cada batch con 1-4 productos, status DELIVERED, fechas distribuidas
  // OrderBatch.batchId = null, Order.orderId = null, txHash = null en ambos
  // historical: true en ambos
}

// — Main ——————————————————————————————————————————————
async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

  // 1. Idempotencia: ¿ya hay datos históricos al target?
  const [hLoans, hBookings, hPrints, hBatches] = await Promise.all([
    prisma.loan.count({ where: { historical: true } }),
    prisma.roomBooking.count({ where: { historical: true } }),
    prisma.printLog.count({ where: { historical: true } }),
    prisma.orderBatch.count({ where: { historical: true } }),
  ]);

  // 2. Cargar entidades base
  const [students, items, rooms, printers, products] = await Promise.all([
    prisma.user.findMany({ where: { role: "STUDENT", active: true } }),
    prisma.libraryItem.findMany({ where: { active: true } }),
    prisma.room.findMany({ where: { active: true } }),
    prisma.printer.findMany({ where: { active: true } }),
    prisma.product.findMany({ where: { active: true } }),
  ]);

  // 3. Validar pre-requisitos
  if (students.length === 0) {
    log(red(`✗ No hay STUDENTs en la BD. Ejecuta "pnpm db:seed:academic" primero.`));
    process.exit(1);
  }
  if (items.length === 0 || products.length === 0 || rooms.length === 0 || printers.length === 0) {
    log(red(`✗ Faltan items/products/rooms/printers. Ejecuta los seeds previos.`));
    process.exit(1);
  }

  // 4. Calcular targets y delegar a generadores idempotentes
  const targetLoans = students.length * LOANS_PER_STUDENT;
  if (hLoans >= targetLoans) {
    log(green(`✓ Préstamos históricos ya al target (${hLoans}/${targetLoans}). Saltando.`));
  } else {
    await seedHistoricalLoans(prisma, students, items, targetLoans - hLoans);
  }
  // ... idem para bookings, prints, orders

  await prisma.$disconnect();
  log(green(`✓ Seed histórico completado.`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### 13.3 Idempotencia

- Cuenta lo existente por `historical: true` antes de generar.
- Si ya está al target, salta (no falla).
- Si está por debajo, genera **solo la diferencia** (`target - existing`).
- En segunda corrida del seed → 0 inserts.

### 13.4 Variabilidad

- **Items prestados / productos comprados:** distribución Pareto (`pickPareto`) para que algunos sean populares y otros raros. Las gráficas "top 5 más prestados" tendrán forma realista en lugar de plana.
- **Páginas impresas:** distribución log-normal (`Math.exp(2 + Math.random() * 1.5)` clamp a 1-50) para que la mayoría sean trabajos pequeños y haya algunos grandes.
- **Color/dúplex:** 60% B&N / 40% color, 70% dúplex / 30% simple — mete diversidad en gráficas de tipo de impresión.
- **Capacidad de salas:** respetar `room.capacity`. **No reservar sobre fechas futuras** (filtrar `randomDateInRange(12, 1)` siempre devuelve pasado). **Evitar duplicados** mismo userId+date+startHour en un set en memoria antes de insertar.

### 13.5 Order vs OrderBatch

Cada batch genera 1-4 orders. Estructura:

```js
const batch = await prisma.orderBatch.create({
  data: {
    batchId: null,
    userId: student.id,
    totalPaid: sum,
    generalStatus: "DELIVERED",
    txHash: null,
    purchaseDate,
    historical: true,
  },
});
for (const product of pickedProducts) {
  await prisma.order.create({
    data: {
      orderId: null,
      batchId: batch.id,             // FK Prisma, NO el batchId on-chain
      userId: student.id,
      productId: product.id,
      pricePaid: product.price,
      status: "DELIVERED",
      txHash: null,
      purchaseDate,
      deliveryDate: addDaysRandom(purchaseDate, 1, 3),
      historical: true,
    },
  });
}
```

### 13.6 Fechas relativas a "hoy"

Importante: el seed se ejecuta cada vez que `pnpm dev:new` (con un "hoy" distinto). **No hardcodear fechas** — siempre relativas a `new Date()`. Así la franja "últimos 6 meses" siempre estará poblada, sea cual sea el día del demo.

Si querer fijar las gráficas en una franja estática (e.g. demos reproducibles), se puede aceptar `process.env.HISTORICAL_REFERENCE_DATE` como override. Fuera de scope inicial.

---

## 14. Integración: `seed.mjs`, `dev.mjs`, `package.json`

### 14.1 `scripts/seed.mjs`

Insertar entrada en el array de seeds entre `seed-printers` y `cleanup-uploads`:

```js
// scripts/seed.mjs (línea ~68 actual)
const seeds = [
  { name: "admin",      file: "packages/nextjs/scripts/seed-admin.mjs",       label: "Admin" },
  { name: "librarian",  file: "packages/nextjs/scripts/seed-librarian.mjs",   label: "Bibliotecario" },
  { name: "academic",   file: "packages/nextjs/scripts/seed-academic.mjs",    label: "Datos académicos" },
  { name: "products",   file: "packages/nextjs/scripts/seed-products.mjs",    label: "Productos" },
  { name: "badges",     file: "packages/nextjs/scripts/seed-badges.mjs",      label: "Insignias" },
  { name: "library",    file: "packages/nextjs/scripts/seed-library.mjs",     label: "Biblioteca" },
  { name: "rooms",      file: "packages/nextjs/scripts/seed-rooms.mjs",       label: "Salas" },
  { name: "printers",   file: "packages/nextjs/scripts/seed-printers.mjs",    label: "Impresoras" },
  { name: "historical", file: "packages/nextjs/scripts/seed-historical.mjs",  label: "Históricos (solo Prisma)" }, // ← NUEVO
  { name: "cleanup",    file: "packages/nextjs/scripts/cleanup-uploads.mjs",  label: "Cleanup" },
];
```

### 14.2 `scripts/dev.mjs`

`scripts/dev.mjs` invoca `scripts/seed.mjs` con `--new`. **No requiere cambios.**

`ensureDatabaseSchema` (línea ~270) ejecuta `pnpm db:push` que aplicará los nuevos campos automáticamente. Sin cambios.

### 14.3 `package.json` (raíz)

Añadir bajo los demás `db:seed:*`:

```json
"db:seed:historical": "node packages/nextjs/scripts/seed-historical.mjs",
```

### 14.4 README.md

Añadir bajo "Comandos disponibles → Base de datos":

```md
| `pnpm db:seed:historical` | Genera datos históricos solo-Prisma para gráficas (idempotente) |
```

---

## 15. Migración Prisma

El proyecto usa migraciones formales — existen 3 en [`packages/nextjs/prisma/migrations/`](packages/nextjs/prisma/migrations/):

```
20260304224214_init/
20260305171229_auth_model/
20260309205104_full_schema/
migration_lock.toml
```

### 15.1 Crear nueva migración

```bash
cd packages/nextjs
pnpm prisma migrate dev --name historical_data_flag
```

Esto:
1. Detecta los cambios sobre el schema (5 campos nuevos `historical`, 5 campos pasados a nullable, varios `txHash` a nullable, índices nuevos).
2. Genera un SQL `ALTER TABLE` en `prisma/migrations/<timestamp>_historical_data_flag/migration.sql`.
3. Lo aplica a la BD local.
4. Regenera el Prisma Client.

### 15.2 Operaciones SQL esperadas

```sql
-- Pseudo-resumen del migration.sql que generará Prisma
ALTER TABLE "Loan"        ALTER COLUMN "loanId"     DROP NOT NULL,
                          ADD COLUMN  "historical" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "OrderBatch"  ALTER COLUMN "batchId"    DROP NOT NULL,
                          ALTER COLUMN "txHash"     DROP NOT NULL,
                          ADD COLUMN  "historical" BOOLEAN NOT NULL DEFAULT FALSE;
-- ... idem para Order, RoomBooking, PrintLog
CREATE INDEX "Loan_userId_historical_idx"      ON "Loan" ("userId", "historical");
-- ... más índices
```

### 15.3 Compatibilidad con datos existentes

- `historical` arranca con `false` para todas las filas existentes (default), no rompe nada.
- Hacer `loanId` nullable es **no destructivo** (PostgreSQL: relajar `NOT NULL` siempre es safe).
- La unicidad sigue funcionando con NULL: `Int? @unique` en Prisma → `CREATE UNIQUE INDEX ... WHERE "loanId" IS NOT NULL` (Postgres: `NULL ≠ NULL` en índices únicos).

### 15.4 Aplicar en otros entornos

Para cualquier desarrollador del equipo:

```bash
git pull
pnpm install
pnpm prisma migrate deploy   # aplica migraciones nuevas sin recrear
# o, si quieres limpio:
pnpm dev:new                 # resetea + reaplica todo + reseed
```

---

## 16. Orden de implementación

Tiempos estimados optimistas. Implementar en este orden secuencial; cada paso es independientemente probable.

| # | Paso | Archivos | Tiempo |
|---|---|---|---|
| 1 | Schema + migración | `prisma/schema.prisma` | 15 min |
| 2 | Helper `lib/historical.ts` + `<HistoricalBadge>` + barrel | 3 archivos nuevos | 15 min |
| 3 | Filtros y guards en `actions/library.ts` | 1 archivo, ~14 cambios | 30 min |
| 4 | Filtros y guards en `actions/shop.ts` | 1 archivo, ~24 cambios | 45 min |
| 5 | Filtros y guards en `actions/rooms.ts` | 1 archivo, ~7 cambios | 20 min |
| 6 | Verificar `actions/printing.ts` (sin guards, solo verificar) | 1 archivo | 5 min |
| 7 | UI: render condicional en componentes y pages | ~10 archivos | 45 min |
| 8 | Ajustes en `db-doctor.mjs` | 1 archivo | 15 min |
| 9 | Crear `seed-historical.mjs` | 1 archivo nuevo | 60 min |
| 10 | Integración: `seed.mjs`, `package.json`, `README.md` | 3 archivos | 10 min |
| 11 | Verificación end-to-end (§17) | — | 30 min |

**Total estimado:** ~4h 30min reales (con las inevitables correcciones).

---

## 17. Plan de verificación

### 17.1 Checklist post-schema

- [ ] `pnpm prisma migrate dev --name historical_data_flag` corre sin errores.
- [ ] `pnpm prisma generate` regenera el cliente con los nuevos tipos.
- [ ] TS compila sin errores nuevos: `pnpm --filter nextjs run lint && pnpm --filter nextjs run build`.
- [ ] Las queries existentes (sin filtro nuevo) siguen funcionando porque las filas existentes tienen `historical: false`.

### 17.2 Checklist post-seed

- [ ] `pnpm db:reset && pnpm dev:new` arranca con seeds OK (uno más = 10/10 ó 11/11).
- [ ] Segunda corrida `pnpm db:seed` → log "Ya al target, saltando" para los 4 generadores.
- [ ] `SELECT COUNT(*) FROM "Loan" WHERE historical = true;` ≥ 50.
- [ ] `SELECT COUNT(*) FROM "ShopTokenReward";` = 0 inicialmente (ningún reward histórico).
- [ ] `pnpm db:doctor` reporta drift = 0 y "N registros históricos (esperado)" para Loan, Order, OrderBatch, RoomBooking.

### 17.3 Checklist funcional por rol

**Estudiante:**
- [ ] Login → `/student` → `printsByMonth` chart muestra 6 meses con datos.
- [ ] `/student/library` (mis préstamos): activos arriba (vacío inicial), históricos abajo con badge gris.
- [ ] `/student/library/printing/history`: lista paginada con badges en filas históricas.
- [ ] `/student/shop/orders`: pedidos históricos con badge en columna de batch.
- [ ] `/student/library/rooms`: mis reservas históricas marcadas.
- [ ] Click en pedido histórico → detalle: banner "Pedido histórico, no admite acciones", botón devolver deshabilitado.
- [ ] Hacer una acción real (un préstamo) → toast `+2 SHPT (primer uso)`, fila aparece sin badge histórico.

**Librarian:**
- [ ] `/librarian` → `loansByMonth` y `itemsByType` con datos.
- [ ] `/librarian/loans/pickups`, `/librarian/loans/returns`: NO aparecen históricos.
- [ ] Top items prestados: incluye históricos.

**Admin:**
- [ ] `/admin` → todas las gráficas con datos.
- [ ] `/admin/library/loans`: filtros operativos no muestran históricos.
- [ ] `/admin/shop/orders`: filtros operativos no muestran históricos. Filtro "Todos" sí los muestra.
- [ ] Detalle de pedido histórico: botones de admin deshabilitados con tooltip.

**Profesor:**
- [ ] `/professor` → gráficas (assignmentsByMonth, awardsByMonth) — fuera de scope, deben funcionar igual sin cambios.

### 17.4 Checklist de no-regresión

- [ ] Las acciones reales siguen creando filas con `historical: false`:
  - Pedir préstamo (`requestLoan`)
  - Comprar (`purchase`, `purchaseFromCart`)
  - Reservar sala (`bookRoom`)
  - Imprimir (`executePrinterJob`)
- [ ] Las queries de "préstamos activos AHORA" en banner del dashboard no incluyen históricos (deben todos estar `RETURNED`).
- [ ] Bonus de primer uso: `MODULE_FIRST_USE_*` se otorgan en la primera acción real aunque el usuario tenga históricos.
- [ ] `db:doctor` no muestra drift falso.

### 17.5 Pruebas de regresión por error explícito

- [ ] Manualmente forzar request a `/api/library/loans/[id]/cancel` con un loanId histórico → respuesta 4xx con mensaje "Préstamo histórico (sin firma on-chain). Esta acción no está disponible".
- [ ] Idem para `markOrderDelivered`, `processReturn`, `requestReturn`, `cancelBooking`.

---

## 18. Riesgos y mitigaciones

### 18.1 Lecturas on-chain con id null

Cualquier `readContract` con `loan.loanId` u homólogo va a romper si recibe null. **Mitigación:** helper `ensureOnChainId` lanza `Error` antes de la llamada con mensaje claro. Aplicado en TODO writeContract listado en §5/§6/§7.

### 18.2 Componentes UI con `<a href={`/etherscan/${txHash}`}>`

Buscar uso de `txHash` en JSX antes de implementar:

```bash
rg "txHash" packages/nextjs/src/components/ packages/nextjs/src/app/ -t tsx
```

Aplicar render condicional en cada caso. Inventario inicial en §6.3 / §10.3.

### 18.3 Contadores `nextLoanId/nextOrderId` empiezan en 1

Los registros históricos NO consumen IDs on-chain. El primer préstamo real seguirá siendo `loanId = 1`. Esto es **correcto y deseado**, pero documentar en CLAUDE.md / TFG-DOCUMENTACION-TECNICA.md para no confundir.

> *Nota:* "ID 1 on-chain ≠ primera fila en la tabla `Loan` (porque las históricas son anteriores)".

### 18.4 FK a entidades del catálogo

Productos / libros / salas / impresoras referenciados en históricos tienen que existir. Garantizado por el orden del `seed.mjs`: catálogo va antes que histórico.

Si en el futuro se desactiva un producto (`active: false`), las orders históricas que lo referencian siguen siendo válidas en BD (la FK no se rompe). Aceptable.

### 18.5 Múltiples reservas el mismo día (anti-solape)

`bookRoom` filtra por `userId + date + cancelled: false`. Si por random un seed crea 2 reservas mismo userId+date, la segunda inserción no falla (Prisma no aplica la unicidad lógica de "1 al día"). **Mitigación:** en el generador de bookings, mantener un `Set` de `userId+date` ya generados y skipping.

### 18.6 La cadena no avanza

Si un alumno solo tiene actividad histórica y nunca interactúa, todo lo que ve es "histórico". UX pobre pero coherente. Mitigación implícita: el alumno demo va a probar la app, generando actividad real.

### 18.7 Conflicto con migraciones existentes

Si alguien tiene la BD ya con datos reales (no históricos) y quiere aplicar la migración:
- `historical` se añade con default `false` → todas las filas reales conservan estado correcto.
- `loanId` pasa a nullable → no afecta filas existentes.
- `txHash` pasa a nullable → no afecta filas existentes.

**Compatibilidad total con BDs ya pobladas.** No hay backfill necesario.

### 18.8 Performance del seed

Crear ~500-700 filas con `prisma.X.create` individuales puede tardar. **Mitigación:** usar `createMany({ data: [...], skipDuplicates: false })` para Loan y PrintLog. Para Order/OrderBatch hay que crear el batch primero y luego sus orders, así que no se puede usar `createMany` en bloque — pero se pueden crear los batches en una transacción.

```js
await prisma.$transaction(
  batches.map((b) => prisma.orderBatch.create({ data: b, include: { orders: { create: b.orders }}}))
);
```

### 18.9 Concurrencia con `dev.mjs`

`dev.mjs` arranca la chain antes que el seed-historical. Como el seed no toca blockchain, no hay problema de concurrencia.

---

## 19. Fuera de scope

- **Auditoría on-chain del histórico:** comprometer un Merkle root de los datos históricos en un contrato `HistoricalAttestation.sol`. Da prueba criptográfica de que el set existió en una fecha. No relevante para TFG.
- **Importador real de datos legacy:** si en producción hubiera un sistema legacy que importar, sería un script con audit log y revisión humana, no este seed.
- **Filtros UI avanzados:** switches "Mostrar solo histórico" / "Solo on-chain" en listados. Solo si la UX lo pide.
- **Edición o borrado de históricos:** son inmutables. Para corregir, regenerar todo con `pnpm dev:new`.
- **Insignias / BadgeAward históricos:** dashboard del profesor pinta `assignmentsByMonth`/`awardsByMonth` que también saldrían pobres. Replicar el patrón si una iteración futura lo requiere.
- **TaskSubmission históricos:** afectaría la métrica "top assignments by submissions". Si una iteración futura lo necesita, replicar.
- **`ShopTokenReward` históricos:** rotos por construcción (ver §12). Si quisiera incluirse, requiere cambiar la lógica de "primer uso" a una flag dedicada en `User` o un timestamp `firstActionAt` por módulo.
- **Variar el `referenceDate`** vía env var para demos reproducibles con fechas fijas.

---

## 20. TL;DR

| # | Cambio | Archivo principal |
|---|---|---|
| 1 | 5 modelos: `historical Boolean @default(false)` + IDs/txHash nullable + índices | `schema.prisma` |
| 2 | Helper `ensureOnChainId` + `ONLY_LIVE` filter + `<HistoricalBadge>` | `lib/historical.ts`, `components/shared/HistoricalBadge.tsx` |
| 3 | 14 filtros/guards en `actions/library.ts` | `actions/library.ts` |
| 4 | 24 filtros/guards en `actions/shop.ts` | `actions/shop.ts` |
| 5 | 7 filtros/guards en `actions/rooms.ts` | `actions/rooms.ts` |
| 6 | `actions/printing.ts` no requiere guards (no usa idField on-chain) | (verificar) |
| 7 | Render condicional de `txHash`/`batchId`/`orderId` en ~10 componentes/páginas | varios |
| 8 | `db-doctor.mjs`: count con `{idField: not null}` + skip históricos en orphan search | `scripts/db-doctor.mjs` |
| 9 | NO crear `ShopTokenReward` para históricos (preserva bonus de primer uso) | `seed-historical.mjs` |
| 10 | Nuevo `seed-historical.mjs` idempotente con cantidades variadas y fechas Pareto | `packages/nextjs/scripts/seed-historical.mjs` |
| 11 | Integrar en `seed.mjs` (línea ~68) + `package.json` + README | varios |
| 12 | Migración `historical_data_flag` con `prisma migrate dev` | `prisma/migrations/` |

**Tiempo total estimado:** ~4h 30min de trabajo real.

**Riesgos principales:**
1. Olvidar un `writeContract` con id (mitigación: `ensureOnChainId` helper centralizado).
2. UI mostrando `txHash` sin null check (mitigación: rg sweep + render condicional).
3. `db-doctor` reportando drift falso (mitigación: filtros explícitos en queries).
4. Bonus de primer uso desincronizado (mitigación: NO crear `ShopTokenReward` históricos).
