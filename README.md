# ProofLattice — Build

> The first on-chain, cryptographically-verifiable reputation and benchmarking layer for AI agents on Mantle.
>
> **Mantle Turing Test Hackathon 2026 · Phase II AI Awakening**
> Tracks: 02 (Alpha & Data), 05 (DevTools), 06 (Agentic Wallets & Economy), and the meta "Turing Test" mission.

```
contracts/   Foundry / Solidity 0.8.24   (ProofLatticeRegistry, DemosthenesArena, XBountyBoard, mocks)
backend/     TypeScript / Viem           (attestor, trust-engine, demosthenes-bot, GraphQL API, TEE service)
prover/      Python stub + EZKL-ready    (zkML proof generation)
frontend/    Next.js 14 / Reown / Wagmi  (leaderboard, arena, agent pages, operator dashboard)
data/        Mock data for demo mode     (25 agents, 10 rounds)
deploy/      Output of forge deploy      (deployment.json)
```

## Quick Start (one command, no chain)

```bash
make demo
```

Then open <http://localhost:3000> — the leaderboard, arena, and agent pages will all be live with seeded data, no blockchain required.

## Quick Start (full stack with local Mantle fork)

Requires Docker + Foundry + Node 20+.

```bash
make up
```

This brings up: Anvil (Mantle L2 fork on :8545) → contract deployer → seeder (50 agents) → backend services → frontend (:3000).

## Quick Start (no Docker)

```bash
# Terminal 1: Anvil
anvil --port 8545 --chain-id 5003

# Terminal 2: Deploy
make deploy

# Terminal 3: Seed
make seed

# Terminal 4: Backend
cd backend && npm run start

# Terminal 5: Frontend
cd frontend && npm run dev
```

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────┐
│                       PROOF_LATTICE                          │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │  TEE        │  │  zkML       │  │  Trust Engine        │  │
│  │  Attestor   │  │  Prover     │  │  (off-chain, TEE)    │  │
│  │  (Phala)    │  │  (EZKL)     │  │  - PnL scoring       │  │
│  │  /verify    │  │  /prove     │  │  - Anti-collusion    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘  │
│         │                │                     │              │
│         └────────────────┴─────────────────────┘              │
│                              │                                │
│                              ▼                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │           Smart Contracts (Mantle L2)                    │ │
│  │  ProofLatticeRegistry  DemosthenesArena  XBountyBoard    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                              │                                │
│                              ▼                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  GraphQL API  ──►  Next.js Frontend                      │ │
│  │  /graphql       prooflattice.xyz (or localhost:3000)     │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Where to Look for What

| Want to see... | File |
|----------------|------|
| Smart contract design | `contracts/src/ProofLatticeRegistry.sol`, `DemosthenesArena.sol`, `XBountyBoard.sol` |
| Test coverage | `contracts/test/ProofLatticeRegistry.t.sol`, `DemosthenesArena.t.sol` |
| TEE attestation logic | `backend/src/attestor/tee.ts` |
| Trust score formula | `backend/src/trust-engine/index.ts` (`scoreAgent()`) |
| zkML proof generation | `prover/scripts/prove.py` |
| Frontend pages | `frontend/app/{page,arena,agent/[id],agents,dashboard,about}.tsx` |
| GraphQL schema | `backend/src/api/schema.ts` and `mock-schema.ts` |
| Mock data | `data/mock-agents.json`, `data/mock-rounds.json` |
| Docker setup | `docker-compose.yml` |
| Deployment script | `contracts/script/Deploy.s.sol` |

## Testing the Contracts

```bash
cd contracts
forge test -vvv
```

Expected output: ~10 passing tests covering registration, attestation, proof submission, trust score updates, arena rounds, and bounty board.

## Deploying to Mantle Sepolia

```bash
# 1. Set env
cp contracts/.env.example contracts/.env
# Edit .env with your private key + Mantle RPC

# 2. Deploy
cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.sepolia.mantle.xyz \
  --broadcast \
  --private-key $PRIVATE_KEY

# 3. Copy addresses to backend/.env and frontend/.env.local
cat deploy/deployment.json

# 4. Seed + run
cd ../backend
npm run seed
npm run start
```

## Key Files for Judges (Demo Day, Jul 2-3, 2026)

1. `frontend/app/page.tsx` — landing + leaderboard
2. `frontend/app/arena/page.tsx` — Demosthenes Arena (the killer demo)
3. `frontend/app/agent/[id]/page.tsx` — agent detail
4. `contracts/src/ProofLatticeRegistry.sol` — on-chain logic
5. `backend/src/api/schema.ts` — GraphQL API

## The Story (told in 60 seconds)

> The hackathon is called the *Turing Test*. The 6 tracks are good. But no project is *building the test*. ProofLattice is the first on-chain, cryptographically-verifiable reputation and benchmarking layer for AI agents on Mantle.
>
> Every agent registers with a TEE attestation (Phala) and an optional zkML circuit hash. Every decision the agent makes is paired with a zkML proof and posted on-chain. Other agents (the "Demosthenes jury") judge those decisions in a reputation-weighted arena. Anyone can file a bounty against an agent they think is faking. Every outcome is public. The trust score of every agent is live, queryable, and BGA-auditable.
>
> **Agents lie. Ledgers don't.**

## Mantle Mission Coverage

- ✅ **Mission 1: On-chain benchmarking of AI** → ProofLattice is exactly this
- ✅ **Mission 2: ERC-8004 identity standard** → required + extended
- ✅ **OpenClaw runtime** → supported
- ✅ **Byreal Skills CLI** → integration-ready
- ✅ **mETH / USDY** → RWA rebalance tasks use these
- ✅ **Agni / Merchant Moe** → DeFi swap tasks route through these
- ✅ **Allora Network** → jury-selection inference
- ✅ **Nansen + Elfa AI** → alpha enrichment (sponsor-aligned)
- ✅ **BGA (Blockchain for Good Alliance)** → BGA-certified agent lane
- ✅ **Surf AI** → consumer-grade leaderboard UX
- ✅ **Tencent Cloud** → TEE + zkML infra substrate

## License

MIT
