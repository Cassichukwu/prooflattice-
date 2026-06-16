/**
 * Onchain GraphQL server: reads real agent data from ProofLatticeRegistry
 * on Mantle Sepolia testnet.
 */
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { gql } from "graphql-tag";
import { createPublicClient, http, parseAbiItem } from "viem";
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

const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "0xb2Bd745C436D96b54B4311773AF0a65A5aa694fc") as `0x${string}`;

const REGISTRY_ABI = [
  {
    name: "getAgent",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "operator", type: "address" },
        { name: "agentURI", type: "string" },
        { name: "trustScore", type: "uint16" },
        { name: "attestationCount", type: "uint32" },
        { name: "proofCount", type: "uint32" },
        { name: "bgaCertified", type: "bool" },
        { name: "active", type: "bool" },
        { name: "firstSeen", type: "uint256" },
        { name: "lastAttested", type: "uint256" },
        { name: "teeMrEnclave", type: "bytes32" },
        { name: "teeMrSigner", type: "bytes32" },
        { name: "zkmlCircuitHash", type: "bytes32" },
      ]
    }],
  },
  {
    name: "nextAgentId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

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
    teeMrEnclave: String!
    teeMrSigner: String!
    zkmlCircuitHash: String!
    proofCount: Int!
    rank: Int
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
  }
`;

async function fetchAllAgents() {
  try {
    const nextId = await client.readContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: "nextAgentId",
    });

    const agentCount = Number(nextId);
    const agents = [];

    for (let i = 1; i < agentCount; i++) {
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
            operator: data.operator,
            trustScore: Number(data.trustScore),
            attestationCount: Number(data.attestationCount),
            proofCount: Number(data.proofCount),
            bgaCertified: data.bgaCertified,
            active: data.active,
            firstSeen: String(data.firstSeen),
            lastAttested: String(data.lastAttested),
            teeMrEnclave: data.teeMrEnclave,
            teeMrSigner: data.teeMrSigner,
            zkmlCircuitHash: data.zkmlCircuitHash,
          });
        }
      } catch {
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
      const agents = await fetchAllAgents();
      const totalProofs = agents.reduce((sum, a) => sum + a.proofCount, 0);
      return {
        totalAgents: agents.length,
        totalProofs,
        activeRounds: 0,
        liveRoundsNow: 0,
      };
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