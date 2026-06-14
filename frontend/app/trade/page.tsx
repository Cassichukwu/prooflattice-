"use client";

import { useQuery, useMutation, gql } from "@apollo/client";
import { useAccount } from "wagmi";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ByrealSDK, uiToRaw } from "@byreal-io/byreal-sdk";
import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { VersionedTransaction } from "@solana/web3.js";

const AGENT = gql`
  query Agent($id: ID!) {
    agent(id: $id) {
      agentId operator trustScore attestationCount bgaCertified zkmlCircuitHash
    }
  }
`;

const LOG_BYREAL_SWAP = gql`
  mutation LogByrealSwap($input: ByrealSwapLogInput!) {
    logByrealSwap(input: $input) {
      id txHash explorerUrl agentId inToken outToken amount
      trustScoreAtExecution executedAt
    }
  }
`;

const MIN_TRUST_SCORE = 500;

const MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};
const DECIMALS: Record<string, number> = { SOL: 9, USDC: 6, USDT: 6 };
const SOLANA_EXPLORER = "https://explorer.solana.com/tx";

type Token = keyof typeof MINTS;

export default function TradePage() {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { connection } = useConnection();
  const solana = useWallet();
  const solanaConnected = solana.connected;
  const solanaAddress = solana.publicKey?.toBase58() ?? null;

  const [agentId, setAgentId] = useState("1");
  const [inToken, setInToken] = useState<Token>("SOL");
  const [outToken, setOutToken] = useState<Token>("USDC");
  const [amount, setAmount] = useState("0.1");
  const [slippageBps] = useState(200);

  const [txResult, setTxResult] = useState<any>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [txStage, setTxStage] = useState<string>("");

  const { data: agentData, loading: agentLoading } = useQuery(AGENT, {
    variables: { id: agentId },
    skip: !agentId,
    pollInterval: 15000,
  });
  const [logSwap] = useMutation(LOG_BYREAL_SWAP);

  const agent = agentData?.agent;
  const eligible = useMemo(
    () => !!agent && agent.trustScore >= MIN_TRUST_SCORE,
    [agent]
  );

  const sdk = useMemo(
    () => (connection ? new ByrealSDK({ connection }) : null),
    [connection]
  );

  const onSwap = useCallback(async () => {
    setTxError(null);
    setTxResult(null);
    if (!evmConnected) return setTxError("Connect your Mantle wallet first.");
    if (!solanaConnected || !solana.publicKey || !solana.signTransaction)
      return setTxError("Connect a Solana wallet (Phantom or Backpack).");
    if (!sdk) return setTxError("Solana connection not ready.");
    if (!eligible || !agent)
      return setTxError(
        `Agent trust score ${agent?.trustScore ?? 0} is below ${MIN_TRUST_SCORE}.`
      );
    if (inToken === outToken) return setTxError("Tokens must differ.");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setTxError("Bad amount.");
    try {
      const inputMint = MINTS[inToken];
      const outputMint = MINTS[outToken];
      const rawAmount = uiToRaw(amount, DECIMALS[inToken]);

      setTxStage("Fetching Byreal quote…");
      const quote = await sdk.swap.getQuote({
        inputMint, outputMint, amount: rawAmount,
        swapMode: "in", slippageBps,
        userPublicKey: solana.publicKey.toBase58(),
      });
      if (!quote.ok) throw new Error(`Quote failed: ${quote.error ?? "unknown"}`);

      setTxStage("Executing swap… (sign in your Solana wallet)");
      const swapResult = await sdk.swap.executeSwap({
        inputMint, outputMint, amount: rawAmount,
        swapMode: "in",
        userPublicKey: solana.publicKey.toBase58(),
        signerCallback: async (tx: VersionedTransaction) => {
          return (await solana.signTransaction!(tx)) as VersionedTransaction;
        },
      });
      if (!swapResult.ok)
        throw new Error(`Swap failed: ${swapResult.error ?? "unknown"}`);

      const txHash = swapResult.value?.signatures?.[0];
      if (!txHash) throw new Error("No signature returned.");

      const cluster = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
      const explorerUrl = `${SOLANA_EXPLORER}/${txHash}?cluster=${cluster}`;

      setTxStage("Logging to ProofLattice…");
      let logResult: any = null;
      try {
        const res = await logSwap({
          variables: {
            input: {
              agentId, operatorEvmAddress: evmAddress, solanaAddress,
              inToken, outToken, amount: amt,
              txHash, explorerUrl, trustScoreAtExecution: agent.trustScore,
            },
          },
        });
        logResult = res.data?.logByrealSwap;
      } catch {}

      setTxResult(logResult ?? {
        txHash, explorerUrl, agentId, inToken, outToken,
        amount: amt, trustScoreAtExecution: agent.trustScore,
        executedAt: new Date().toISOString(),
      });
      setTxStage("");
    } catch (e: any) {
      console.error(e);
      setTxError(e?.message ?? "Swap failed");
      setTxStage("");
    }
  }, [evmAddress, evmConnected, solana, solanaConnected, solanaAddress,
      sdk, agent, eligible, inToken, outToken, amount, slippageBps,
      agentId, logSwap]);

  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto text-white">
      <header className="mb-8">
        <Link href="/" className="text-sm text-white/50 hover:text-white/80">
          ← Back to ProofLattice
        </Link>
        <h1 className="text-3xl font-bold mt-3">⚡ Byreal Trade</h1>
        <p className="text-white/60 mt-1">
          Trust-gated Solana swaps powered by{" "}
          <a href="https://www.npmjs.com/package/@byreal-io/byreal-sdk"
             target="_blank" rel="noreferrer"
             className="underline text-violet-300">@byreal-io/byreal-sdk</a>.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <WalletCard
          title="Mantle (EVM)"
          subtitle="Identity + Trust Score source"
          connected={evmConnected}
          address={evmAddress}
          isSolana={false}
          connectHint="Use Connect Wallet (top right) for Rabby / MetaMask"
        />
        <WalletCard
          title="Solana"
          subtitle="Swap execution + tx signing"
          connected={solanaConnected}
          address={solanaAddress}
          isSolana
          onConnect={() => window.dispatchEvent(new Event("open-solana-modal"))}
          connectHint="Phantom or Backpack (Solana mode)"
        />
      </section>

      <section className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
        <label className="text-sm text-white/60">Agent ID</label>
        <div className="flex flex-wrap gap-3 mt-2 items-center">
          <input type="number" min={1} value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="bg-black/40 border border-white/10 rounded px-3 py-2 text-white w-32" />
          {agentLoading ? (
            <span className="text-white/50 text-sm">Loading…</span>
          ) : agent ? (
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="text-white/60">Trust Score:</span>
              <span className={"font-mono font-bold " +
                (eligible ? "text-green-400" : "text-red-400")}>
                {agent.trustScore}
              </span>
              {agent.bgaCertified && (
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">BGA</span>
              )}
              <span className="text-white/40">(min {MIN_TRUST_SCORE} required)</span>
            </div>
          ) : (
            <span className="text-red-400 text-sm">Agent not found</span>
          )}
        </div>
      </section>

      <section className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-lg font-semibold mb-4">Swap</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-white/60">From</label>
            <select value={inToken} onChange={(e) => setInToken(e.target.value as Token)}
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 mt-1">
              {Object.keys(MINTS).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/60">To</label>
            <select value={outToken} onChange={(e) => setOutToken(e.target.value as Token)}
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 mt-1">
              {Object.keys(MINTS).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/60">Amount</label>
            <input type="number" step="0.01" min={0} value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 mt-1" />
          </div>
        </div>
        <button onClick={onSwap}
          disabled={!eligible || !evmConnected || !solanaConnected || !agent || !!txStage}
          className={"mt-5 w-full py-3 rounded font-semibold transition " +
            (eligible && evmConnected && solanaConnected && !txStage
              ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90"
              : "bg-white/10 text-white/40 cursor-not-allowed")}>
          {txStage ? txStage
            : !evmConnected ? "Connect Mantle wallet"
            : !solanaConnected ? "Connect Solana wallet"
            : !eligible ? `Locked — need ${MIN_TRUST_SCORE}+ trust`
            : "Execute Swap"}
        </button>
      </section>

      {txError && (
        <section className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-300 text-sm">⚠ {txError}</p>
        </section>
      )}
      {txResult && (
        <section className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
          <h3 className="text-green-300 font-semibold mb-3">✅ Swap executed</h3>
          <dl className="text-sm grid grid-cols-[140px,1fr] gap-y-2">
            <dt className="text-white/50">Tx Hash</dt>
            <dd className="font-mono break-all">{txResult.txHash}</dd>
            <dt className="text-white/50">Pair</dt>
            <dd>{txResult.amount} {txResult.inToken} → {txResult.outToken}</dd>
            <dt className="text-white/50">Trust @ exec</dt>
            <dd>{txResult.trustScoreAtExecution}</dd>
            <dt className="text-white/50">Agent</dt>
            <dd>#{txResult.agentId}</dd>
            <dt className="text-white/50">Explorer</dt>
            <dd><a href={txResult.explorerUrl} target="_blank" rel="noreferrer"
              className="text-violet-300 underline">View on Solana Explorer ↗</a></dd>
          </dl>
        </section>
      )}
    </main>
  );
}

function WalletCard({ title, subtitle, connected, address, onConnect, isSolana, connectHint }: {
  title: string;
  subtitle: string;
  connected: boolean;
  address?: string | null;
  onConnect?: () => void;
  isSolana?: boolean;
  connectHint?: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-white/50">{subtitle}</p>
        </div>
        <span className={"text-xs px-2 py-0.5 rounded " +
          (connected
            ? "bg-green-500/20 text-green-300"
            : "bg-white/10 text-white/50")}>
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
      {connected && address ? (
        <p className="text-xs font-mono text-white/60 mt-2 break-all">
          {address.slice(0, 6)}…{address.slice(-4)}
        </p>
      ) : !connected ? (
        <>
          {onConnect && (
            <button
              onClick={onConnect}
              className="mt-3 w-full py-1.5 rounded text-xs bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition"
            >
              Connect
            </button>
          )}
          {connectHint && (
            <p className="text-xs text-white/40 mt-2">↳ {connectHint}</p>
          )}
        </>
      ) : null}
    </div>
  );
}

