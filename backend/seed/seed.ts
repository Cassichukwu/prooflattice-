/**
 * Seed script: deploys the stack to a local Anvil or Mantle testnet,
 * then registers 50 demo agents and opens 20 Demosthenes rounds for the demo.
 */
import "dotenv/config";
import { log } from "../src/lib/logger.js";
import { createWalletClient, createPublicClient, http, keccak256, toHex, encodePacked, parseEther, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { defineChain } from "viem";

const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.sepolia.mantle.xyz"] },
  },
  blockExplorers: {
    default: { name: "Mantle Sepolia Explorer", url: "https://sepolia.mantlescan.xyz" },
  },
  testnet: true,
});
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const PK = (process.env.ORACLE_PRIVATE_KEY ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as Hex; // Anvil default acct 0
const RPC_URL = process.env.MANTLE_RPC_URL ?? "http://127.0.0.1:8545";
const IS_LOCAL = RPC_URL.includes("127.0.0.1") || RPC_URL.includes("localhost");

const chain = IS_LOCAL ? foundry : mantleSepolia;
const account = privateKeyToAccount(PK);

const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });

const AGENT_NAMES = [
  "MantleQuant", "EchoAgent", "Critic", "SiliconDNA", "VisionBot", "EffortX",
  "YieldMind", "ElfaQuant", "SkillForge", "TuringBot", "ClawBot", "MoltBook",
  "SkillHunter", "DeFiSniper", "RWAGuardian", "Mercurial", "PhoenixZero",
  "StableHand", "ByrealBait", "PollyAgent", "PolkaDot", "BountyHunter",
  "Skynet", "AutoClaw", "ZaiBot", "NansenSentry", "ForkScanner", "GasGPT",
  "MipVoter", "Yieldera", "ClawCredit", "PinocchioPnL", "Spec2Contract",
  "MantleMutator", "SolidityTutor", "AgentEscrow", "MantaPay", "FrogBot",
  "BabyAGI", "AutoGPT", "Hermes", "Orion", "Pythia", "Cassandra",
  "Prometheus", "Athena", "Apollo", "HermesII", "Daphne", "EchoPrime"
];

async function deployContracts(): Promise<{ registry: Address; arena: Address; bounty: Address; tee: Address; zkml: Address; identity: Address }> {
  log.info("deploying contracts via forge...");

  // Use forge create (or assume already deployed if env vars are set)
  if (
    process.env.PROOF_LATTICE_REGISTRY &&
    process.env.PROOF_LATTICE_REGISTRY !== "0x0000000000000000000000000000000000000000"
  ) {
    log.info("using existing deployment from env");
    return {
      registry: process.env.PROOF_LATTICE_REGISTRY as Address,
      arena: process.env.DEMOSTHENES_ARENA as Address,
      bounty: process.env.X_BOUNTY_BOARD as Address,
      tee: process.env.TEE_VERIFIER as Address,
      zkml: process.env.ZKML_VERIFIER as Address,
      identity: process.env.IDENTITY_REGISTRY as Address,
    };
  }

  // Run forge script
  const cmd = `cd ${join(process.cwd(), "..", "contracts")} && forge script script/Deploy.s.sol:Deploy --rpc-url ${RPC_URL} --broadcast --private-key ${PK}`;
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (err) {
    log.error({ err }, "forge deploy failed; assuming Anvil is running and contracts pre-deployed");
  }

  // Try to read the deployment file
  const deployFile = join(process.cwd(), "..", "..", "deploy", "deployment.json");
  if (!existsSync(deployFile)) {
    throw new Error("No deployment.json found; run forge script first");
  }
  const dep = JSON.parse(readFileSync(deployFile, "utf-8"));
  return {
    registry: dep.ProofLatticeRegistry,
    arena: dep.DemosthenesArena,
    bounty: dep.XBountyBoard,
    tee: dep.TEEVerifier,
    zkml: dep.ZkMLVerifier,
    identity: dep.IdentityRegistry,
  };
}

async function main() {
  log.info({ chain: chain.name, rpc: RPC_URL, account: account.address }, "seeding");

  const dep = await deployContracts();
  log.info({ dep }, "contracts deployed");

  // Read ABIs from compiled output
  const out = join(process.cwd(), "..", "contracts", "out");
  const regAbi = JSON.parse(readFileSync(join(out, "ProofLatticeRegistry.sol", "ProofLatticeRegistry.json"), "utf-8")).abi;
  const arenaAbi = JSON.parse(readFileSync(join(out, "DemosthenesArena.sol", "DemosthenesArena.json"), "utf-8")).abi;
  const idAbi = JSON.parse(readFileSync(join(out, "MockERC8004Identity.sol", "MockERC8004Identity.json"), "utf-8")).abi;
  const teeAbi = JSON.parse(readFileSync(join(out, "MockTEEVerifier.sol", "MockTEEVerifier.json"), "utf-8")).abi;
  const zkmlAbi = JSON.parse(readFileSync(join(out, "MockZkMLVerifier.sol", "MockZkMLVerifier.json"), "utf-8")).abi;

  // Register 50 agents with varied trust scores
  for (let i = 0; i < 50; i++) {
    const op = privateKeyToAccount(`0x${(i + 1).toString(16).padStart(2, "0").repeat(32)}` as Hex);
    const name = AGENT_NAMES[i % AGENT_NAMES.length];
    const mrEnclave = keccak256(toHex(name + "-enclave"));
    const mrSigner = keccak256(toHex(name + "-signer"));
    const circuitHash = i % 3 === 0 ? keccak256(toHex(name + "-circuit")) : "0x0000000000000000000000000000000000000000000000000000000000000000";

    // 72-byte mock TEE quote: 32 bytes mr_enclave, 32 bytes mr_signer, 8 bytes timestamp
    const now = BigInt(Math.floor(Date.now() / 1000));
    const quote = encodePacked(
      ["bytes32", "bytes32", "uint64"],
      [mrEnclave, mrSigner, now]
    );

    try {
      // Need to use the agent's own operator key to register
      const opWallet = createWalletClient({ account: op, chain, transport: http(RPC_URL) });
      const opPublic = createPublicClient({ chain, transport: http(RPC_URL) });

      const { request } = await opPublic.simulateContract({
        address: dep.registry,
        abi: regAbi,
        functionName: "registerWithAttestation",
        args: [`ipfs://prooflattice/agents/${name.toLowerCase()}.json`, mrEnclave, mrSigner, dep.tee, quote, circuitHash, circuitHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? dep.zkml : "0x0000000000000000000000000000000000000000000000000000000000000000"],
        account: op,
      });
      const hash = await opWallet.writeContract(request);
      const receipt = await opPublic.waitForTransactionReceipt({ hash });
      log.info({ name, agentId: i + 1, tx: receipt.transactionHash }, "agent registered");

      // Set a varied trust score
      const score = 100 + Math.floor(Math.random() * 900);
      const { request: scoreReq } = await publicClient.simulateContract({
        address: dep.registry,
        abi: regAbi,
        functionName: "updateTrustScore",
        args: [BigInt(i + 1), score],
        account,
      });
      await walletClient.writeContract(scoreReq);
    } catch (err) {
      log.error({ err: (err as Error).message, name }, "agent register failed");
    }
  }

  log.info("seed complete");
}

main().catch((err) => {
  log.error(err, "seed crashed");
  process.exit(1);
});
