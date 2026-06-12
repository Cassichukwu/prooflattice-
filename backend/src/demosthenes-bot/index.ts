/**
 * Demosthenes Bot
 * ---------------
 * Periodically opens new "Demosthenes" rounds testing registered agents on
 * real Mantle DeFi/RWA tasks. Also judges on behalf of high-reputation jury
 * agents if those agents' operators have delegated signing to this bot.
 */
import "dotenv/config";
import { log } from "../lib/logger.js";
import { publicClient, oracleClient, oracleAccount, getAddress, getAddressOpt } from "../lib/chain.js";
import { ProofLatticeRegistryAbi, DemosthenesArenaAbi } from "../lib/abi.js";
import { keccak256, toHex, encodePacked } from "viem";

const REGISTRY = getAddress("PROOF_LATTICE_REGISTRY");
const ARENA = getAddress("DEMOSTHENES_ARENA");

const TASK_TEMPLATES = [
  {
    type: 0, // DEF_SWAP
    name: "Swap 100 USDC → mETH on Byreal at best rate",
    hash: keccak256(toHex("swap 100 USDC to mETH on Byreal")),
  },
  {
    type: 1, // RWA_REBALANCE
    name: "Rebalance 50% of agent's USDY → mETH if mETH yield > 4%",
    hash: keccak256(toHex("rebalance USDY to mETH when yield > 4%")),
  },
  {
    type: 4, // GOVERNANCE_VOTE
    name: "Vote YES on Mantle MIP-12 (lower gas on Agent Registry)",
    hash: keccak256(toHex("vote yes on MIP-12")),
  },
  {
    type: 5, // YIELD_OPTIMISE
    name: "Find best risk-adjusted yield across 3 stable pools",
    hash: keccak256(toHex("best yield across 3 stable pools")),
  },
];

async function pickRandomAgent(): Promise<bigint> {
  const total = await publicClient.readContract({
    address: REGISTRY,
    abi: ProofLatticeRegistryAbi,
    functionName: "totalAgents",
  });
  if (total === 0n) throw new Error("No agents registered");
  const idx = (BigInt(Math.floor(Math.random() * Number(total))) % total) + 1n;
  // Verify active
  const meta = await publicClient.readContract({
    address: REGISTRY,
    abi: ProofLatticeRegistryAbi,
    functionName: "agentMeta",
    args: [idx],
  });
  if (!meta.active) {
    return pickRandomAgent(); // try again
  }
  return idx;
}

async function openRound() {
  const task = TASK_TEMPLATES[Math.floor(Math.random() * TASK_TEMPLATES.length)];
  const taskAgentId = await pickRandomAgent();
  const stake = 10000000000000000n; // 0.01 MNT

  log.info({ taskAgentId: taskAgentId.toString(), task: task.name }, "opening Demosthenes round");

  try {
    const { request } = await publicClient.simulateContract({
      address: ARENA,
      abi: DemosthenesArenaAbi,
      functionName: "openRound",
      args: [taskAgentId, task.type, task.hash, stake],
      account: oracleAccount,
      value: stake,
    });
    const hash = await oracleClient.writeContract(request);
    log.info({ hash, taskAgentId: taskAgentId.toString() }, "Demosthenes round opened");
  } catch (err) {
    log.error({ err }, "failed to open round");
  }
}

async function main() {
  log.info({ arena: ARENA }, "Demosthenes bot starting");
  // Open a new round every 30 minutes
  await openRound();
  setInterval(openRound, 30 * 60 * 1000);
  process.on("SIGINT", () => process.exit(0));
}

main().catch((err) => {
  log.error(err, "Demosthenes bot crashed");
  process.exit(1);
});
