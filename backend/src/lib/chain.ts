/**
 * Viem clients and chain helpers for Mantle L2.
 */
import { createPublicClient, createWalletClient, http, type Address, type Hash, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantle, mantleSepolia } from "viem/chains";
import "dotenv/config";

const RPC_URL = process.env.MANTLE_RPC_URL ?? "https://rpc.sepolia.mantle.xyz";
const IS_MAINNET = RPC_URL.includes("rpc.mantle.xyz") && !RPC_URL.includes("sepolia");

export const chain = IS_MAINNET ? mantle : mantleSepolia;

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
