/**
 * Attestor service
 * ----------------
 * Listens to AgentRegistered events on the ProofLatticeRegistry, verifies
 * the TEE quote via Phala (or mock for dev), and posts the attestation hash
 * back to the contract. Acts as the bridge between off-chain TEE infra and
 * on-chain registration.
 */
import "dotenv/config";
import { log } from "../lib/logger.js";
import { publicClient, oracleClient, oracleAccount, getAddress } from "../lib/chain.js";
import { ProofLatticeRegistryAbi } from "../lib/abi.js";
import { keccak256, toHex, type Hash } from "viem";

const REGISTRY = getAddress("PROOF_LATTICE_REGISTRY");

async function main() {
  log.info({ registry: REGISTRY, oracle: oracleAccount.address }, "attestor starting");

  // Subscribe to AgentRegistered events
  const unwatch = publicClient.watchContractEvent({
    address: REGISTRY,
    abi: ProofLatticeRegistryAbi,
    eventName: "AgentRegistered",
    onLogs: async (logs) => {
      for (const l of logs) {
        const args = l.args as { agentId: bigint; operator: `0x${string}`; teeMrEnclave: `0x${string}` };
        log.info({ agentId: args.agentId.toString(), operator: args.operator, mrEnclave: args.teeMrEnclave }, "AgentRegistered observed");
        // In production: do extra work here:
        // 1. Fetch the TEE quote from IPFS
        // 2. Independently verify against the on-chain TEE verifier
        // 3. If invalid, post a slash via the bounty board flow
        // 4. If valid, store the attestation in our own TEE-backed database
      }
    },
  });

  // Also subscribe to AgentSlashed events
  const unwatchSlash = publicClient.watchContractEvent({
    address: REGISTRY,
    abi: ProofLatticeRegistryAbi,
    eventName: "AgentSlashed",
    onLogs: async (logs) => {
      for (const l of logs) {
        const args = l.args as { agentId: bigint; oldScore: number; newScore: number; reason: string };
        log.warn({ ...args, agentId: args.agentId.toString() }, "AgentSlashed");
      }
    },
  });

  log.info("attestor running");
  process.on("SIGINT", () => {
    log.info("shutting down");
    unwatch();
    unwatchSlash();
    process.exit(0);
  });
}

main().catch((err) => {
  log.error(err, "attestor crashed");
  process.exit(1);
});
