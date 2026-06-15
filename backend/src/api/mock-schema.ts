/**
 * Mock-mode GraphQL server: serves hard-coded data for demos / dev
 * when there is no live chain connection. Reads from /workspace/mantle-tt-2026/data/*.json
 */
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { gql } from "graphql-tag";
import { readFileSync } from "fs";
import { join } from "path";

const DATA_DIR = process.env.MOCK_DATA_DIR || join(process.cwd(), "data");

function loadJson<T = any>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8")) as T;
}

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
`;

const resolvers = {
  BigInt: {
    serialize: (v: any) => (typeof v === "bigint" ? v.toString() : String(v)),
    parseValue: (v: any) => BigInt(v),
    parseLiteral: (ast: any) => (ast.kind === "StringValue" ? BigInt(ast.value) : null),
  },
  Query: {
    leaderboard: (_: unknown, args: { limit: number }) => {
      const agents = loadJson<any[]>("mock-agents.json")
        .filter((a) => a.active)
        .sort((a, b) => b.trustScore - a.trustScore)
        .slice(0, args.limit)
        .map((a, i) => ({ ...a, rank: i + 1 }));
      return agents;
    },
    agent: (_: unknown, args: { id: string }) => {
      return loadJson<any[]>("mock-agents.json").find((a) => a.agentId === args.id);
    },
    rounds: (_: unknown, args: { limit: number; state?: number }) => {
      const rounds = loadJson<any[]>("mock-rounds.json")
        .sort((a, b) => Number(b.roundId) - Number(a.roundId))
        .slice(0, args.limit);
      return rounds.map((r) => ({
        ...r,
        state: r.stateName === "Open" ? 0 : r.stateName === "Judging" ? 1 : r.stateName === "Settled" ? 2 : r.stateName === "Disputed" ? 3 : 4,
        taskType: 0,
        taskHash: "0x" + r.roundId.padStart(64, "0"),
        submissionDeadline: "100",
        judgmentDeadline: "200",
        settlementBlock: r.stateName === "Settled" ? "190" : "0",
      }));
    },
    round: (_: unknown, args: { id: string }) => {
      const rounds = loadJson<any[]>("mock-rounds.json");
      return rounds.find((r) => r.roundId === args.id);
    },
    liveRounds: () => {
      return loadJson<any[]>("mock-rounds.json").filter((r) => r.stateName === "Judging");
    },
    bounties: () => [],
    stats: () => {
      const agents = loadJson<any[]>("mock-agents.json");
      const rounds = loadJson<any[]>("mock-rounds.json");
      return {
        totalAgents: agents.length,
        totalProofs: agents.reduce((s, a) => s + (a.proofCount ?? 0), 0),
        totalRounds: rounds.length,
        totalBounties: 0,
      };
    },
  },
  Round: {
    taskAgent: (parent: { taskAgentId: string }) => {
      return loadJson<any[]>("mock-agents.json").find((a) => a.agentId === parent.taskAgentId);
    },
  },
};

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/health", (_, res) => res.json({ status: "ok", mode: "mock" }));
  const server = new ApolloServer({ typeDefs, resolvers, introspection: true });
  await server.start();
  app.use("/graphql", expressMiddleware(server));
  const port = Number(process.env.API_PORT ?? 4000);
  app.listen(port, () => {
    console.log(`🟢 Mock GraphQL ready at http://localhost:${port}/graphql`);
  });
}

main();
