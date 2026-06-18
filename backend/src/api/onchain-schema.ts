import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { gql } from "graphql-tag";
import { createPublicClient, http } from "viem";
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

const REGISTRY_ADDRESS = (process.env.REGISTRY_ADDRESS || "0xb2Bd745C436D96b54B4311773AF0a65A5aa694fc") as `0x${string}`;
const ARENA_ADDRESS = (process.env.ARENA_ADDRESS || "0x15FeE1802cE22D4d596C025Ace5af7C53e939B56") as `0x${string}`;
const DEPLOYMENT_BLOCK = 39886832n;

const AGENT_REGISTERED_EVENT = {
  name: "AgentRegistered",
  type: "event",
  inputs: [
    { name: "agentId", type: "uint256", indexed: true },
    { name: "operator", type: "address", indexed: true },
    { name: "teeMrEnclave", type: "bytes32", indexed: false },
    { name: "zkmlCircuitHash", type: "bytes32", indexed: false },
    { name: "teeVerifier", type: "address", indexed: false },
  ],
} as const;

const ROUND_OPENED_EVENT = {
  name: "RoundOpened",
  type: "event",
  inputs: [
    { name: "roundId", type: "uint256", indexed: true },
    { name: "taskAgentId", type: "uint256", indexed: true },
    { name: "taskType", type: "uint8", indexed: false },
    { name: "taskHash", type: "bytes32", indexed: false },
    { name: "stakeRequired", type: "uint256", indexed: false },
  ],
} as const;

const REGISTRY_ABI = [
  {
    name: "getAgent",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "teeMrEnclave", type: "bytes32" },
        { name: "teeMrSigner", type: "bytes32" },
        { name: "zkmlCircuitHash", type: "bytes32" },
        { name: "teeVerifier", type: "address" },
        { name: "zkmlVerifier", type: "address" },
        { name: "firstSeen", type: "uint64" },
        { name: "lastAttested", type: "uint64" },
        { name: "trustScore", type: "uint16" },
        { name: "attestationCount", type: "uint16" },
        { name: "bgaCertified", type: "bool" },
        { name: "active", type: "bool" },
      ]
    }],
  },
  {
    name: "totalAgents",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

const ARENA_ABI = [
  {
    name: "rounds",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "roundId", type: "uint256" },
        { name: "taskAgentId", type: "uint256" },
        { name: "taskType", type: "uint8" },
        { name: "taskHash", type: "bytes32" },
        { name: "stakeRequired", type: "uint256" },
        { name: "submissionDeadline", type: "uint256" },
        { name: "judgmentDeadline", type: "uint256" },
        { name: "yesVotes", type: "uint16" },
        { name: "noVotes", type: "uint16" },
        { name: "state", type: "uint8" },
        { name: "staker", type: "address" },
      ]
    }],
  },
  {
    name: "roundCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getJudges",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ type: "uint256[]" }],
  },
] as const;

const TASK_TYPE_NAMES = ["DeFi Swap", "RWA Rebalance", "LP Rebalance", "Wallet Payment", "Governance Vote", "Yield Optimise"];
const ROUND_STATE_NAMES = ["Open", "Judging", "Settled", "Disputed", "Cancelled"];

const client = createPublicClient({
  chain: mantleSepolia,
  transport: http(),
});

const typeDefs = gql`
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
    teeMrEnclave: String
    teeMrSigner: String
    zkmlCircuitHash: String
    proofCount: Int!
    rank: Int
  }

  type Round {
    roundId: ID!
    taskAgentId: ID!
    taskTypeName: String!
    taskHash: String!
    stakeRequired: String!
    yesVotes: Int!
    noVotes: Int!
    stateName: String!
    trustDelta: Int!
    judges: [ID!]!
    staker: String!
    settlementBlock: BigInt!
  }

  type Stats {
    totalAgents: Int!
    totalProofs: Int!
    activeRounds: Int!
    liveRoundsNow: Int!
  }

  type Query {
    leaderboard(limit: Int, offset: Int): [Agent!]!
    agent(id: ID!): Agent
    stats: Stats!
    rounds: [Round!]!
    liveRounds: [Round!]!
  }
`;

async function fetchAllAgents() {
  try {
    const total = await client.readContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: "totalAgents",
    });

    const agentCount = Number(total);
    console.log(`[*] Fetching ${agentCount} agents from chain...`);

    const operatorMap = new Map<string, string>();
    try {
      const latestBlock = await client.getBlockNumber();
      const chunkSize = 9000n;
      let fromBlock = DEPLOYMENT_BLOCK;

      while (fromBlock <= latestBlock) {
        const toBlock = fromBlock + chunkSize > latestBlock ? latestBlock : fromBlock + chunkSize;
        try {
          const logs = await client.getLogs({
            address: REGISTRY_ADDRESS,
            event: AGENT_REGISTERED_EVENT,
            fromBlock,
            toBlock,
          });
          for (const log of logs) {
            const args = log.args as any;
            if (args.agentId !== undefined && args.operator) {
              operatorMap.set(String(args.agentId), args.operator);
            }
          }
        } catch (e) {
          console.error(`[warn] Failed chunk ${fromBlock}-${toBlock}:`, e);
        }
        fromBlock = toBlock + 1n;
      }
      console.log(`[*] Found ${operatorMap.size} operator addresses`);
    } catch (e) {
      console.error("[warn] Failed to fetch AgentRegistered events:", e);
    }

    const agents = [];
    for (let i = 1; i <= agentCount; i++) {
      try {
        const data = await client.readContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: "getAgent",
          args: [BigInt(i)],
        }) as any;

        if (data && data.active) {
          agents.push({
            agentId: String(i),
            operator: operatorMap.get(String(i)) || data.teeVerifier,
            trustScore: Number(data.trustScore),
            attestationCount: Number(data.attestationCount),
            proofCount: 0,
            bgaCertified: data.bgaCertified,
            active: data.active,
            firstSeen: String(data.firstSeen),
            lastAttested: String(data.lastAttested),
            teeMrEnclave: data.teeMrEnclave,
            teeMrSigner: data.teeMrSigner,
            zkmlCircuitHash: data.zkmlCircuitHash,
          });
        }
      } catch (e) {
        console.error(`[warn] Failed to fetch agent ${i}:`, e);
        continue;
      }
    }

    return agents.sort((a, b) => b.trustScore - a.trustScore).map((a, i) => ({
      ...a,
      rank: i + 1,
    }));
  } catch (err) {
    console.error("Failed to fetch agents:", err);
    return [];
  }
}

async function fetchAllRounds() {
  try {
    const total = await client.readContract({
      address: ARENA_ADDRESS,
      abi: ARENA_ABI,
      functionName: "roundCount",
    });

    const roundCount = Number(total);
    console.log(`[*] Fetching ${roundCount} rounds from chain...`);

    const rounds = [];
    for (let i = 1; i <= roundCount; i++) {
      try {
        const [data, judges] = await Promise.all([
          client.readContract({
            address: ARENA_ADDRESS,
            abi: ARENA_ABI,
            functionName: "rounds",
            args: [BigInt(i)],
          }) as any,
          client.readContract({
            address: ARENA_ADDRESS,
            abi: ARENA_ABI,
            functionName: "getJudges",
            args: [BigInt(i)],
          }) as any,
        ]);

        rounds.push({
          roundId: String(i),
          taskAgentId: String(data.taskAgentId),
          taskTypeName: TASK_TYPE_NAMES[Number(data.taskType)] || "Unknown",
          taskHash: data.taskHash,
          stakeRequired: data.stakeRequired.toString(),
          yesVotes: Number(data.yesVotes),
          noVotes: Number(data.noVotes),
          stateName: ROUND_STATE_NAMES[Number(data.state)] || "Unknown",
          trustDelta: 0,
          judges: judges.map((j: bigint) => String(j)),
          staker: data.staker,
          settlementBlock: String(data.judgmentDeadline),
        });
      } catch (e) {
        console.error(`[warn] Failed to fetch round ${i}:`, e);
        continue;
      }
    }

    return rounds;
  } catch (err) {
    console.error("Failed to fetch rounds:", err);
    return [];
  }
}

const resolvers = {
  Query: {
    leaderboard: async (_: any, { limit = 50, offset = 0 }: any) => {
      const agents = await fetchAllAgents();
      return agents.slice(offset, offset + limit);
    },
    agent: async (_: any, { id }: any) => {
      const agents = await fetchAllAgents();
      return agents.find((a) => a.agentId === String(id)) || null;
    },
    stats: async () => {
      const [agents, rounds] = await Promise.all([fetchAllAgents(), fetchAllRounds()]);
      const totalProofs = agents.reduce((sum, a) => sum + a.proofCount, 0);
      const activeRounds = rounds.filter((r) => r.stateName === "Open" || r.stateName === "Judging").length;
      return {
        totalAgents: agents.length,
        totalProofs,
        activeRounds,
        liveRoundsNow: activeRounds,
      };
    },
    rounds: async () => {
      return fetchAllRounds();
    },
    liveRounds: async () => {
      const rounds = await fetchAllRounds();
      return rounds.filter((r) => r.stateName === "Open" || r.stateName === "Judging");
    },
  },
};

const port = Number(process.env.API_PORT ?? 4000);
const app = express();
app.use(cors({ origin: "*" }));

const server = new ApolloServer({ typeDefs, resolvers });

server.start().then(() => {
  app.use("/graphql", express.json(), expressMiddleware(server));
  app.listen(port, () => {
    console.log(`🟢 Onchain GraphQL ready at http://localhost:${port}/graphql`);
  });
});