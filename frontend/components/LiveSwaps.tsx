"use client";

import { useQuery, gql } from "@apollo/client";
import { useState } from "react";

const RECENT_SWAPS = gql`
  query RecentSwaps {
    recentByrealSwaps(limit: 6) {
      id txHash agentId inToken outToken amount trustScoreAtExecution executedAt
    }
  }
`;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function LiveSwaps() {
  const [expanded, setExpanded] = useState(false);
  const { data, loading } = useQuery(RECENT_SWAPS, { pollInterval: 8000, fetchPolicy: "cache-and-network" });
  const swaps = data?.recentByrealSwaps ?? [];
  if (loading && swaps.length === 0) return null;
  if (swaps.length === 0) {
    return (
      <section className="mb-12 bg-white/5 border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-white/40" />
          <h2 className="text-lg font-semibold">Last Byreal Swaps</h2>
        </div>
        <p className="text-sm text-white/50">No swaps yet. The first trust-gated swap on ProofLattice will appear here.</p>
      </section>
    );
  }
  return (
    <section className="mb-12 bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-lattice animate-pulse" />
          <h2 className="text-lg font-semibold">Last Byreal Swaps</h2>
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="text-xs text-white/50 hover:text-white">
          {expanded ? "Show less" : "Show all"}
        </button>
      </div>
      <ul className="space-y-2">
        {swaps.slice(0, expanded ? 6 : 3).map((s: any) => (
          <li key={s.id} className="flex items-center justify-between gap-3 text-sm bg-black/30 rounded-lg px-3 py-2 hover:bg-black/40 transition">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-white/40 w-16 shrink-0">{timeAgo(s.executedAt)}</span>
              <span className="font-mono text-white/80 truncate">Agent #{s.agentId}</span>
              <span className="text-white/60">{s.amount} {s.inToken} → {s.outToken}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-white/50">trust {s.trustScoreAtExecution}</span>
              <a href={`https://explorer.solana.com/tx/${s.txHash}?cluster=devnet`} target="_blank" rel="noreferrer" className="text-violet-300 hover:text-violet-200 text-xs">tx ↗</a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
