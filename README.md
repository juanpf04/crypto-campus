# CryptoCampus

TFG — Sistema de tokens en la FDI UCM

## Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- [pnpm](https://pnpm.io/) v10+
- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para PostgreSQL local en `localhost:5435`)
- [MetaMask](https://metamask.io/) (extensión de navegador, para interactuar con la DApp)

Si no tienes pnpm instalado:

```bash
npm install -g pnpm@latest-10
```

## Instalación

```bash
git clone https://github.com/juanpf04/CryptoCampus.git
cd CryptoCampus
pnpm install
```

Esto instalará las dependencias de todos los paquetes del monorepo (`packages/hardhat`, `packages/nextjs`, etc.) gracias a [pnpm workspaces](https://pnpm.io/workspaces).

## Quick start (flujo recomendado)

1. Inicia **Docker Desktop** (puede quedarse minimizado).
2. Arranca todo el entorno:

```bash
pnpm dev
```

3. Abre la DApp en `http://localhost:3000`.

> [!WARNING]
> **Docker debe estar corriendo.** Si `docker compose` no está disponible, el comando `pnpm dev` fallará. Asegúrate de tener Docker Desktop abierto antes de ejecutar el comando.

> [!NOTE]
> El comando `pnpm dev` levanta automáticamente la base de datos, compila y despliega los contratos, y arranca el frontend. La primera ejecución puede tardar un poco.

Si quieres resetear la BD en local:

```bash
pnpm run db:reset
```

## Estructura del proyecto

```
CryptoCampus/
├── package.json              # Raíz del monorepo
├── pnpm-workspace.yaml       # Configuración de workspaces
└── packages/
    ├── hardhat/              # Smart contracts (Solidity + Hardhat v3)
    │   ├── contracts/        # Contratos Solidity
    │   ├── test/             # Tests (Node.js + Forge/Foundry)
    │   └── ignition/         # Módulos de despliegue (Hardhat Ignition)
    └── nextjs/               # Frontend (Next.js) — en desarrollo
        ├── app/                ← PÁGINAS Y COMPONENTES
        │   ├── page.tsx            → Página principal de la DApp (UI)
        │   ├── layout.tsx          → Layout raíz (metadata, fuentes)
        │   ├── providers.tsx       → Wagmi + RainbowKit + React Query
        │   └── globals.css         → Estilos globales (Tailwind)
        └── lib/                ← CONFIGURACIÓN WEB3
            ├── counterAbi.ts       → ABI del contrato (interfaz)
            └── wagmiConfig.ts      → Config de cadenas y wallet connect
```

## Smart Contracts (Hardhat)

### Dependencias principales

| Paquete | Uso |
|---|---|
| [Hardhat v3](https://hardhat.org/) | Entorno de desarrollo Solidity |
| [Viem](https://viem.sh/) | Cliente TypeScript para interactuar con contratos |
| [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/) | Librería estándar de contratos seguros (ERC-20, ERC-721, AccessControl, etc.) |
| [Hardhat Ignition](https://hardhat.org/ignition) | Sistema declarativo de despliegue |
| [Forge Std](https://github.com/foundry-rs/forge-std) | Librería de utilidades para tests en Solidity |

### Compilar contratos

```bash
pnpm compile
```

### Ejecutar tests

```bash
pnpm test
```

### Desplegar en red local

Hardhat v3 usa redes **EDR simuladas** (in-process); no necesitas levantar un nodo aparte.

```bash
cd packages/hardhat
pnpm hardhat ignition deploy ignition/modules/Counter.ts --network hardhatMainnet
```

> [!TIP]
> **Para desarrollo local, se puede usar `pnpm dev` desde la raíz**, que automáticamente:
> - Arranca el nodo de Hardhat
> - Despliega los contratos
> - Configura la BD
> 
> No necesitas ejecutar `hardhat node` manualmente ni usar el flag `--network hardhatMainnet` desde `packages/hardhat`.

## DApp Frontend (Next.js)

### Dependencias principales

| Paquete | Uso |
|---|---|
| [Next.js 16](https://nextjs.org/) | Framework React con App Router y SSR |
| [React 19](https://react.dev/) | Librería de interfaz de usuario |
| [wagmi](https://wagmi.sh/) | Hooks de React para interactuar con contratos Ethereum |
| [Viem](https://viem.sh/) | Cliente TypeScript para Ethereum (usado internamente por wagmi) |
| [RainbowKit](https://www.rainbowkit.com/) | Componente de conexión de wallets (MetaMask, WalletConnect, etc.) |
| [TanStack React Query](https://tanstack.com/query) | Caché y gestión de estado asíncrono (requerido por wagmi) |
| [Tailwind CSS 4](https://tailwindcss.com/) | Framework de utilidades CSS |

### Arrancar solo el frontend

```bash
pnpm dev:next
```

> **Nota:** El frontend necesita que el nodo de Hardhat esté corriendo y el contrato desplegado. Usa `pnpm dev` desde la raíz para arrancar todo automáticamente (ver sección _Desarrollo_).

### Build de producción

```bash
pnpm build
pnpm start
```

### Variables de entorno

El frontend necesita un archivo `packages/nextjs/.env` con:

```env
DATABASE_URL="postgresql://root:root@localhost:5435/cryptocampusdb?schema=public"
SESSION_SECRET="tu-secreto-local"
```

`DATABASE_URL` se usa en Prisma y `SESSION_SECRET` para cifrado de claves privadas/sesiones.

> [!IMPORTANT]
> - **`DATABASE_URL`**: Debe coincidir exactamente con la configuración de `docker-compose.yaml` (usuario: `root`, contraseña: `root`, puerto: `5435`, BD: `cryptocampusdb`)
> - **`SESSION_SECRET`**: Cualquier string aleatorio de al menos 32 caracteres.
> - Este archivo **NO se debe subir** al repositorio (está en `.gitignore`).

## Desarrollo — Arrancar todo con un solo comando

```bash
pnpm dev
```

Este comando ejecuta el script [`scripts/dev.mjs`](scripts/dev.mjs), que automáticamente:

1. Levanta PostgreSQL con Docker Compose (`docker compose up -d db`)
2. Arranca un **nodo local de Hardhat** en `http://127.0.0.1:8545`
3. Limpia deployments anteriores para evitar conflictos
4. **Despliega los contratos** del campus con Hardhat Ignition
5. Resincroniza usuarios existentes con blockchain
6. Ejecuta seed del admin por defecto (idempotente)
7. Limpia archivos de impresión expirados
8. Arranca **Next.js** en `http://localhost:3000`

> [!NOTE]
> Para detener todos los procesos: `Ctrl + C`.

> [!WARNING]
> Si Docker no está corriendo, `pnpm dev` abortará con un mensaje de error.

## Configuración de MetaMask

Para interactuar con la DApp en desarrollo necesitas [MetaMask](https://metamask.io/) (extensión del navegador).

### 1. Instalar MetaMask

Descarga e instala la extensión desde [metamask.io/download](https://metamask.io/download/) para tu navegador (Chrome, Firefox, Brave, Edge).

### 2. Añadir la red local de Hardhat

Abre MetaMask → **Configuración** → **Redes** → **Añadir red manualmente** con estos datos:

| Campo | Valor |
|---|---|
| Nombre de la red | `Hardhat Local` |
| URL de RPC | `http://127.0.0.1:8545` |
| ID de cadena | `31337` |
| Símbolo de moneda | `ETH` |

### 3. Importar una cuenta con fondos

El nodo de Hardhat genera cuentas de prueba con 10 000 ETH cada una. Para importar una en MetaMask:

1. Busca en la terminal la lista de cuentas que aparece al arrancar el nodo (Account #0, #1, etc.)
2. Copia la **clave privada** de cualquiera de ellas
3. En MetaMask → **Importar cuenta** → Pega la clave privada

> ⚠️ **Nunca uses estas claves privadas en redes reales.** Son solo para desarrollo local.

### 4. Conectar a la DApp

1. Abre `http://localhost:3000` en tu navegador
2. Haz clic en **"Connect Wallet"** (botón de RainbowKit)
3. Selecciona **MetaMask** y aprueba la conexión
4. Asegúrate de estar en la red **Hardhat Local** (chain ID 31337)

## Comandos disponibles

> [!TIP]
> Ejecuta todos los comandos **desde la raíz del proyecto** (`CryptoCampus/`). No es necesario entrar en `packages/hardhat` o `packages/nextjs`.

### 🚀 Desarrollo principal

| Comando | Descripción |
|---|---|
| `pnpm dev` | Arranca todo: PostgreSQL + nodo Hardhat + deploy contratos + Next.js (recomendado) |
| `pnpm dev:next` | Arranca solo el frontend Next.js (requiere que Hardhat ya esté corriendo) |

### 🗄️ Base de datos (PostgreSQL + Prisma)

| Comando | Descripción |
|---|---|
| `pnpm run db:up` | Levanta el contenedor PostgreSQL en Docker (`docker compose up -d db`) |
| `pnpm run db:down` | Detiene y elimina el contenedor PostgreSQL |
| `pnpm run db:logs` | Muestra logs en vivo del contenedor PostgreSQL |
| `pnpm run db:push` | Sincroniza el esquema Prisma con BD (sin eliminar datos) |
| `pnpm run db:reset` | **Reinicia BD completamente** - elimina datos y sincroniza esquema (`prisma db push --force-reset`) |
| `pnpm run db:generate` | Regenera el cliente Prisma (ejecutar si cambias `schema.prisma`) |
| `pnpm run db:studio` | Abre [Prisma Studio](https://www.prisma.io/studio) en `http://localhost:5555` |

> [!WARNING]
> **`pnpm run db:reset` elimina TODOS los datos de la BD.** Úsalo solo en desarrollo local cuando necesites empezar desde cero. Si solo quieres aplicar cambios al esquema sin perder datos, usa `pnpm run db:push`.

### 🔗 Smart Contracts (Hardhat)

| Comando | Descripción |
|---|---|
| `pnpm compile` | Compila todos los contratos Solidity (`hardhat compile`) |
| `pnpm test` | Ejecuta los tests de contratos (Foundry + Hardhat) |
| `pnpm deploy` | Despliega contratos en red local via Hardhat Ignition |

### 🎨 Frontend (Next.js)

| Comando | Descripción |
|---|---|
| `pnpm build` | Genera build optimizado de producción |
| `pnpm start` | Sirve el build de producción en `http://localhost:3000` |
| `pnpm lint` | Ejecuta ESLint para validar código (`packages/nextjs`) |

