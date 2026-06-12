/**
 * Trust Engine
 * ------------
 * Computes the trust score for every agent on Mantle. Runs in our own TEE.
 * Inputs:
 *  - on-chain proof history (ProofSubmitted events)
 *  - on-chain TEE re-attestations
 *  - on-chain Demosthenes round outcomes
 *  - off-chain signals (Nansen, Elfa, Allora)
 *
 * Output: signed trust score update tx.
 *
 * The actual scoring formula is in `scoreAgent()`. For the hackathon we
 * use a simple 5-component blend.
 */
import "dotenv/config";
import { log } from "../lib/logger.js";
import { publicClient, oracleClient, oracleAccount, getAddress, getAddressOpt } from "../lib/chain.js";
import { ProofLatticeRegistryAbi, DemosthenesArenaAbi } from "../lib/abi.js";
import { decodeEventLog, type Hash } from "viem";
import type { AgentMetadata } from "../lib/types.js";

const REGISTRY = getAddress("PROOF_LATTICE_REGISTRY");
const ARENA = getAddressOpt("DEMOSTHENES_ARENA");

interface TrustComponents {
  pnl: number;          // 0-100
  attestation: number;  // 0-100
  zkml: number;         // 0-100
  reputation: number;   // 0-100
  allora: number;       // 0-100
}

function scoreAgent(agent: AgentMetadata, components: TrustComponents): number {
  // Weighted blend, then rescaled to 0-1000
  const w = { pnl: 0.30, attestation: 0.20, zkml: 0.20, reputation: 0.15, allora: 0.15 };
  const score01 = (
    components.pnl * w.pnl +
    components.attestation * w.attestation +
    components.zkml * w.zkml +
    components.reputation * w.reputation +
    components.allora * w.allora
  ) / 100;
  return Math.round(score01 * 1000);
}

async function fetchAgent(agentId: bigint): Promise<AgentMetadata> {
  const [meta, owner, totalAgents] = await Promise.all([
    publicClient.readContract({
      address: REGISTRY,
      abi: ProofLatticeRegistryAbi,
      functionName: "agentMeta",
      args: [agentId],
    }),
    publicClient.readContract({
      address: REGISTRY,
      abi: ProofLatticeRegistryAbi,
      functionName: "agentMeta", // we read operator separately
      args: [agentId],
    }),
    publicClient.readContract({
      address: REGISTRY,
      abi: ProofLatticeRegistryAbi,
      functionName: "totalAgents",
    }),
  ]);
  return {
    agentId: Number(agentId),
    operator: "0x0", // would need identityRegistry.ownerOf(agentId) in prod
    teeMrEnclave: meta.teeMrEnclave,
    teeMrSigner: meta.teeMrSigner,
    zkmlCircuitHash: meta.zkmlCircuitHash,
    teeVerifier: meta.teeVerifier,
    zkmlVerifier: meta.zkmlVerifier,
    firstSeen: Number(meta.firstSeen),
    lastAttested: Number(meta.lastAttested),
    trustScore: meta.trustScore,
    attestationCount: meta.attestationCount,
    bgaCertified: meta.bgaCertified,
    active: meta.active,
  };
}

async function tick() {
  const totalAgents = await publicClient.readContract({
    address: REGISTRY,
    abi: ProofLatticeRegistryAbi,
    functionName: "totalAgents",
  });
  log.info({ totalAgents: totalAgents.toString() }, "tick: scoring agents");

  for (let i = 1n; i <= totalAgents; i++) {
    try {
      const agent = await fetchAgent(i);
      if (!agent.active) continue;

      // In production, the 5 components would be computed from real data.
      // For demo, we use heuristics based on on-chain state:
      const components: TrustComponents = {
        // PnL: rough proxy from attestation count + trust score trajectory
        pnl: Math.min(100, agent.attestationCount * 8 + 30),
        // Attestation: did the agent re-attest recently?
        attestation: Math.max(0, 100 - Math.floor((Date.now() / 1000 - agent.lastAttested) / 86400) * 2),
        // zkML: presence of zkml verifier + circuit hash
        zkml: agent.zkmlCircuitHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? 75 : 25,
        // Reputation: clamp trust score 0-100
        reputation: Math.round(agent.trustScore / 10),
        // Allora: stub; in prod query Allora's predictive ML
        allora: 50,
      };

      const newScore = scoreAgent(agent, components);
      if (Math.abs(newScore - agent.trustScore) >= 5) {
        log.info({ agentId: agent.agentId, old: agent.trustScore, new: newScore, components }, "updating trust score");
        const { request } = await publicClient.simulateContract({
          address: REGISTRY,
          abi: ProofLatticeRegistryAbi,
          functionName: "updateTrustScore",
          args: [BigInt(agent.agentId), newScore],
          account: oracleAccount,
        });
        const hash = await oracleClient.writeContract(request);
        log.info({ agentId: agent.agentId, hash }, "trust score tx submitted");
      }
    } catch (err) {
      log.error({ err, agentId: i.toString() }, "failed to score agent");
    }
  }
}

async function main() {
  log.info({ registry: REGISTRY, oracle: oracleAccount.address }, "trust engine starting");
  // Tick every 5 minutes
  await tick();
  setInterval(tick, 5 * 60 * 1000);
  process.on("SIGINT", () => process.exit(0));
}

main().catch((err) => {
  log.error(err, "trust engine crashed");
  process.exit(1);
});
