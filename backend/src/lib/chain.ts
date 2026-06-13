/**
 * Viem clients and chain helpers for Mantle L2.
 * Chains are defined inline to avoid depending on viem's chain registry
 * (which sometimes doesn't export Mantle in older versions).
 */
import { createPublicClient, createWalletClient, http, defineChain, type Address, type Hash, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

// Inline Mantle chain definitions (works regardless of viem version)
export const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.sepolia.mantle.xyz"] } },
  blockExplorers: { default: { name: "Mantlescan", url: "https://sepolia.mantlescan.xyz" } },
  testnet: true,
});

export const mantleMainnet = defineChain({
  id: 5000,
  name: "Mantle",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mantle.xyz"] } },
  blockExplorers: { default: { name: "Mantlescan", url: "https://mantlescan.xyz" } },
});

const RPC_URL = process.env.MANTLE_RPC_URL ?? "https://rpc.sepolia.mantle.xyz";
const IS_MAINNET = RPC_URL.includes("rpc.mantle.xyz") && !RPC_URL.includes("sepolia");

export const chain = IS_MAINNET ? mantleMainnet : mantleSepolia;

export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL, { batch: { batchSize: 100, wait: 16 } }),
  batch: { multicall: true },
});

const PK = (process.env.ORACLE_PRIVATE_KEY ?? "0x" + "0".repeat(64)) as Hex;
export const oracleAccount = privateKeyToAccount(PK);

export const oracleClient = createWalletClient({
  account: oracleAccount,
  chain,
  transport: http(RPC_URL),
});

export function getAddress(name: string): Address {
  const v = process.env[name];
  if (!v || v === "0x0000000000000000000000000000000000000000") {
    throw new Error(`env ${name} not set`);
  }
  return v as Address;
}

export function getAddressOpt(name: string): Address | undefined {
  const v = process.env[name];
  if (!v || v === "0x0000000000000000000000000000000000000000") return undefined;
  return v as Address;
}

export async function waitForReceipt(hash: Hash) {
  return publicClient.waitForTransactionReceipt({ hash });
}
