
## Byreal Integration

ProofLattice is the trust-gating layer for the agent economy, and Byreal is the execution layer for agent-owned capital. This release ships the missing piece: a verifiable on-ramp from trust score to trade.

### What we built

A new page at `/trade` that lets any ProofLattice-registered agent swap SOL, USDC, or USDT on Solana — but only if their trust score is above a configurable threshold (default 500). The wallet adapter supports Phantom and Backpack; the swap is signed client-side by the user's Solana wallet, so the operator's keys never touch the flow.

### Architecture

- Frontend: Next.js 14 App Router + Apollo Client + Reown (EVM) + @solana/wallet-adapter-react (Solana)
- SDK: @byreal-io/byreal-sdk (CLMM router with AMM + RFQ auto-routing)
- Trust gate: live GraphQL query against the ProofLatticeRegistry contract (re-polls every 15s)
- Logging: every successful swap is best-effort logged back to the backend with `txHash`, `explorerUrl`, and `trustScoreAtExecution` for the LiveSwaps feed on the home page

### Flow

1. User opens `/trade`, enters an Agent ID.
2. The page fetches that agent's `trustScore` from ProofLatticeRegistry.
3. If `trustScore >= 500`, the Execute Swap button activates.
4. User connects a Solana wallet (Phantom or Backpack).
5. On click, the page calls `sdk.swap.getQuote` and `sdk.swap.executeSwap` — the Byreal SDK returns a VersionedTransaction, the user's wallet signs it, and the SDK broadcasts it.
6. On success, the page displays the `txHash` and a Solana Explorer link. The swap is also logged to ProofLattice so other agents/operators can audit the trade.

### Trust is the gate, not the GUI

The interesting bit is not the swap UI — it's the gate. An agent with trust score 200 cannot swap, even if they hold the SOL. The ProofLatticeRegistry contract is the source of truth; the page cannot lie about it. This is the first time Byreal swaps are permissioned by an external on-chain reputation contract, and it works because both systems are on Mantle-family infra (Mantle for identity, Solana for execution, Byreal SDK as the bridge).

### Honest constraints

- Byreal devnet pool coverage is limited. The page UI is fully functional and the SDK is correctly invoked; live swap completion requires a pool on the target network. Mainnet execution is wired but not exercised in this submission.
- The `MIN_TRUST_SCORE = 500` constant lives in `app/trade/page.tsx` and is meant to be tuned per deployment.
- The backend `logByrealSwap` mutation is best-effort; the on-chain tx hash is the source of truth regardless.

### Files

- `frontend/app/trade/page.tsx` — the trust-gated swap page
- `frontend/components/SolanaWalletProvider.tsx` — Phantom + Backpack wallet context
- `frontend/components/HowItWorks.tsx` — 4-step project visual
- `frontend/components/LiveSwaps.tsx` — recent swaps feed
- `README.md` — this section
