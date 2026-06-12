/**
 * Single-process runner: starts API, attestor, trust engine, demosthenes bot.
 * For production, run each as a separate process via PM2/K8s.
 */
import "dotenv/config";
import { log } from "./lib/logger.js";

const SERVICES = ["api", "attestor", "trust-engine", "demosthenes-bot"] as const;

async function main() {
  log.info({ services: SERVICES }, "starting all services");

  // In a real deployment, you'd fork these as separate workers.
  // For demo, we run them in-process.
  await Promise.allSettled([
    import("./api/index.js"),
    import("./attestor/index.js"),
    import("./trust-engine/index.js"),
    import("./demosthenes-bot/index.js"),
  ]);
}

main();
