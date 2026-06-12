/**
 * Apollo GraphQL server exposing the leaderboard, agents, rounds, bounties, stats.
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { typeDefs, resolvers } from "./schema.js";
import { log } from "../lib/logger.js";

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_, res) => {
    res.json({ status: "ok", service: "prooflattice-api", ts: Date.now() });
  });

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
  });
  await server.start();
  app.use("/graphql", expressMiddleware(server));

  const port = Number(process.env.API_PORT ?? 4000);
  app.listen(port, () => {
    log.info({ port }, `GraphQL ready at http://localhost:${port}/graphql`);
  });
}

main().catch((err) => {
  log.error(err, "API crashed");
  process.exit(1);
});
