import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";

// Account[0] de Hardhat — el deployer/admin con fondos ilimitados
const HARDHAT_ACCOUNT_0_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

export const adminAccount = privateKeyToAccount(HARDHAT_ACCOUNT_0_KEY);

export const adminWalletClient = createWalletClient({
  account: adminAccount,
  chain: hardhat,
  transport: http(),
});

export const publicClient = createPublicClient({
  chain: hardhat,
  transport: http(),
});