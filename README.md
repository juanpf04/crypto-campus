# CryptoCampus

TFG — Sistema de tokens en la FDI UCM

## Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- [pnpm](https://pnpm.io/) v10+
- [Git](https://git-scm.com/)
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

El frontend necesita un archivo `packages/nextjs/.env.local` con:

```env
NEXT_PUBLIC_COUNTER_ADDRESS=0x...   # Dirección del contrato desplegado
```

> El script `pnpm dev` genera este archivo automáticamente tras desplegar el contrato.

## Desarrollo — Arrancar todo con un solo comando

```bash
pnpm dev
```

Este comando ejecuta el script [`scripts/dev.mjs`](scripts/dev.mjs), que automáticamente:

1. Arranca un **nodo local de Hardhat** en `http://127.0.0.1:8545`
2. Limpia deployments anteriores para evitar conflictos
3. **Despliega el contrato** Counter con Hardhat Ignition
4. Escribe la **dirección del contrato** en `packages/nextjs/.env.local`
5. Arranca **Next.js** en `http://localhost:3000`

Para detener todos los procesos: `Ctrl + C`.

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

## Comandos disponibles (raíz del monorepo)

| Comando | Descripción |
|---|---|
| `pnpm dev` | Arranca nodo Hardhat + deploy + Next.js (todo en uno) |
| `pnpm dev:next` | Arranca solo el frontend Next.js |
| `pnpm compile` | Compila los smart contracts |
| `pnpm test` | Ejecuta los tests de los contratos |
| `pnpm deploy` | Despliega contratos en red local |
| `pnpm build` | Build de producción del frontend |
| `pnpm start` | Sirve el build de producción |
| `pnpm lint` | Ejecuta el linter del frontend |

