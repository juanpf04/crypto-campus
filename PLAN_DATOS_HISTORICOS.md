# Plan — Datos históricos solo-Prisma para estadísticas

> **Estado:** pendiente de implementar. Este documento es la guía completa para retomarlo en otra sesión.
>
> **Decisión tomada:** opción A (flag `historical` explícito en los modelos relevantes + seed dedicado + filtros en server actions + marcador visible en UI).

---

## 1. Contexto y motivación

CryptoCampus se vende como _custodial dApp_ donde la blockchain es la **capa de confianza** para préstamos, pedidos, impresiones y reservas. El modelo actual (ver [CLAUDE.md](CLAUDE.md#data-split-blockchain-vs-prisma)):

- **On-chain** → estado auditable (`loanId`, `orderId`, `bookingId`, `txHash`, etc.).
- **Prisma** → metadatos human-readable (nombres, descripciones, imágenes).

Cada acción de usuario hoy emite una transacción y persiste el resultado con su `txHash`.

**Problema:** las gráficas y dashboards (panel de admin, panel de profesor, panel de estudiante) salen vacías o con muy pocos datos en una instalación recién seedeada. Generar miles de tx demo on-chain en cada `dev:fresh` sería:

- Lento (segundos/minutos extra al bootstrap).
- Caro conceptualmente (gas, storage on-chain) para datos que solo sirven para "rellenar gráficas".
- Innecesario: nadie va a auditar préstamos del 2024 en una demo de TFG.

**Solución elegida:** datos históricos viven solo en Prisma, marcados con un flag `historical: Boolean`. Cuentan en estadísticas pero no se pueden tocar (no tienen contrapartida on-chain).

**No es un smell de diseño en este contexto** porque:

1. Es un proyecto académico, no producción.
2. El flag deja claro qué es real (con respaldo on-chain) y qué es histórico (solo para gráficas).
3. Se documenta en UI cuando aplica ("incluye datos previos a la integración blockchain").
4. Los flujos accionables (cancelar, devolver, marcar como entregado, etc.) excluyen lo histórico, así que no hay riesgo de manipulación o estados inconsistentes.

---

## 2. Modelos afectados

Los modelos que tienen contraparte on-chain y queremos llenar con historia falsa para gráficas:

| Modelo (Prisma) | Contrato | Campo on-chain | Tabla |
|---|---|---|---|
| `Loan` | LibraryManager | `loanId` | [schema.prisma:297](packages/nextjs/prisma/schema.prisma#L297) |
| `OrderBatch` | CampusShop | `batchId` | [schema.prisma:446](packages/nextjs/prisma/schema.prisma#L446) |
| `Order` | CampusShop | `orderId` | [schema.prisma:461](packages/nextjs/prisma/schema.prisma#L461) |
| `PrintLog` | (no contrato propio, paga con créditos) | `txHash` | [schema.prisma:368](packages/nextjs/prisma/schema.prisma#L368) |
| `RoomBooking` | RoomBooking | `bookingId` | [schema.prisma:336](packages/nextjs/prisma/schema.prisma#L336) |

**No se tocan:**

- `BadgeAward`, `Reward`, `RewardRedemption`, `UseRequest`, `TaskSubmission`, etc. → la mecánica de insignias/recompensas tiene poco sentido histórico (un alumno no tiene "premios viejos canjeados", o sí pero es marginal). Se puede añadir más adelante si una gráfica concreta lo pide.
- `Subject`, `SubjectOffering`, `Enrollment`, `Product`, etc. → son catálogo, no historial.

---

## 3. Cambios al schema (`packages/nextjs/prisma/schema.prisma`)

### 3.1. Hacer nullable los IDs y txHashes on-chain

Hoy son `Int @unique` o `String` no-null. Para registros históricos no hay contraparte, así que pasan a opcionales. La unicidad sigue funcionando con NULL en Postgres (NULL ≠ NULL).

```prisma
model Loan {
  loanId           Int?       @unique  // antes: Int @unique
  // ... resto igual
  historical       Boolean    @default(false)  // ← nuevo

  @@index([userId, historical])
}

model OrderBatch {
  batchId      Int?     @unique  // antes: Int @unique
  txHash       String?           // antes: String (no-null)
  // ...
  historical   Boolean  @default(false)  // ← nuevo

  @@index([userId, historical])
}

model Order {
  orderId      Int?        @unique  // antes: Int @unique
  txHash       String?              // antes: String (no-null)
  // ...
  historical   Boolean     @default(false)  // ← nuevo

  @@index([userId, historical])
}

model PrintLog {
  txHash       String?              // antes: String (no-null)
  // ...
  historical   Boolean  @default(false)  // ← nuevo

  @@index([userId, historical])
}

model RoomBooking {
  bookingId   Int?     @unique  // antes: Int @unique
  txHash      String?           // antes: String (no-null)
  // ...
  historical  Boolean  @default(false)  // ← nuevo

  @@index([userId, historical])
}
```

> **Cuidado:** este cambio es destructivo solo si alguna fila existente tiene `loanId = NULL` (imposible hoy) o si dropea la columna `txHash` (no la dropea, solo la hace nullable). `prisma db push` debería aceptarlo sin pérdida de datos. Pero conviene hacerlo con `pnpm db:reset` en el siguiente `dev:fresh` para empezar limpio.

### 3.2. Después de tocar el schema

```bash
pnpm db:generate    # regenera Prisma Client con los nuevos campos
pnpm db:push        # aplica al Postgres en dev (o pnpm db:reset si prefieres limpio)
```

---

## 4. Reglas de filtrado en server actions

### 4.1. Listados accionables (admin/librarian/profesor)

**Excluir histórico** en cualquier vista donde se actúe sobre el registro (cancelar, marcar, aprobar, devolver):

```ts
// Ejemplo: librarian/loans/pickups (préstamos pendientes de recoger)
await prisma.loan.findMany({
  where: {
    status: "RESERVED",
    historical: false,  // ← añadir
  },
});

// Ejemplo: admin/library/loans/requests
await prisma.loan.findMany({
  where: {
    status: "QUEUED",
    historical: false,  // ← añadir
  },
});
```

**Server actions a revisar (lista no exhaustiva, lo afino al implementar):**

- [actions/library.ts](packages/nextjs/src/actions/library.ts) — `confirmPickup`, `returnLoan`, `cancelLoanRequest`, `listPendingLoans`...
- [actions/shop.ts](packages/nextjs/src/actions/shop.ts) — `markOrderDelivered`, `cancelOrder`, `listPendingOrders`...
- [actions/printing.ts](packages/nextjs/src/actions/printing.ts) — operaciones que toquen `PrintLog` (probablemente solo lectura).
- [actions/rooms.ts](packages/nextjs/src/actions/rooms.ts) — `cancelBooking`, `listUpcomingBookings`...

**Regla mental:** si una acción llama a un contrato (`writeContract`), el registro tiene que tener `historical: false`. Si solo es lectura para mostrar, casi siempre puede incluir histórico.

### 4.2. Listados "Mis cosas" (panel del estudiante)

**Incluir histórico** pero marcarlo visualmente:

```ts
// Mis préstamos: incluyo histórico, ordenados por fecha desc
await prisma.loan.findMany({
  where: { userId },
  orderBy: { requestDate: "desc" },
  // sin filtro historical → incluye todos
});
```

El componente de UI (`/student/library`) muestra los activos arriba, los históricos al final con un badge gris "histórico". Igual para pedidos, impresiones y reservas.

### 4.3. Estadísticas y gráficas (el por qué de todo esto)

**Incluir histórico siempre.** No filtrar por `historical`. Estos endpoints son los que consume `/admin`, `/professor`, `/librarian` y `/student` para los charts:

- `getMyPrintsByMonth()` — incluye histórico (es el caso de uso principal).
- `getLibraryStats()`, `getShopStats()`, etc. — incluyen histórico.
- Top X (libros más prestados, productos más vendidos, etc.) — incluyen histórico.

### 4.4. Operaciones en runtime que NUNCA crean históricos

Ningún server action en runtime debe escribir `historical: true`. **Ese flag lo pone exclusivamente el seed.** Es la barrera principal de seguridad: aunque alguien acceda al panel admin, no puede inflar estadísticas a mano.

Si necesitamos revertir esta decisión más adelante (e.g., un import histórico desde un sistema legacy), se haría con un script de admin con audit log, no con un endpoint expuesto.

---

## 5. Nuevo seed: `seed-historical.mjs`

### 5.1. Ubicación

[packages/nextjs/scripts/seed-historical.mjs](packages/nextjs/scripts/seed-historical.mjs) (nuevo archivo).

### 5.2. Idempotencia

Mismo patrón que los demás seeds (ver `seed-products.mjs`). Antes de generar:

```js
const expected = TARGET_HISTORICAL_LOANS_PER_USER * userCount;  // p.ej. 10 * 13 = 130
const actual = await prisma.loan.count({ where: { historical: true } });

if (actual >= expected) {
  log(green(`Ya sincronizado (${actual} préstamos históricos). Saltando.`));
  return;
}
```

Igual para órdenes/prints/reservas. Si la cuenta ya está, no toca nada.

### 5.3. Cantidades sugeridas

Por cada estudiante (~10 alumnos seeded):

| Tipo | Cantidad por usuario | Total ~ |
|---|---|---|
| Préstamos históricos (`status: RETURNED`) | 5–15 | 50–150 |
| Reservas de sala (`cancelled: false`, fecha pasada) | 3–10 | 30–100 |
| Impresiones (`PrintLog`) | 10–30 | 100–300 |
| Pedidos (`OrderBatch` + `Order`, `status: DELIVERED`) | 2–6 batches con 1–4 items cada uno | 20–60 batches |

**Variar:**

- **Fechas** distribuidas en los últimos 6–12 meses con `randomDateInRange(startMonthsAgo, endMonthsAgo)`.
- **Items prestados / productos comprados** distribuidos para que las gráficas "top X" tengan distribución realista (Pareto: pocos items con muchos préstamos, muchos items con pocos).
- **Páginas impresas** entre 1 y 50 páginas, peso color/duplex aleatorio para que las gráficas de tipo de impresión también tengan variedad.
- **Capacidad reservada** para salas: respetar capacidad de la sala (no reservar 8 personas en sala de 4), evitar duplicados (mismo user, mismo día, misma sala, misma hora).

### 5.4. Esqueleto del script

```js
import prismaClientPkg from "@prisma/client";
const { PrismaClient } = prismaClientPkg;
import { PrismaPg } from "@prisma/adapter-pg";
// ... carga env

const HISTORICAL_LOANS_PER_USER = 10;
const HISTORICAL_BOOKINGS_PER_USER = 5;
const HISTORICAL_PRINTS_PER_USER = 20;
const HISTORICAL_ORDERS_PER_USER = 4;

async function main() {
  const prisma = new PrismaClient(/* ... */);

  // Idempotencia: ¿ya hay datos históricos?
  const [existingLoans, existingBookings, existingPrints, existingOrders] = await Promise.all([
    prisma.loan.count({ where: { historical: true } }),
    prisma.roomBooking.count({ where: { historical: true } }),
    prisma.printLog.count({ where: { historical: true } }),
    prisma.orderBatch.count({ where: { historical: true } }),
  ]);

  const students = await prisma.user.findMany({ where: { role: "STUDENT" } });
  const items = await prisma.libraryItem.findMany();
  const products = await prisma.product.findMany({ where: { active: true } });
  const rooms = await prisma.room.findMany({ where: { active: true } });
  const printers = await prisma.printer.findMany({ where: { active: true } });

  const targetLoans = students.length * HISTORICAL_LOANS_PER_USER;
  if (existingLoans < targetLoans) {
    await seedHistoricalLoans(prisma, students, items, targetLoans - existingLoans);
  }
  if (existingBookings < students.length * HISTORICAL_BOOKINGS_PER_USER) { /* ... */ }
  if (existingPrints < students.length * HISTORICAL_PRINTS_PER_USER) { /* ... */ }
  if (existingOrders < students.length * HISTORICAL_ORDERS_PER_USER) { /* ... */ }
}

async function seedHistoricalLoans(prisma, students, items, count) {
  for (let i = 0; i < count; i++) {
    const student = pickRandom(students);
    const item = pickRandom(items);
    const requestDate = randomDateInRange(12, 1);  // entre 12 y 1 meses atrás
    const pickupDate  = addDaysRandom(requestDate, 1, 3);
    const dueDate     = addDays(pickupDate, 14);
    const returnDate  = addDaysRandom(pickupDate, 5, 14);

    await prisma.loan.create({
      data: {
        loanId: null,                  // sin contraparte on-chain
        libraryItemId: item.id,
        userId: student.id,
        status: "RETURNED",
        requestDate,
        reservationDate: requestDate,
        pickupDate,
        dueDate,
        returnDate,
        overdue: false,
        historical: true,              // ← clave
      },
    });
  }
}

// helpers: pickRandom, randomDateInRange, addDays, addDaysRandom...
```

### 5.5. Integración en el master seed

En [scripts/seed.mjs](scripts/seed.mjs), añadir al array `seeds`:

```js
{ name: "historical", file: "scripts/seed-historical.mjs", label: "Datos históricos para gráficas" },
```

Va al final, después de `cleanup`. O, si depende de products/library/rooms estando ya seedeados, va después de ellos pero antes de `cleanup`.

### 5.6. Comando standalone

En [package.json](package.json), añadir:

```json
"db:seed:historical": "node packages/nextjs/scripts/seed-historical.mjs",
```

---

## 6. UI / marcadores visuales

### 6.1. Listados de "mis cosas"

En `/student/library`, `/student/library/printing/history`, `/student/shop/orders`, `/student/library/rooms`:

- Filas/cards con `historical === true` muestran un badge gris claro `Histórico` (componente `Badge` con `variant="neutral"` o nuevo).
- En el detalle (al hacer clic en la fila), banner informativo arriba:

  > *Este registro es histórico (anterior a la integración blockchain). No tiene firma on-chain y no admite acciones.*

### 6.2. Gráficas

En las cards de gráfico (DashboardBarChart, DashboardPieChart, etc.) que mezclan datos:

- Footer pequeño: *"Incluye datos históricos previos a la integración blockchain"*.
- O ícono `info` con tooltip que diga lo mismo.

Solo en las gráficas globales (todos los datos). En gráficas filtradas a "últimos 30 días" no hace falta porque los históricos son antiguos.

### 6.3. Vistas de admin

- Dashboards de admin/librarian: incluyen históricos en stats globales.
- Listas operativas (préstamos vencidos, pedidos por entregar, reservas activas) NO incluyen históricos.
- Si un admin quiere ver el histórico completo, vista nueva o filtro `?include_historical=true` (opcional, fuera de scope inicial).

---

## 7. Orden de implementación

1. **Schema + migración** (~10 min)
   - Editar `schema.prisma` (campos nullable + `historical`).
   - `pnpm db:generate && pnpm db:push` (o `pnpm db:reset` si prefiero limpio).
2. **Server actions: filtros** (~30 min)
   - Grep `findMany`, `findUnique`, `findFirst` en `actions/library.ts`, `actions/shop.ts`, `actions/printing.ts`, `actions/rooms.ts`.
   - Añadir `historical: false` donde la operación sea accionable o donde el contrato sea consultado.
   - Dejar libre (incluyendo histórico) donde sea solo lectura para stats o "mis cosas".
3. **Seed nuevo** (~45 min)
   - Crear `seed-historical.mjs` con la estructura de §5.4.
   - Helpers de fecha/random.
   - Idempotencia por contadores.
   - Probar con `pnpm db:seed:historical` standalone.
4. **Integración en master seed** (~5 min)
   - Añadir al array de `seed.mjs`.
   - Añadir entry en `package.json` (`db:seed:historical`).
5. **UI: badges y banners** (~30 min)
   - Componente `<HistoricalBadge />` reutilizable.
   - Aplicar en listas y detalles.
   - Footer en gráficas globales.
6. **Verificación** (~20 min)
   - `pnpm reset:all && pnpm dev:fresh` → arranque limpio, seeds OK.
   - Login como alumno → ver "mis cosas" con histórico marcado.
   - Login como admin → dashboards con gráficas pobladas.
   - Probar acciones en una fila histórica → debe rebotar (404 o error claro "registro histórico, no accionable").
   - `pnpm dev` (segunda corrida) → seed-historical dice "Ya sincronizado, saltando".

**Total estimado:** ~2h 20min.

---

## 8. Verificación

### 8.1. Checklist funcional

- [ ] `pnpm db:reset && pnpm dev:fresh` arranca con `9/9` o `10/10` seeds OK (uno más por el histórico).
- [ ] `pnpm dev` segunda corrida: histórico dice "Ya sincronizado".
- [ ] `/student` (alumno con historia): gráficas de impresiones, préstamos, etc. tienen datos en los últimos 6–12 meses.
- [ ] `/student/library` (lista de préstamos): activos arriba, históricos abajo con badge.
- [ ] `/student/shop/orders/[id]` (pedido histórico): banner "histórico, no accionable".
- [ ] `/admin` (dashboards): gráficas globales pobladas.
- [ ] `/admin/library/loans` (operativa): NO aparecen préstamos históricos en lista de pendientes/recoger.
- [ ] `/librarian/loans/pickups`: idem.
- [ ] Intento manual de devolver un préstamo histórico → falla con error claro.
- [ ] Intento manual de cancelar una reserva histórica → falla con error claro.
- [ ] `pnpm db:seed:historical` aislado tras borrado manual de algunas filas históricas → recompone hasta el target.

### 8.2. Checklist de no-regresión

- [ ] Las acciones reales (request loan, return loan, buy product, book room, print) siguen creando filas con `historical: false` (default).
- [ ] El cálculo de "préstamos activos" del usuario (banner de alertas en `/student`) NO incluye históricos (todos los históricos están `RETURNED`).
- [ ] Las gráficas siguen actualizándose con la actividad real nueva (no se quedan en datos históricos).

---

## 9. Riesgos y consideraciones

### 9.1. Riesgo: lecturas on-chain con `loanId === null`

Cualquier código que haga `LibraryManager.getLoan(loan.loanId)` con un `loanId` null va a fallar. Hay que protegerlo con guard:

```ts
if (loan.historical || loan.loanId === null) {
  // fallback: leer todo de Prisma, no consultar contrato
  return loan;
}
const onChain = await publicClient.readContract({ ... });
```

Localizar todas las llamadas a `readContract` con `loanId`/`orderId`/`bookingId` y añadir el guard.

### 9.2. Riesgo: queries que asumen `txHash` siempre existe

Algún componente UI puede mostrar `<a href={`/etherscan/${txHash}`}>` sin comprobar null. Buscar `txHash` en componentes y añadir conditional rendering:

```tsx
{order.txHash ? (
  <a href={`...`}>Ver en blockchain</a>
) : (
  <span className="text-text-muted">Histórico (sin tx)</span>
)}
```

### 9.3. Riesgo: contadores `nextLoanId`/`nextOrderId` on-chain

Como los registros históricos NO consumen IDs on-chain, los contadores reales del contrato siguen empezando en 1 cuando se hace el primer préstamo real. Esto es correcto y deseado, pero documentarlo para no confundirse: "ID 1 on-chain ≠ primera fila en la tabla porque las históricas son anteriores".

### 9.4. Riesgo: nombres en gráficas

Productos / libros referenciados en históricos deben existir como filas en Prisma (Product, LibraryItem). Eso ya se cumple porque `seed-products` y `seed-library` corren antes que `seed-historical` en el master seed.

Si en el futuro se borra un Product, los Orders históricos lo siguen referenciando. Como `Product.id` es FK, no se puede borrar mientras haya Orders apuntando. Aceptable por ahora.

### 9.5. Riesgo: la `chain` no avanza

Si un alumno solo tiene actividad histórica y nunca hace nada real, todas sus tx visibles serán "histórico, sin tx". UX pobre pero no es un bug — es la consecuencia del modelo. Mitigación: en seed-academic asegurar que cada alumno arranca con balances razonables para que pueda hacer al menos 1–2 acciones reales y "estrenar" la historia on-chain.

---

## 10. Fuera de scope (futuro)

- **Auditoría on-chain del histórico**: comprometer un Merkle root de los datos históricos en un contrato (`HistoricalAttestation.sol`) para que al menos haya prueba criptográfica de que ese set existía en una fecha. No relevante para TFG.
- **Importador**: si en producción tuviéramos que migrar datos legacy de un sistema antiguo, un script de admin con audit log, no este seed.
- **Filtros UI avanzados**: switch "Mostrar solo histórico" / "Solo on-chain" en listas. Solo si la UX lo pide.
- **Borrado/edición de históricos**: por ahora son inmutables. Si se necesita corregir uno, regenerar todo con `pnpm db:reset`.
- **Insignias / recompensas históricas**: no contempladas en esta primera iteración. Si una gráfica futura las necesita, replicar el patrón.

---

## 11. Resumen ejecutivo (TL;DR)

1. Añadir `historical Boolean @default(false)` y nullable los IDs/txHashes en `Loan`, `Order`, `OrderBatch`, `PrintLog`, `RoomBooking`.
2. Server actions accionables filtran `historical: false`. Stats no filtran.
3. Seed `seed-historical.mjs` genera ~5–30 filas por usuario con fechas distribuidas en los últimos 6–12 meses, todas en estado terminal (RETURNED, DELIVERED, cancelled, etc.).
4. UI marca filas históricas con badge gris y banner informativo.
5. Tiempo total: ~2h 20min. Riesgo principal: lecturas on-chain con IDs null → guard explícito.
