# CryptoCampus

TFG — Plataforma universitaria sobre blockchain para la FDI UCM. Integra 5 módulos (biblioteca, tienda, insignias académicas, impresión, salas de estudio) con contratos inteligentes como capa de verdad y PostgreSQL para metadatos.

## Tabla de contenidos

- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Quick start](#quick-start)
- [Modelo custodial — no necesitas MetaMask](#modelo-custodial--no-necesitas-metamask)
- [Motor blockchain: Anvil vs Hardhat](#motor-blockchain-anvil-vs-hardhat)
- [Flujos típicos](#flujos-típicos)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Módulos funcionales](#módulos-funcionales)
- [Roles del sistema](#roles-del-sistema)
- [Sistema de recompensas automáticas](#sistema-de-recompensas-automáticas)
- [Variables de entorno](#variables-de-entorno)
- [Comandos disponibles](#comandos-disponibles)
- [Tests](#tests)
- [Troubleshooting](#troubleshooting)
- [Documentación adicional](#documentación-adicional)

## Requisitos previos

- **Node.js 24.15.0** (recomendado con [`nvm`](https://github.com/nvm-sh/nvm))
- **pnpm 10.33.0** (via [`corepack`](https://pnpm.io/installation#using-corepack))
- **Docker Desktop** corriendo (PostgreSQL en `localhost:5435`)
- **Foundry** para Anvil, motor blockchain por defecto. Instalar desde Git Bash:
  ```bash
  curl -L https://foundry.paradigm.xyz | bash && foundryup
  anvil --version   # verificar
  ```
  Si no puedes usar Foundry en tu entorno, puedes forzar Hardhat con `pnpm dev:hardhat` (ver _Motor blockchain_ más abajo).

Si usas nvm:
```bash
nvm install
nvm use
```

Si no tienes pnpm:
```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate
```

## Instalación

```bash
git clone https://github.com/juanpf04/CryptoCampus.git
cd CryptoCampus
pnpm install
```

Esto instalará las dependencias de todos los paquetes del monorepo (`packages/hardhat`, `packages/nextjs`) gracias a [pnpm workspaces](https://pnpm.io/workspaces).

Crea el archivo `packages/nextjs/.env` (ver [_Variables de entorno_](#variables-de-entorno)).

## Quick start

```bash
pnpm dev
```

Abre la DApp en `http://localhost:3000`.

> [!NOTE]
> Un único comando: levanta PostgreSQL, arranca el nodo blockchain, despliega contratos si hace falta, ejecuta los seeds y arranca Next.js.
>
> En el **primer arranque** descargará artefactos y ejecutará todos los seeds (tarda algo más). En arranques sucesivos con Anvil persistente, los contratos ya están desplegados y los seeds detectan todo como existente → arranque rápido.

> [!WARNING]
> **Docker debe estar corriendo.** Si `docker compose` no está disponible, el comando `pnpm dev` fallará. Asegúrate de tener Docker Desktop abierto antes.

### Credenciales semilla (tras seed)

Los scripts de seed crean automáticamente cuentas de demostración con contraseña `password123`:

| Rol | Email |
|---|---|
| Admin | `admin@ucm.es` |
| Profesor | cualquiera de los creados en `seed-academic.mjs` |
| Bibliotecario | `librarian@ucm.es` |
| Alumno | cualquiera de los creados en `seed-academic.mjs` |

## Modelo custodial — no necesitas MetaMask

CryptoCampus es una **dApp custodial**: las wallets se generan en el servidor y se guardan cifradas (AES-256-GCM con `SESSION_SECRET`). Los usuarios se registran y entran con **email + contraseña** convencionales; nunca ven ni gestionan su clave privada. Internamente, el backend firma las transacciones de blockchain por ellos.

Por eso **no hace falta instalar MetaMask ni configurar una red**. El único motor Ethereum que participa es el nodo local (Anvil o Hardhat) que levanta `pnpm dev`.

## Motor blockchain: Anvil vs Hardhat

Por defecto `pnpm dev` arranca **Anvil** (de Foundry) con estado persistente en `.anvil-state.json`. Al reiniciar conserva contratos, balances y cualquier cambio on-chain. Auto-guarda cada 30 s.

Para usar **Hardhat node** (volátil — pierde el estado al parar):
- **Atajo cross-platform**: `pnpm dev:hardhat`
- **Por flag**: `node scripts/dev.mjs --hardhat`
- **Por env var** (Git Bash / Linux / macOS): `BLOCKCHAIN_NODE=hardhat pnpm dev`

Al cambiar de motor ejecuta `pnpm reset:all` para evitar divergencia entre el estado on-chain y Prisma.

## Flujos típicos

| Escenario | Comando |
|---|---|
| Día a día (estado persistido con Anvil) | `pnpm dev` |
| Primer arranque o reinstalación | `pnpm install && pnpm dev:fresh` |
| He tocado un contrato `.sol` | `pnpm compile && pnpm dev:fresh` |
| He tocado `schema.prisma` con cambio destructivo | `pnpm dev:fresh` |
| Compañero clonó el repo | `pnpm install && pnpm dev` |
| Re-ejecutar seeds sin reiniciar | `pnpm db:seed` |

## Estructura del proyecto

```
CryptoCampus/
├── package.json                   Workspace root — scripts globales
├── pnpm-workspace.yaml            Configuración del monorepo
├── docker-compose.yaml            PostgreSQL para desarrollo
├── scripts/
│   ├── dev.mjs                    Orquestador de arranque
│   ├── seed.mjs                   Lanzador de todos los seeds
│   └── reset-chain.mjs            Borra estado on-chain local
│
└── packages/
    ├── hardhat/                   Capa blockchain
    │   ├── contracts/             8 contratos Solidity (+ Example.sol, guía de estilo)
    │   ├── test/                  Tests (TypeScript + Foundry)
    │   └── ignition/modules/      Despliegue declarativo (CampusModule.ts)
    │
    └── nextjs/                    Capa web (full-stack)
        ├── prisma/schema.prisma   27 modelos de base de datos
        ├── scripts/               10 scripts idempotentes (seeds + resync + cleanup)
        └── src/
            ├── actions/           8 módulos de Server Actions
            ├── app/               App Router (121 pages + 110 API routes)
            ├── components/
            │   ├── ui/            Atoms (36)
            │   ├── shared/        Molecules (49)
            │   ├── forms/         Form molecules (13)
            │   ├── dashboard/     Organisms (13)
            │   └── layout/        Layout (Header, Sidebar, ...)
            ├── hooks/             useAuthUser, useForm, usePaginatedList, useToast, useTheme
            ├── lib/               viem, prisma, crypto, session, shopRewards, ...
            └── contexts/          CartContext, OnboardingContext, ThemeContext, ToastContext
```

## Módulos funcionales

CryptoCampus integra cinco módulos independientes pero interconectados a través del sistema de tokens:

| Módulo | Qué hace | Token usado |
|---|---|---|
| **Biblioteca** | Catálogo de libros, juegos de mesa y videojuegos. Sistema de reservas, recogida y devolución. Cola FIFO cuando el ítem está agotado. | `LibraryToken` (LIB) — 1 LIB por préstamo activo |
| **Tienda** | Catálogo con productos, variantes por color, carrito, compras en lote (batches) y devoluciones con recibos. | `ShopToken` (SHPT) |
| **Insignias académicas** | Profesores crean tareas con premios; alumnos reciben insignias soulbound (no transferibles) al ganar. Las insignias se canjean por recompensas definidas por el profesor. | `BadgeSystem` (1155 soulbound) |
| **Impresión** | Créditos por alumno, simulador de impresión con opciones (color/B&N, dúplex, páginas/hoja). Admin/bibliotecario con créditos ilimitados. | `Printer` — 1 crédito = 1 página |
| **Salas de estudio** | Reserva por franja horaria. Máx 4 h consecutivas, 1 reserva por día por alumno. Códigos QR para confirmar llegada. | `RoomBooking` |

Cada módulo da **recompensas automáticas en SHPT** al usarlo (ver sección de recompensas).

## Roles del sistema

| Rol | Ruta base | Qué puede hacer |
|---|---|---|
| **Estudiante** (`STUDENT`) | `/student/*` | Ver y usar todos los módulos: pedir préstamos, comprar, ganar insignias, imprimir, reservar salas |
| **Profesor** (`PROFESSOR`) | `/professor/*` | Crear tareas con premios en sus asignaturas, aprobar entregas y otorgar insignias, crear recompensas, gestionar solicitudes de uso |
| **Bibliotecario** (`LIBRARIAN`) | `/librarian/*` | Gestionar catálogo de biblioteca, aprobar reservas y recogidas, confirmar devoluciones, gestionar salas e impresoras |
| **Admin** (`ADMIN`) | `/admin/*` | Todo lo anterior + gestión de usuarios, asignaturas y grupos, productos de tienda, visualización global de stats y transacciones |

El admin tiene acceso a todas las vistas de todos los roles y puede ejecutar cualquier acción. El middleware (`proxy.ts`) garantiza que un usuario solo acceda a las rutas de su rol.

## Sistema de recompensas automáticas

Cada vez que un usuario completa una acción "premiable", el backend mintea automáticamente **ShopTokens (SHPT)** a su wallet sin intervención manual. Helper central en [`packages/nextjs/src/lib/shopRewards.ts`](packages/nextjs/src/lib/shopRewards.ts).

| Acción | Cantidad (SHPT) |
|---|---|
| Devolver préstamo a tiempo | 2 |
| Devolver préstamo antes del plazo | 3 |
| Reservar una sala | 1 |
| Recibir una insignia académica | 5 (por cada badge) |
| Trabajo de impresión | páginas ÷ 10 |
| Bonus primer uso del módulo (library/rooms/printing/badges/shop) | 2 cada uno, una sola vez |

La recompensa se persiste en `ShopTokenReward` (auditoría) y se pinta en toast en el cliente. Ver [`shopRewardsMeta.ts`](packages/nextjs/src/lib/shopRewardsMeta.ts) para el catálogo completo.

## Variables de entorno

El frontend necesita un archivo `packages/nextjs/.env`:

```env
DATABASE_URL="postgresql://root:root@localhost:5435/cryptocampusdb?schema=public"
SESSION_SECRET="tu-secreto-local-de-al-menos-32-caracteres"
```

> [!IMPORTANT]
> - `DATABASE_URL` debe coincidir con `docker-compose.yaml` (usuario `root`, contraseña `root`, puerto `5435`, BD `cryptocampusdb`).
> - `SESSION_SECRET` se usa tanto para cifrar las cookies como para cifrar las claves privadas de los usuarios. Cualquier string aleatorio de **≥32 caracteres**.
> - Este archivo **no se sube al repositorio** (está en `.gitignore`).

## Comandos disponibles

> Ejecuta todos los comandos **desde la raíz del proyecto**. No hace falta entrar en `packages/hardhat` ni `packages/nextjs`.

### Arranque

| Comando | Descripción |
|---|---|
| `pnpm dev` | Stack completo con **Anvil por defecto** (estado persistente) |
| `pnpm dev:hardhat` | Igual pero fuerza **Hardhat node** (volátil) |
| `pnpm dev:fresh` | `pnpm dev` empezando de cero: resetea BD + borra estado blockchain |
| `pnpm dev:next` | Solo Next.js (requiere que el nodo ya esté arriba) |
| `pnpm db:seed` | Re-ejecuta todos los seeds (idempotentes) sin reiniciar |

### Reset

| Comando | Descripción |
|---|---|
| `pnpm reset:chain` | Borra `.anvil-state.json` + `ignition/deployments/`. Próximo `pnpm dev` redesplegará contratos. **No toca BD.** |
| `pnpm db:reset` | Wipea BD y resincroniza schema Prisma. **No toca blockchain.** |
| `pnpm reset:all` | `reset:chain` + `db:reset`. Deja el entorno listo para poblar de nuevo. |

### Base de datos (PostgreSQL + Prisma)

| Comando | Descripción |
|---|---|
| `pnpm run db:up` / `db:down` | Levanta / detiene el contenedor PostgreSQL |
| `pnpm run db:logs` | Logs en vivo del contenedor |
| `pnpm run db:push` | Sincroniza el schema Prisma con la BD (sin eliminar datos) |
| `pnpm run db:generate` | Regenera el cliente Prisma (tras editar `schema.prisma`) |
| `pnpm run db:studio` | Abre [Prisma Studio](https://www.prisma.io/studio) en `http://localhost:5555` |

> [!WARNING]
> `pnpm run db:reset` / `pnpm dev:fresh` borran **todos** los datos de la BD. Úsalos solo en local cuando necesites empezar desde cero.

### Smart Contracts

| Comando | Descripción |
|---|---|
| `pnpm compile` | Compila todos los contratos Solidity |
| `pnpm test` | Tests de contratos (TypeScript + Foundry) |
| `pnpm deploy` | Despliega los contratos desde cero con Ignition (útil para debugging) |

### Frontend

| Comando | Descripción |
|---|---|
| `pnpm build` | Build optimizado de producción |
| `pnpm start` | Sirve el build en `http://localhost:3000` |
| `pnpm lint` | ESLint sobre `packages/nextjs/src` |

## Tests

El proyecto incluye dos conjuntos de tests para los contratos:

- **Tests TypeScript** (`node:test`): instancian contratos frescos por suite, usan `viem` para llamadas y `assert` para comprobaciones.
- **Tests Solidity** (Foundry/forge-std): invariantes y casos edge escritos directamente en Solidity (`vm.prank`, `vm.expectRevert`, etc.).

Ambos se ejecutan con `pnpm test`. Cubren los 8 contratos de producción + tests de integración cross-contract.

> No hay tests E2E ni de componentes para la parte Next.js — la validación del frontend se hace a través de `tsc` (type-check) + `next build` (validación de rutas/SSR) + pruebas manuales.

## Troubleshooting

**`pnpm dev` falla con "docker compose no encontrado"**
Docker Desktop no está corriendo. Ábrelo y espera a que el icono de la bandeja diga "Docker is running".

**`anvil: command not found`**
No tienes Foundry instalado. Instálalo con `curl -L https://foundry.paradigm.xyz | bash && foundryup` (Git Bash en Windows) o ejecuta `pnpm dev:hardhat` para usar Hardhat en su lugar.

**La DApp arranca pero muestra "No autenticado" al loguear**
La BD está vacía o no tiene el admin semilla. Ejecuta `pnpm db:seed` o `pnpm dev:fresh` para repoblar.

**Transacciones on-chain fallan con "insufficient funds"**
Tu estado de Anvil está desincronizado con Prisma (p. ej. reinstalaste dependencias sin `pnpm reset:all`). Ejecuta `pnpm reset:all` y luego `pnpm dev`.

**Cambié un contrato y `pnpm dev` no lo recoge**
Los contratos ya desplegados no se redespliegan automáticamente. Ejecuta `pnpm compile && pnpm dev:fresh` para forzar redeploy.

**Puerto 5435 ocupado al arrancar Docker**
Otra instancia de PostgreSQL está corriendo. Para la local con `pnpm run db:down` y luego `pnpm dev`.

**Quiero ver los datos de la BD**
Abre [Prisma Studio](https://www.prisma.io/studio) con `pnpm run db:studio` → `http://localhost:5555`.

**Error de tipado en el cliente Prisma tras cambiar el schema**
Has editado `schema.prisma` pero no has regenerado el cliente. Ejecuta `pnpm run db:generate`.

## Documentación adicional

- [TFG-DOCUMENTACION-TECNICA.md](./TFG-DOCUMENTACION-TECNICA.md) — Explicación técnica orientada a la memoria del TFG: contratos, doble ledger, Atomic Design, Server Actions, testing, recompensas.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Referencia arquitectónica exhaustiva: estructura de carpetas detallada, flujos de datos end-to-end, convenciones de código, tabla de rutas API.
- [CLAUDE.md](./CLAUDE.md) — Guía interna para trabajar con Claude Code en este proyecto (comandos, convenciones, detalles operacionales).
- [packages/nextjs/RUTAS.md](./packages/nextjs/RUTAS.md) — Tabla exhaustiva de rutas de páginas por rol.
- [packages/nextjs/API_ACCESS_AUDIT.md](./packages/nextjs/API_ACCESS_AUDIT.md) — Auditoría de control de acceso en endpoints.
