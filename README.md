# CryptoCampus

TFG — Sistema de tokens en la FDI UCM

## Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- [pnpm](https://pnpm.io/) v10+
- [Git](https://git-scm.com/)

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
├── packages/
│   ├── hardhat/              # Smart contracts (Solidity + Hardhat v3)
│   │   ├── contracts/        # Contratos Solidity
│   │   ├── test/             # Tests (Node.js + Forge/Foundry)
│   │   ├── ignition/         # Módulos de despliegue (Hardhat Ignition)
│   │   └── scripts/          # Scripts auxiliares
│   └── nextjs/               # Frontend (Next.js) — en desarrollo
```

## Smart Contracts (Hardhat)

Todos los comandos se ejecutan desde `packages/hardhat`.

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

Hardhat v3 usa redes **EDR simuladas** (in-process); no necesitas levantar un nodo aparte. El proyecto tiene dos redes locales configuradas:

- `hardhatMainnet` — simula una L1 (Ethereum mainnet)
- `hardhatOp` — simula una L2 (OP Stack)

```bash
cd packages/hardhat
pnpm hardhat ignition deploy ignition/modules/Counter.ts --network hardhatMainnet
```

### Variables de entorno

Para desarrollo local **no se necesitan variables de entorno**. Si en el futuro se configuran redes externas (Sepolia, etc.), copia `.env.example` a `.env` y rellena los valores:

```bash
cp packages/hardhat/.env.example packages/hardhat/.env
```

