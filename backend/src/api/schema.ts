/**
 * GraphQL schema + resolvers for the ProofLattice leaderboard API.
 */
import { gql } from "graphql-tag";
import NodeCache from "node-cache";
import { publicClient, getAddress, getAddressOpt } from "../lib/chain.js";
import { ProofLatticeRegistryAbi, DemosthenesArenaAbi, IdentityRegistryAbi } from "../lib/abi.js";
import { TaskTypeName, RoundStateName, type AgentMetadata, type Round } from "../lib/types.js";

export const typeDefs = gql`
  scalar BigInt

  type Agent {
    agentId: ID!
    operator: String!
    trustScore: Int!
    attestationCount: Int!
    bgaCertified: Boolean!
    active: Boolean!
    firstSeen: BigInt!
    lastAttested: BigInt!
    teeMrEnclave: String!
    teeMrSigner: String!
    zkmlCircuitHash: String!
    proofCount: Int!
    rank: Int
  }

  type Round {
    roundId: ID!
    taskAgentId: ID!
    taskAgent: Agent
    taskType: Int!
    taskTypeName: String!
    taskHash: String!
    stakeRequired: String!
    submissionDeadline: BigInt!
    judgmentDeadline: BigInt!
    settlementBlock: BigInt!
    trustDelta: Int!
    yesVotes: Int!
    noVotes: Int!
    state: Int!
    stateName: String!
    judges: [ID!]!
    staker: String!
  }

  type Bounty {
    bountyId: ID!
    accusedAgentId: ID!
    accuser: String!
    claimURI: String!
    stake: String!
    challengedRoundId: String!
    state: Int!
    createdAt: BigInt!
    resolvedAt: BigInt!
  }

  type Stats {
    totalAgents: Int!
    totalProofs: Int!
    totalRounds: Int!
    totalBounties: Int!
  }

  type Query {
    leaderboard(limit: Int = 100, track: String): [Agent!]!
    agent(id: ID!): Agent
    rounds(limit: Int = 50, state: Int): [Round!]!
    round(id: ID!): Round
    bounties(limit: Int = 50): [Bounty!]!
    stats: Stats!
    liveRounds: [Round!]!
  }
`;

const cache = new NodeCache({ stdTTL: 12, checkperiod: 15 });

const REGISTRY = process.env.PROOF_LATTICE_REGISTRY as `0x${string}`;
const ARENA = process.env.DEMOSTHENES_ARENA as `0x${string}`;
const BOUNTY = process.env.X_BOUNTY_BOARD as `0x${string}`;
const IDENTITY = process.env.IDENTITY_REGISTRY as `0x${string}`;

interface CachedAgent extends AgentMetadata {
  proofCount: number;
  rank?: number;
}

async function loadAgent(agentId: bigint): Promise<CachedAgent | null> {
  const cacheKey = `agent:${agentId}`;
  const cached = cache.get<CachedAgent>(cacheKey);
  if (cached) return cached;

  try {
    const [meta, owner, proofCount] = await Promise.all([
      publicClient.readContract({
        address: REGISTRY,
        abi: ProofLatticeRegistryAbi,
        functionName: "agentMeta",
        args: [agentId],
      }),
      publicClient.readContract({
        address: IDENTITY,
        abi: IdentityRegistryAbi,
        functionName: "ownerOf",
        args: [agentId],
      }),
      publicClient.readContract({
        address: REGISTRY,
        abi: ProofLatticeRegistryAbi,
        functionName: "getProofHistoryLength",
        args: [agentId],
      }),
    ]);
    const agent: CachedAgent = {
      agentId: Number(agentId),
      operator: owner,
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
      proofCount: Number(proofCount),
    };
    cache.set(cacheKey, agent, 10);
    return agent;
  } catch (err) {
    return null;
  }
}

export const resolvers = {
  BigInt: {
    serialize: (v: any) => (typeof v === "bigint" ? v.toString() : String(v)),
    parseValue: (v: any) => BigInt(v),
    parseLiteral: (ast: any) => (ast.kind === "StringValue" ? BigInt(ast.value) : null),
  },
  Query: {
    leaderboard: async (_: unknown, args: { limit: number; track?: string }) => {
      const total = await publicClient.readContract({
        address: REGISTRY,
        abi: ProofLatticeRegistryAbi,
        functionName: "totalAgents",
      });
      const all: CachedAgent[] = [];
      for (let i = 1n; i <= total; i++) {
        const a = await loadAgent(i);
        if (a && a.active) all.push(a);
      }
      all.sort((a, b) => b.trustScore - a.trustScore);
      return all.slice(0, args.limit).map((a, idx) => ({ ...a, rank: idx + 1 }));
    },

    agent: async (_: unknown, args: { id: string }) => {
      return loadAgent(BigInt(args.id));
    },

    rounds: async (_: unknown, args: { limit: number; state?: number }) => {
      if (!ARENA || ARENA === "0x0000000000000000000000000000000000000000") return [];
      const count = await publicClient.readContract({
        address: ARENA,
        abi: DemosthenesArenaAbi,
        functionName: "roundCount",
      });
      const ids: bigint[] = [];
      for (let i = 1n; i <= count; i++) ids.push(i);
      ids.reverse();
      const out: any[] = [];
      for (const id of ids.slice(0, args.limit)) {
        try {
          const r = await publicClient.readContract({
            address: ARENA,
            abi: DemosthenesArenaAbi,
            functionName: "getRound",
            args: [id],
          });
          const judges = await publicClient.readContract({
            address: ARENA,
            abi: DemosthenesArenaAbi,
            functionName: "getJudges",
            args: [id],
          });
          if (args.state !== undefined && Number(r.state) !== args.state) continue;
          out.push({
            roundId: r.roundId.toString(),
            taskAgentId: r.taskAgentId.toString(),
            taskType: Number(r.taskType),
            taskTypeName: TaskTypeName[Number(r.taskType)] ?? "Unknown",
            taskHash: r.taskHash,
            stakeRequired: r.stakeRequired.toString(),
            submissionDeadline: r.submissionDeadline.toString(),
            judgmentDeadline: r.judgmentDeadline.toString(),
            settlementBlock: r.settlementBlock.toString(),
            trustDelta: r.trustDelta,
            yesVotes: r.yesVotes,
            noVotes: r.noVotes,
            state: Number(r.state),
            stateName: RoundStateName[Number(r.state)] ?? "Unknown",
            judges: judges.map((j) => j.toString()),
            staker: r.staker,
          });
        } catch {
          // skip
        }
      }
      return out;
    },

    round: async (_: unknown, args: { id: string }) => {
      const rounds = await resolvers.Query.rounds(_, { limit: 100 });
      return rounds.find((r: any) => r.roundId === args.id);
    },

    liveRounds: async (_: unknown, args: unknown) => {
      return resolvers.Query.rounds(_, { limit: 20, state: 1 });
    },

    bounties: async (_: unknown, args: { limit: number }) => {
      // Returns empty for now; would query XBountyBoard events
      return [];
    },

    stats: async () => {
      const [totalAgents, totalProofs] = await Promise.all([
        publicClient.readContract({
          address: REGISTRY,
          abi: ProofLatticeRegistryAbi,
          functionName: "totalAgents",
        }),
        publicClient.readContract({
          address: REGISTRY,
          abi: ProofLatticeRegistryAbi,
          functionName: "totalProofs",
        }),
      ]);
      let totalRounds = 0;
      if (ARENA && ARENA !== "0x0000000000000000000000000000000000000000") {
        totalRounds = Number(
          await publicClient.readContract({
            address: ARENA,
            abi: DemosthenesArenaAbi,
            functionName: "roundCount",
          })
        );
      }
      return {
        totalAgents: Number(totalAgents),
        totalProofs: Number(totalProofs),
        totalRounds,
        totalBounties: 0,
      };
    },
  },

  Round: {
    taskAgent: async (parent: { taskAgentId: string }) => {
      return loadAgent(BigInt(parent.taskAgentId));
    },
  },
};
