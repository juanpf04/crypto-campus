# CryptoCampus — Documentación técnica para la memoria del TFG

## 1. Qué es CryptoCampus

CryptoCampus es una **aplicación descentralizada (dApp)** universitaria que integra servicios del campus (biblioteca, tienda, insignias, impresión, salas de estudio) con contratos inteligentes en blockchain Ethereum. El término "descentralizada" se refiere a que la lógica de negocio crítica (balances, préstamos, compras, acuñación de tokens) se ejecuta en contratos inteligentes inmutables en la blockchain, proporcionando transparencia y trazabilidad de las operaciones.

Sin embargo, a diferencia de una dApp pura donde los usuarios gestionan sus propias wallets (MetaMask, etc.), CryptoCampus utiliza un modelo de **wallets custodiales**: el servidor genera y gestiona las claves privadas de los usuarios, cifradas con AES-256-GCM. Esto permite una experiencia de usuario convencional (login con email/contraseña) mientras mantiene las garantías de la blockchain como registro de verdad inmutable.

---

## 2. Arquitectura: Monorepo con pnpm Workspaces

El proyecto se organiza como un **monorepo** — un único repositorio que contiene múltiples paquetes independientes pero coordinados.

### ¿Qué implica ser un monorepo?

- **Dependencias compartidas**: pnpm gestiona las dependencias de ambos paquetes desde un único lockfile (`pnpm-lock.yaml`), evitando duplicidades y garantizando versiones consistentes.
- **Scripts unificados**: Desde la raíz se puede compilar, testear y desplegar todo con un solo comando (`pnpm dev`).
- **Aislamiento de paquetes**: Cada paquete tiene su propio `package.json`, `tsconfig`, y puede evolucionar independientemente.
- **Compilación cruzada**: El paquete de Next.js importa directamente los artefactos compilados del paquete de Hardhat (ABIs), creando un vínculo tipado entre ambas capas.

### Estructura del repositorio

```
CryptoCampus/
├── package.json                 # Workspace root — scripts globales
├── pnpm-workspace.yaml          # Configuración del monorepo
├── docker-compose.yaml          # PostgreSQL para desarrollo
│
├── packages/hardhat/            # Capa blockchain
│   ├── contracts/               # 9 contratos Solidity (2.711 LOC)
│   ├── test/                    # 9 suites de tests (4.183 LOC)
│   ├── ignition/modules/        # Despliegue declarativo
│   └── artifacts/               # ABIs compilados (auto-generados)
│
└── packages/nextjs/             # Capa web (full-stack)
    ├── prisma/schema.prisma     # 20 modelos de base de datos
    ├── src/
    │   ├── actions/             # Server Actions — lógica de negocio (4.754 LOC)
    │   ├── app/                 # App Router — 70 páginas + 65 API routes
    │   ├── components/          # 97 componentes React
    │   ├── lib/                 # Utilidades (sesión, crypto, viem, prisma, rate-limit)
    │   ├── hooks/               # Custom React hooks
    │   ├── contexts/            # React Contexts (Toast, Theme, Cart)
    │   └── types/               # Definiciones TypeScript
    └── scripts/                 # Seeds y utilidades de desarrollo
```

---

## 3. Stack tecnológico

### Capa blockchain

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| Solidity | 0.8.28 | Lenguaje de contratos inteligentes |
| Hardhat | 3.1.10 | Entorno de desarrollo y testing para Ethereum |
| Hardhat Ignition | 3.0.8 | Sistema declarativo de despliegue de contratos |
| OpenZeppelin Contracts | 5.6.1 | Librería de contratos estándar auditados (ERC-20, ERC-1155, AccessControl, etc.) |
| Viem | 2.46.3 | Cliente blockchain tipado para TypeScript |
| Forge-std | 1.9.4 | Utilidades de testing para Foundry/Solidity |

### Capa web (frontend + backend)

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| Next.js | 16.1.6 | Framework full-stack React con App Router |
| React | 19.2.3 | Librería de interfaz de usuario |
| TypeScript | 5.8.3 | Tipado estático en todo el proyecto |
| Tailwind CSS | 4 | Framework CSS utility-first |
| Prisma | 7.4.2 | ORM para PostgreSQL con cliente tipado |
| PostgreSQL | 15 | Base de datos relacional (via Docker) |
| iron-session | 8.0.4 | Sesiones cifradas en cookies httpOnly |
| bcryptjs | 3.0.3 | Hashing de contraseñas con salt |
| Recharts | 3.8.1 | Librería de gráficos para dashboards |
| pnpm | 10.33 | Gestor de paquetes eficiente para monorepos |
| ESLint | 9 | Linter de código |

---

## 4. Contratos inteligentes

### 4.1 Estándares ERC utilizados

- **ERC-20** (`LibraryToken`, `ShopToken`): Tokens fungibles que representan créditos. LibraryToken es el depósito para préstamos (1 token = 1 slot de préstamo). ShopToken es la moneda de la tienda.
- **ERC-1155** (`LibraryManager`, `CampusShop`, `BadgeSystem`): Tokens multi-tipo. Permite que un único contrato gestione múltiples tipos de activos (libros, productos, insignias) donde cada `tokenId` representa un tipo y la cantidad representa copias/unidades.
- **AccessControl** de OpenZeppelin (`CampusRoles`): Gestión de roles on-chain. Define 4 roles (STUDENT, PROFESSOR, LIBRARIAN, ADMIN) con permisos granulares.

### 4.2 Contratos del sistema

| Contrato | Estándar | LOC | Función |
|----------|----------|-----|---------|
| `CampusRoles` | AccessControl + Pausable | 271 | Control de acceso basado en roles. Punto central de permisos. |
| `LibraryToken` | ERC-20 + Pausable | 110 | Token de depósito para préstamos. 0 decimales (unidades enteras). trustedSpender para operaciones sin approve. |
| `ShopToken` | ERC-20 + Pausable | 114 | Token de pago para la tienda. Mismo patrón que LibraryToken. |
| `LibraryManager` | ERC-1155 + ERC1155Supply + ReentrancyGuard + Pausable | 532 | Gestión de catálogo y préstamos. Cola FIFO automática. Cada tokenId = un título; las copias son la cantidad del token. |
| `CampusShop` | ERC-1155 + ERC1155Supply + ReentrancyGuard + Pausable | 468 | Tienda con productos, compras individuales y por lotes (batches). Devoluciones con recibos NFT. |
| `BadgeSystem` | ERC-1155 + ERC1155Supply + Pausable | 504 | Insignias académicas (soulbound — no transferibles). Profesores crean tareas, alumnos ganan badges, canjean por recompensas. |
| `Printer` | Pausable | 137 | Créditos de impresión. 1 crédito = 1 página. Admin/Librarian tienen créditos ilimitados. Máx 50 páginas/trabajo. |
| `RoomBooking` | ReentrancyGuard + Pausable | 271 | Reserva de salas de estudio. Slots por hora. Máx 4h consecutivas, 1 reserva/día/estudiante. |

### 4.3 Estándar de estilo Solidity

Todos los contratos siguen el [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html):

```
1. Type declarations (structs, enums)
2. State variables
3. Events
4. Errors (custom errors, no require con strings)
5. Modifiers
6. Functions:
   a. Constructor
   b. External (mutables, luego view/pure)
   c. Public (mutables, luego view/pure)
   d. Internal
   e. Private
```

### 4.4 Patrones de seguridad en contratos

- **CEI (Checks-Effects-Interactions)**: Todas las funciones verifican condiciones, actualizan estado y después hacen llamadas externas. Previene reentrancia.
- **ReentrancyGuard**: Aplicado en funciones con transferencias ERC-1155 (`LibraryManager`, `CampusShop`, `RoomBooking`).
- **Pausable**: Todos los contratos pueden pausarse por el admin en caso de emergencia.
- **Custom errors**: En vez de `require("mensaje")`, se usan errores tipados (`error NotStudent(address)`) que consumen menos gas y son más informativos.
- **Restricción de transferencias**: `LibraryManager` sobrescribe `_update()` para impedir transferencias directas entre usuarios; solo el contrato puede mediar.

---

## 5. Patrón de doble base de datos (blockchain + PostgreSQL)

CryptoCampus emplea un modelo de **doble ledger**:

- **Blockchain (verdad inmutable)**: IDs on-chain, balances, estados de préstamos, transacciones de compra, depósitos. Sirve como registro de auditoría y garantiza que los datos no pueden manipularse.
- **PostgreSQL (metadatos ricos)**: Nombres, descripciones, imágenes, emails, contraseñas, relaciones complejas. Permite queries SQL eficientes, paginación y búsqueda.

Cada entidad tiene un **ID dual**: un `id` CUID en Prisma y un `tokenId`/`loanId`/`orderId` numérico on-chain. Los `txHash` (hashes de transacción) vinculan ambos mundos.

### Reconciliación

Si una transacción blockchain tiene éxito pero el guardado en Prisma falla, el sistema registra el `txHash` para reconciliación manual mediante la función `logPrismaRecovery()`.

---

## 6. Patrón de wallets custodiales

En vez de requerir que los usuarios instalen MetaMask y gestionen sus propias claves privadas:

1. Al registrarse, el servidor genera una clave privada con `generatePrivateKey()` de Viem.
2. La clave se cifra con **AES-256-GCM** (IV aleatorio único por usuario) usando `process.env.SESSION_SECRET`.
3. Se almacena como `encryptedKey` en la tabla `User` de PostgreSQL.
4. Cuando el usuario necesita firmar una transacción (ej: solicitar préstamo), el servidor descifra la clave, crea un `WalletClient` temporal y firma.
5. Para operaciones administrativas (aprobar préstamos, crear productos), se usa la wallet del admin (Account #0 de Hardhat).

**Ventaja**: UX convencional (email + contraseña). **Trade-off**: El servidor custodia las claves.

---

## 7. Arquitectura frontend: Atomic Design

Los componentes siguen el patrón **Atomic Design** de Brad Frost:

### Átomos (`components/ui/`) — 35 componentes

Elementos UI mínimos e independientes del dominio: `Button`, `Input`, `Card`, `Badge`, `Spinner`, `Modal`, `Table`, `Pagination`, etc. Cada uno acepta variantes (`variant="primary"`, `size="sm"`) y un prop `className` para composición.

### Moléculas y Organismos (`components/shared/`) — 21 componentes

Componen átomos para crear elementos con significado de negocio: `StatCard`, `StatusBadge`, `LoanCard`, `LibraryItemCard`, `ProductCard`, `BookingCard`, etc.

### Templates y Páginas (`app/(main)/`)

Las páginas componen moléculas/organismos con datos reales obtenidos de la API.

### Barrel exports

Cada directorio de componentes tiene un `index.ts` que re-exporta todo:
```ts
export { Button } from "./Button";
export { Card, CardHeader, CardBody } from "./Card";
```
Esto permite importar desde un único punto: `import { Button, Card } from "@/components/ui"`.

---

## 8. Patrón de Server Actions

Next.js Server Actions son funciones marcadas con `"use server"` que se ejecutan en el servidor. CryptoCampus las usa como **capa de coordinación** entre blockchain y base de datos:

```
Frontend (React) → API Route → Server Action → Blockchain + Prisma
```

Cada Server Action:
1. Verifica autenticación y autorización (`getSession()`, `ensureRole()`)
2. Valida inputs
3. Ejecuta la transacción blockchain (`writeContract()`)
4. Espera confirmación (`waitForTransactionReceipt()`)
5. Guarda metadata en Prisma
6. Devuelve resultado

Los helpers `getSession()`, `ensureRole()` y `logPrismaRecovery()` están centralizados en `lib/action-utils.ts` para evitar duplicación.

### API Routes como thin wrappers

Las rutas API (`app/api/...`) son wrappers mínimos que:
1. Extraen parámetros del request
2. Llaman al Server Action correspondiente
3. Transforman errores en códigos HTTP apropiados (`401`, `403`, `500`)

---

## 9. Autenticación y seguridad

### Sesiones

- **iron-session**: Cookies cifradas y firmadas. No requiere base de datos de sesiones.
- Flags: `httpOnly` (previene XSS), `sameSite: "lax"` (previene CSRF), `secure` en producción.
- Datos en sesión: `userId`, `address` (wallet), `role`.

### Protección de rutas

- **Middleware** (`proxy.ts`): Intercepta todas las requests a rutas protegidas. Redirige a `/login?returnUrl=...` si no autenticado.
- **Server Actions**: Cada acción verifica rol con `ensureRole()`. Distingue entre "No autenticado" (401) y "No autorizado" (403).
- **Contratos**: Modifiers `onlyStudent()`, `onlyLibrarian()`, `onlyAdmin()` verifican roles on-chain.

### Rate limiting

Endpoint `/api/auth/login` protegido con rate limiter en memoria:
- Login: 10 intentos/minuto por IP
- Respuesta: HTTP 429 con header `Retry-After`

### Cifrado

- **Contraseñas**: bcrypt con salt (12 rondas)
- **Claves privadas**: AES-256-GCM con IV aleatorio único por usuario
- **Sesiones**: Cifrado simétrico via iron-session

---

## 10. Sistema de testing dual

### Tests TypeScript (node:test)

Framework nativo de Node.js. Patrón:
```ts
describe("LibraryManager", function () {
  async function deploySystem() { /* despliega contratos frescos */ }
  it("Should execute loan flow", async function () {
    const { libraryManager } = await deploySystem();
    // ... assertions con assert.equal()
  });
});
```

### Tests Solidity (Foundry/forge-std)

Tests escritos en Solidity. Patrón:
```solidity
contract LibraryManagerTest is Test {
  function setUp() public { /* deploy + setup */ }
  function test_RequestLoan() public {
    vm.prank(student); // simular msg.sender
    libraryManager.requestLoan(1);
    assertEq(...);
  }
}
```

### Cobertura

| Módulo | Tests TS | Tests Sol | Total |
|--------|---------|-----------|-------|
| CampusRoles | 37 | 0 | 37 |
| LibraryToken | 17 | 0 | 17 |
| ShopToken | 17 | 0 | 17 |
| LibraryManager | 33 | 20 | 53 |
| CampusShop | 40 | 28 | 68 |
| BadgeSystem | 64 | 40 | 104 |
| Printer | 34 | 16 | 50 |
| RoomBooking | 22 | 20 | 42 |
| Integración | 10 | 15 | 25 |
| **Total** | **274** | **139** | **413** |

---

## 11. Flujo de desarrollo

Un solo comando arranca todo el entorno:

```bash
pnpm dev
```

Este comando ejecuta `scripts/dev.mjs` que orquesta:

1. `docker compose up -d db` — Levanta PostgreSQL
2. `npx hardhat node` — Arranca nodo local Ethereum
3. Limpia deployments anteriores
4. `npx hardhat ignition deploy` — Despliega los 8 contratos
5. `setTrustedSpender()` — Configura permisos entre contratos
6. Scripts de seed — Crea admin, productos, biblioteca, salas
7. `npx next dev` — Arranca el servidor web

---

## 12. Métricas del proyecto

| Métrica | Valor |
|---------|-------|
| Contratos Solidity | 9 ficheros, 2.711 LOC |
| Tests de contratos | 9 suites, 4.183 LOC, 413 tests |
| Server Actions | 6 módulos, 4.754 LOC |
| Páginas (routes) | 70 page.tsx |
| API endpoints | 65 route.ts |
| Componentes React | 97 ficheros |
| Modelos de base de datos | 20 modelos Prisma |
| Dependencias producción | 14 |
| Dependencias desarrollo | 18 |
