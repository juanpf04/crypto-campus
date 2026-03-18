# CryptoCampus — Arquitectura del Proyecto

Documento de referencia completo. Explica cada decisión técnica, qué hace cada carpeta, cómo fluyen los datos y las convenciones del proyecto. Se mantiene actualizado conforme avanza el desarrollo.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Estructura del monorepo](#3-estructura-del-monorepo)
4. [Smart Contracts (packages/hardhat)](#4-smart-contracts-packageshardhat)
5. [Base de datos — Prisma Schema](#5-base-de-datos--prisma-schema)
6. [Aplicación Next.js (packages/nextjs)](#6-aplicación-nextjs-packagesnextjs)
7. [Flujo de datos: blockchain vs Prisma](#7-flujo-de-datos-blockchain-vs-prisma)
8. [Sistema de autenticación](#8-sistema-de-autenticación)
9. [Roles y permisos](#9-roles-y-permisos)
10. [Convenciones de código](#10-convenciones-de-código)
11. [Cómo arrancar el proyecto](#11-cómo-arrancar-el-proyecto)

---

## 1. Visión general

CryptoCampus es una plataforma universitaria para la UCM que gestiona cuatro módulos usando blockchain como capa de confianza:

| Módulo | Descripción |
|---|---|
| **Biblioteca** | Préstamo de libros, juegos de mesa y videojuegos con tokens ERC-20 como depósito |
| **Tienda** | Compra de productos de papelería/merchandising universitario con ShopTokens |
| **Badges** | Sistema de insignias académicas que los profesores otorgan a alumnos por tareas |
| **Impresión** | Solicitud y gestión de trabajos de impresión con pago en tokens |

### Principio fundamental de diseño

**La blockchain es la fuente de verdad para ownership y estado financiero. Prisma es la fuente de verdad para metadata y relaciones.**

- On-chain: precios, stocks, saldos, roles, estados de préstamos/pedidos, eventos auditables
- Prisma: nombres, descripciones, imágenes, ISBN, categorías, historial legible

### Tipo de dApp

CryptoCampus **NO** es una dApp estándar donde el usuario conecta MetaMask. Es una aplicación web tradicional con blockchain en el backend:

- Las wallets son generadas automáticamente por el servidor al registrar un usuario
- El usuario nunca ve ni maneja su clave privada
- Las transacciones blockchain las firma el backend en nombre del usuario
- La UX es idéntica a una app web normal (email + contraseña)

---

## 2. Stack tecnológico

### Frontend / Backend
- **Next.js 15** (App Router) — framework full-stack
- **TypeScript** — tipado estático en todo el proyecto
- **Tailwind CSS** — estilos utilitarios
- **iron-session** — sesiones cifradas en cookies httpOnly
- **wagmi + viem** — solo para configuración de red; las txs van server-side con viem puro

### Blockchain
- **Solidity ^0.8.20** — contratos inteligentes
- **Hardhat** — entorno de desarrollo y red local
- **Hardhat Ignition** — sistema de despliegue declarativo
- **OpenZeppelin** — contratos base (ERC20, AccessControl)
- **viem** — cliente blockchain server-side (reemplaza ethers.js)

### Base de datos
- **PostgreSQL** — base de datos relacional (puerto 5435 en local)
- **Prisma** — ORM con migraciones y cliente TypeScript generado

### Herramientas
- **pnpm workspaces** — monorepo con packages/hardhat y packages/nextjs
- **bcryptjs** — hash de contraseñas
- **Node crypto (AES-256-GCM)** — cifrado de claves privadas en BD

---

## 3. Estructura del monorepo

```
CryptoCampus/
├── packages/
│   ├── hardhat/          # Contratos Solidity + despliegue
│   └── nextjs/           # Aplicación web full-stack
├── ARCHITECTURE.md       # Este archivo
├── package.json          # Workspace root
└── pnpm-workspace.yaml
```

---

## 4. Smart Contracts (packages/hardhat)

### Archivos importantes

```
packages/hardhat/
├── contracts/            # Código Solidity
├── ignition/modules/     # CampusModule.ts — despliegue declarativo
├── artifacts/            # ABIs generados (importados desde Next.js)
└── ignition/deployments/chain-31337/deployed_addresses.json
```

### Los 7 contratos

#### CampusAccessControl
- **Hereda de**: OpenZeppelin AccessControl
- **Responsabilidad**: Registro de usuarios y gestión de roles
- **Roles**: `STUDENT_ROLE`, `PROFESSOR_ROLE`, `LIBRARIAN_ROLE` (ADMIN = DEFAULT_ADMIN_ROLE)
- **Funciones clave**: `registerUser(address, name, role)`, `hasRole(role, address)`
- **Nota**: Solo el admin (account[0] de Hardhat) puede registrar usuarios y asignar roles

#### LibraryToken (ERC-20)
- **Símbolo**: LIB
- **Responsabilidad**: Token de depósito para préstamos de biblioteca
- **Flujo**: Al solicitar préstamo, el usuario "gasta" 1 LIB → al devolver, lo recupera
- **Mint**: Solo el admin puede mintear (10 tokens iniciales por estudiante al registrarse)

#### ShopToken (ERC-20)
- **Símbolo**: SHOP
- **Responsabilidad**: Moneda interna de la tienda
- **Mint**: Solo el admin puede mintear (100 tokens iniciales por estudiante al registrarse)

#### LibraryManager
- **Responsabilidad**: Gestión on-chain del estado de préstamos
- **Struct Book**: `{ totalCopies, availableCopies, exists }` — sin strings (gas optimization)
- **Funciones**: `addBook(copies)`, `requestLoan(bookId, borrower)`, `returnLoan(loanId)`
- **Vinculación con Prisma**: `bookId` (uint256) ↔ `LibraryItem.tokenId` en Prisma

#### CampusShop
- **Responsabilidad**: Gestión on-chain de productos y compras
- **Struct Product**: `{ price, stock, active, exists }` — sin nombre (gas optimization)
- **Funciones**: `addProduct(price, stock)`, `purchase(productId, buyer)`
- **Vinculación con Prisma**: `productId` (uint256) ↔ `Product.tokenId` en Prisma

#### BadgeSystem
- **Responsabilidad**: Emisión y verificación de insignias académicas
- **Structs**: `BadgeType { creator, exists }`, `Task { badgeTypeId, rewardAmount, exists }`, `Reward { badgeCost, supply, minted, exists }`
- **Sin strings**: nombre y descripción viven en Prisma
- **Funciones**: `createBadgeType()`, `createTask(badgeTypeId, rewardAmount)`, `createReward(badgeTypeId, badgeCost, supply)`, `awardBadge(taskId, student)`

#### Printer
- **Responsabilidad**: Gestión de créditos de impresión de estudiantes (1 crédito = 1 página)
- **Constantes**: `INITIAL_CREDITS = 200` — créditos por defecto para cada estudiante
- **Funciones**: `setCredits(student, credits)`, `print(student, pages)`, `getCredits(student)`
- **Eventos**: `CreditsSet(student, credits)`, `PrintJobExecuted(student, pages, remainingCredits)`
- **Nota**: Solo el admin puede llamar a `setCredits` y `print`. `getCredits` devuelve -1 si la dirección no es estudiante

### Direcciones desplegadas (chain-31337 — Hardhat local)

```json
{
  "CampusAccessControl": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "BadgeSystem":         "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  "LibraryToken":        "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  "Printer":     "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  "ShopToken":           "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  "CampusShop":          "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
  "LibraryManager":      "0x0165878A594ca255338adfa4d48449f69242Eb8F"
}
```

Estas direcciones son deterministas en Hardhat (siempre las mismas si se despliega desde cero en el mismo orden). Si se redespliegas, actualizar `src/lib/contracts.ts`.

### Optimización de gas

Se eliminaron todos los strings de los structs on-chain. Nombres, descripciones, títulos, autores e ISBN viven en Prisma. La blockchain solo guarda lo que necesita para ejecutar lógica: precios, cantidades, estados, direcciones.

---

## 5. Base de datos — Prisma Schema

### Archivo: `packages/nextjs/prisma/schema.prisma`
### Migraciones en: `packages/nextjs/prisma/migrations/`

### Modelos y responsabilidades

#### User
```
id, email, password (bcrypt), name, address (wallet), encryptedKey (AES-256-GCM),
role (STUDENT|PROFESSOR|LIBRARIAN|ADMIN), createdAt
```
- `address`: dirección pública de la wallet generada server-side
- `encryptedKey`: clave privada cifrada — NUNCA se expone al frontend
- `role`: refleja el rol on-chain pero se guarda aquí para evitar consultas blockchain en cada request

#### Subject / SubjectOffering / Enrollment
- `Subject`: asignatura (nombre, código)
- `SubjectOffering`: instancia de asignatura (profesor + grupo + cuatrimestre). Un profesor imparte una asignatura a un grupo concreto
- `Enrollment`: qué estudiante está en qué SubjectOffering. Restringe qué badges puede recibir un alumno (solo los de su profesor/grupo)

#### BadgeType / Task / BadgeAward
- `BadgeType`: tipo de insignia creado por un profesor. `tokenId` = ID on-chain en BadgeSystem
- `Task`: tarea asociada a un BadgeType. `taskId` = ID on-chain
- `BadgeAward`: registro de que un profesor otorgó una badge a un alumno. Incluye `txHash` de la tx on-chain

#### Reward / RewardRedemption
- `Reward`: recompensa canjeable con badges. `rewardId` = ID on-chain
- `RewardRedemption`: registro de un canje. Incluye `txHash`

#### LibraryItem
- Representa cualquier ítem prestable: libro, juego de mesa, videojuego
- `type`: enum `BOOK | BOARD_GAME | VIDEO_GAME`
- `metadata`: campo JSON flexible para datos específicos del tipo (ISBN, plataforma, número de jugadores...)
- `tokenId`: ID on-chain en LibraryManager

#### Loan
- Registro de cada préstamo
- `status`: `ACTIVE | RETURNED | OVERDUE`
- `loanId`: ID on-chain en LibraryManager
- `txHash` en `requestTxHash` y `returnTxHash`

#### Printer / PrintLog
- `Printer`: impresora física registrada (ubicación, modelo)
- `PrintLog`: solicitud de impresión. `jobId` = ID on-chain en PrintingService

#### Product / Order
- `Product`: artículo de la tienda. `tokenId` = ID on-chain en CampusShop
- `Order`: compra realizada. `txHash` incluido

### Principio de vinculación Prisma ↔ Blockchain

Cada entidad que tiene representación on-chain tiene un campo `tokenId` (o `loanId`, `jobId`, `rewardId`) que es el `uint256` devuelto por el contrato al crear la entidad. Este ID es la clave de unión entre las dos fuentes de verdad.

---

## 6. Aplicación Next.js (packages/nextjs)

### Estructura de carpetas

```
packages/nextjs/
├── src/                          # Todo el código fuente
│   ├── app/                      # Next.js App Router
│   ├── actions/                  # Server Actions (lógica de negocio)
│   ├── components/               # Componentes React
│   ├── lib/                      # Configuración de librerías
│   ├── middleware.ts              # Protección de rutas
│   └── types/                    # Tipos TypeScript compartidos
├── prisma/                       # Schema y migraciones (fuera de src — es config)
├── public/                       # Assets estáticos
├── tsconfig.json                 # @/* apunta a ./src/*
└── next.config.ts
```

---

### 6.1 `src/app/` — Rutas y páginas

El App Router de Next.js mapea carpetas a URLs. Cada `page.tsx` es una página. Cada `layout.tsx` envuelve sus hijos.

#### Grupos de rutas

- `(auth)/` — grupo sin prefijo en URL: `/login`, `/register`
- `dashboard/` — área privada protegida por middleware

#### Estructura completa de rutas

```
src/app/
├── layout.tsx                    # Root layout: Providers (Wagmi, QueryClient)
├── page.tsx                      # Homepage pública: botones Login / Register
├── providers.tsx                 # WagmiProvider + QueryClientProvider
├── globals.css
│
├── (auth)/
│   ├── login/
│   │   └── page.tsx              # Formulario login → POST /api/auth/login
│   └── register/
│       └── page.tsx              # Formulario registro → POST /api/auth/register
│
├── api/                          # API Routes (Next.js Route Handlers)
│   ├── auth/
│   │   ├── login/route.ts        # POST: valida credenciales, crea sesión iron-session
│   │   ├── logout/route.ts       # POST: destruye la sesión
│   │   ├── me/route.ts           # GET: devuelve datos del usuario autenticado
│   │   └── register/route.ts    # POST: crea wallet, registra on-chain, guarda en Prisma
│   ├── admin/                    # Rutas de administración (solo ADMIN)
│   ├── library/                  # Rutas de biblioteca
│   ├── shop/                     # Rutas de tienda
│   ├── badges/                   # Rutas de badges
│   └── printing/                 # Rutas de impresión
│
└── dashboard/
    ├── layout.tsx                # Sidebar + Navbar comunes a todos los roles
    ├── page.tsx                  # Redirect según session.role al subdashboard correcto
    │
    ├── admin/
    │   ├── page.tsx              # Panel inicial: 4 tarjetas (biblioteca, tienda, badges, impresión)
    │   ├── users/
    │   │   ├── page.tsx          # Tabla de todos los usuarios con filtros por rol
    │   │   ├── new/page.tsx      # Formulario crear usuario (profesor, bibliotecario, admin)
    │   │   └── [id]/page.tsx     # Detalle y edición de usuario
    │   ├── library/
    │   │   ├── page.tsx          # Panel biblioteca del admin
    │   │   ├── items/
    │   │   │   ├── page.tsx      # Catálogo completo de ítems
    │   │   │   ├── new/page.tsx  # Formulario añadir ítem (libro/juego/videojuego)
    │   │   │   └── [id]/
    │   │   │       └── edit/page.tsx
    │   │   └── loans/
    │   │       ├── page.tsx      # Tabla préstamos con filtros (activos/finalizados/retrasados)
    │   │       └── requests/page.tsx  # Solicitudes de préstamo pendientes
    │   ├── shop/
    │   │   ├── page.tsx          # Panel tienda del admin
    │   │   ├── products/
    │   │   │   ├── page.tsx      # Catálogo de productos
    │   │   │   ├── new/page.tsx  # Formulario añadir producto
    │   │   │   └── [id]/
    │   │   │       └── edit/page.tsx
    │   │   └── orders/page.tsx   # Historial de pedidos
    │   ├── badges/
    │   │   ├── page.tsx          # Panel badges del admin
    │   │   ├── types/
    │   │   │   ├── page.tsx      # Lista de tipos de badge
    │   │   │   ├── new/page.tsx  # Crear tipo de badge
    │   │   │   └── [id]/
    │   │   │       └── edit/page.tsx
    │   │   └── rewards/
    │   │       ├── page.tsx      # Lista de recompensas
    │   │       ├── new/page.tsx
    │   │       └── [id]/
    │   │           └── edit/page.tsx
    │   └── printing/
    │       ├── page.tsx          # Cola de trabajos pendientes
    │       └── logs/page.tsx     # Historial de impresiones
    │
    ├── librarian/
    │   ├── page.tsx              # Panel inicial: stats rápidas
    │   ├── items/
    │   │   ├── page.tsx          # Catálogo de ítems (libros, juegos...)
    │   │   ├── new/page.tsx      # Añadir ítem
    │   │   └── [id]/
    │   │       └── edit/page.tsx
    │   └── loans/
    │       ├── page.tsx          # Tabla préstamos con filtros
    │       └── requests/page.tsx # Solicitudes pendientes de aprobación
    │
    ├── professor/
    │   ├── page.tsx              # Panel inicial: mis asignaturas
    │   ├── students/
    │   │   ├── page.tsx          # Mis alumnos: tabla con conteo de badges/recompensas
    │   │   └── [id]/page.tsx     # Detalle alumno: badges obtenidos, recompensas canjeadas
    │   ├── badges/
    │   │   ├── page.tsx          # Mis tipos de badge
    │   │   ├── new/page.tsx      # Crear badge type + tasks
    │   │   └── [id]/
    │   │       └── edit/page.tsx
    │   └── rewards/
    │       ├── page.tsx          # Mis recompensas
    │       ├── new/page.tsx      # Crear recompensa
    │       └── [id]/
    │           └── edit/page.tsx
    │
    └── student/
        ├── page.tsx              # Mi perfil: datos personales + saldo de tokens
        ├── library/page.tsx      # Mis préstamos activos + catálogo para solicitar
        ├── shop/page.tsx         # Catálogo de productos + comprar con ShopTokens
        ├── badges/page.tsx       # Mis badges obtenidos + recompensas canjeables
        └── printing/page.tsx     # Solicitar trabajo de impresión + mis solicitudes
```

---

### 6.2 `src/actions/` — Server Actions

**Regla**: Toda lógica que toca Prisma o firma transacciones blockchain va aquí.
Las páginas y componentes llaman a estas funciones directamente (no a `fetch`).

```
src/actions/
├── auth.ts        # register, login — flujo completo: wallet + on-chain + Prisma
├── badges.ts      # createBadgeType, createTask, createReward, awardBadge, redeemReward
├── library.ts     # addItem, requestLoan, approveLoan, returnLoan, getLoans
├── shop.ts        # addProduct, updateProduct, purchaseProduct, getOrders
└── printing.ts    # getPrinterConfig, createPrinter, updatePrinter, getMyPrinterCredits,
│                  # setStudentPrinterCredits, executeMyPrintJob, executePrintJobAsAdmin
```

**Patrón de una Server Action con blockchain:**
1. Validar inputs
2. Leer estado de Prisma si es necesario
3. Descifrar `encryptedKey` del usuario para obtener su walletClient
4. Enviar tx on-chain → obtener `txHash`
5. Guardar resultado + `txHash` en Prisma
6. Devolver resultado al componente

---

### 6.3 `src/components/` — Componentes React

Organizado por nivel de abstracción (Atomic Design simplificado):

```
src/components/
├── ui/            # ATOMS — sin lógica de negocio
│                  # Button, Input, Badge, Card, Spinner, Avatar, Table, Modal
│                  # Reciben props, emiten eventos. No saben nada de la app.
│
├── forms/         # MOLÉCULAS con lógica de formulario
│                  # LoginForm, RegisterForm, ItemForm, ProductForm, BadgeTypeForm
│                  # Reciben onSubmit callback, delegan lógica a actions/
│
└── dashboard/     # ORGANISMS — componentes "smart" por sección
                   # Combinan ui/ + forms/ + llamadas a actions/
                   # LibraryTable, ShopGrid, BadgeList, PrintQueue, UserTable
                   # Tienen estado propio y saben con qué datos trabajar
```

**Regla de oro**: Si un componente necesita saber qué es un "préstamo" o un "badge", pertenece a `dashboard/`. Si solo sabe que es un botón o una tabla genérica, pertenece a `ui/`.

---

### 6.4 `src/lib/` — Configuración de librerías

```
src/lib/
├── prisma.ts      # Singleton de PrismaClient (patrón necesario en Next.js dev con HMR)
├── contracts.ts   # ABIs importados de hardhat/artifacts + CONTRACT_ADDRESSES + ROLES
├── viem.ts        # adminWalletClient (account[0] Hardhat) + publicClient server-side
├── wagmi.ts       # Configuración wagmi para el cliente (chain hardhat, SSR: true)
├── session.ts     # SessionOptions de iron-session + interfaz SessionData
└── crypto.ts      # encrypt/decrypt AES-256-GCM para claves privadas
```

#### Por qué existe `viem.ts` separado de `wagmi.ts`

- `wagmi.ts` es para el **cliente** (browser): configura la conexión de red para hooks de lectura
- `viem.ts` es para el **servidor**: contiene el `adminWalletClient` que firma transacciones. La clave privada del admin NUNCA sale del servidor

---

### 6.5 `src/middleware.ts` — Protección de rutas

Intercepta todas las peticiones a `/dashboard/*`, `/login` y `/register`.

- Si un usuario no autenticado intenta acceder a `/dashboard` → redirige a `/login`
- Si un usuario ya autenticado va a `/login` o `/register` → redirige a `/dashboard`

**Nota**: El middleware NO hace autorización por rol (eso lo hace cada `page.tsx` individualmente). Solo comprueba si hay sesión activa.

---

### 6.6 `src/types/index.ts` — Tipos compartidos

```typescript
UserRole = "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN"
SessionUser = { id, email, name, role, address }
```

---

## 7. Flujo de datos: blockchain vs Prisma

### Crear un ítem de biblioteca (ejemplo completo)

```
Admin hace click en "Añadir libro"
  ↓
<ItemForm onSubmit={addItem} />
  ↓
actions/library.ts → addItem({ title, author, isbn, copies, type, ... })
  ↓
  1. adminWalletClient.writeContract(LibraryManager.addBook(copies))
     → devuelve txHash
     → el evento BookAdded emite bookId (uint256)
  2. prisma.libraryItem.create({
       title, author, isbn, type, tokenId: bookId, metadata: {...}
     })
  ↓
Respuesta al componente: { success: true, item: { id, title, tokenId } }
```

### Quién guarda qué

| Dato | Blockchain | Prisma |
|---|---|---|
| Número de copias disponibles | ✅ LibraryManager | No |
| Título, autor, ISBN | No | ✅ LibraryItem |
| Estado del préstamo (activo/devuelto) | ✅ LibraryManager | ✅ Loan.status (redundante para queries rápidas) |
| txHash del préstamo | No | ✅ Loan.requestTxHash |
| Saldo de LibraryTokens | ✅ LibraryToken (ERC-20) | No |
| Precio de un producto | ✅ CampusShop | No |
| Nombre del producto | No | ✅ Product.name |

---

## 8. Sistema de autenticación

### Registro de estudiante (`POST /api/auth/register`)

1. Validar email `@ucm.es` y campos requeridos
2. Comprobar que el email no existe en Prisma
3. `bcrypt.hash(password, 10)` → guardar hash
4. `generatePrivateKey()` → `privateKeyToAccount()` → obtener address
5. `encrypt(privateKey)` con AES-256-GCM usando `SESSION_SECRET`
6. `adminWalletClient.sendTransaction({ to: address, value: 1000 ETH })` — gas para operar
7. `adminWalletClient.writeContract(CampusAccessControl.registerUser(address, name, STUDENT_ROLE))`
8. Mintear 10 LibraryTokens + 100 ShopTokens al nuevo address
9. `prisma.user.create({ email, password: hash, name, address, encryptedKey, role: STUDENT })`

### Registro de otros roles (PROFESSOR, LIBRARIAN, ADMIN)

Solo el admin puede crear usuarios con otros roles. Se hace desde `/dashboard/admin/users/new`. El flujo es el mismo pero sin validación de email @ucm.es y con el rol correspondiente.

### Login (`POST /api/auth/login`)

1. `prisma.user.findUnique({ where: { email } })`
2. `bcrypt.compare(password, user.password)`
3. `getIronSession()` → `session.userId = user.id; session.role = user.role; session.save()`
4. Cookie httpOnly cifrada con `SESSION_SECRET` → el browser nunca ve su contenido

### Sesión en cada request

El middleware y las API routes llaman a `getIronSession()` con la cookie para obtener `{ userId, address, role }`. No hay JWT ni tokens Bearer.

### Cómo se firma una tx en nombre de un usuario no-admin

```typescript
// En una Server Action
const user = await prisma.user.findUnique({ where: { id: session.userId } });
const privateKey = decrypt(user.encryptedKey); // AES-256-GCM
const account = privateKeyToAccount(privateKey as `0x${string}`);
const userWalletClient = createWalletClient({
  account,
  chain: hardhat,
  transport: http(),
});
await userWalletClient.writeContract({ ... });
```

---

## 9. Roles y permisos

### On-chain (CampusAccessControl)

| Rol | Capacidades on-chain |
|---|---|
| `DEFAULT_ADMIN_ROLE` | Todo. Registrar usuarios, asignar roles, mintear tokens |
| `PROFESSOR_ROLE` | Crear badge types, tasks, rewards. Otorgar badges |
| `LIBRARIAN_ROLE` | Añadir libros, aprobar/rechazar préstamos |
| `STUDENT_ROLE` | Solicitar préstamos, comprar en tienda, canjear recompensas |

### En la app (middleware + páginas)

| Ruta | Roles permitidos |
|---|---|
| `/dashboard/admin/*` | ADMIN |
| `/dashboard/librarian/*` | LIBRARIAN, ADMIN |
| `/dashboard/professor/*` | PROFESSOR, ADMIN |
| `/dashboard/student/*` | STUDENT, ADMIN |

El ADMIN puede acceder a todas las vistas de todos los roles porque puede ejercer cualquier función de la plataforma.

---

## 10. Convenciones de código

### Nombrado de archivos

- Páginas: `page.tsx` (obligatorio Next.js)
- Layouts: `layout.tsx` (obligatorio Next.js)
- Componentes: PascalCase → `LibraryTable.tsx`, `ItemForm.tsx`
- Server Actions: camelCase de función → `addBook`, `requestLoan`
- Tipos: PascalCase con sufijo descriptivo → `SessionUser`, `UserRole`

### Imports

- `@/lib/...` — configuración de librerías
- `@/actions/...` — Server Actions
- `@/components/...` — componentes React
- `@/types` — tipos compartidos

### Comentarios

Las API routes y Server Actions incluyen comentarios por sección numerados (`─── 1. Nombre ───`) explicando qué hace cada bloque. Los contratos Solidity tienen comentarios NatSpec en funciones públicas.

### Variables de entorno

```
DATABASE_URL         # PostgreSQL connection string (con puerto 5435)
SESSION_SECRET       # Mínimo 32 chars, para iron-session + AES-256-GCM
NEXT_PUBLIC_CHAIN_ID # 31337 para Hardhat local
```

---

## 11. Cómo arrancar el proyecto

### Requisitos previos
- Node.js 20+
- pnpm
- Docker (para PostgreSQL) o PostgreSQL instalado en puerto 5435

### Pasos

```bash
# 1. Instalar dependencias
pnpm install

# 2. Levantar la base de datos (si usas Docker)
docker run --name cryptocampus-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cryptocampusdb -p 5435:5432 -d postgres

# 3. Aplicar migraciones y generar cliente Prisma
cd packages/nextjs
pnpm exec prisma migrate deploy
pnpm exec prisma generate

# 4. Levantar la red Hardhat local (terminal separada)
cd packages/hardhat
pnpm exec hardhat node

# 5. Desplegar contratos
pnpm exec hardhat ignition deploy ignition/modules/CampusModule.ts --network localhost

# 6. Levantar Next.js
cd packages/nextjs
pnpm dev
```

### Puertos
- Next.js: http://localhost:3000
- Hardhat RPC: http://localhost:8545
- PostgreSQL: localhost:5435

---

*Documento mantenido por el equipo de desarrollo. Actualizar cuando se modifiquen contratos, schema o estructura de carpetas.*
