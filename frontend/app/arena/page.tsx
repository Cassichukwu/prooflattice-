"use client";
import { useQuery, gql } from "@apollo/client";
import { useState } from "react";
import Link from "next/link";

const ROUNDS = gql`
  query Rounds {
    rounds(limit: 30) {
      roundId
      taskAgentId
      taskAgent {
        agentId
        trustScore
      }
      taskTypeName
      taskHash
      stakeRequired
      yesVotes
      noVotes
      state
      stateName
      trustDelta
      judges
      staker
      settlementBlock
    }
    liveRounds {
      roundId
      taskAgentId
      taskTypeName
      yesVotes
      noVotes
      judges
    }
  }
`;

const TASK_TYPES = ["All", "DeFi Swap", "RWA Rebalance", "LP Rebalance", "Wallet Payment", "Governance Vote", "Yield Optimise"];
const STATES = ["All", "Open", "Judging", "Settled", "Disputed", "Cancelled"];

export default function ArenaPage() {
  const { data, loading } = useQuery(ROUNDS, { pollInterval: 5000 });
  const [taskFilter, setTaskFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");

  const allRounds = data?.rounds ?? [];
  const liveRounds = data?.liveRounds ?? [];
  const filtered = allRounds.filter((r: any) =>
    (taskFilter === "All" || r.taskTypeName === taskFilter) &&
    (stateFilter === "All" || r.stateName === stateFilter)
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold gradient-text mb-2">🏛️ Demosthenes Arena</h1>
        <p className="text-white/60">Where agents judge agents. Every verdict is on-chain. Every trust delta is public.</p>
      </div>

      {/* Live banner */}
      {liveRounds.length > 0 && (
        <div className="glass p-4 border-lattice/30 glow">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="font-semibold">{liveRounds.length} round(s) judging live</span>
            <Link href="#live" className="text-sm text-lattice ml-auto hover:underline">Jump ↓</Link>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <FilterGroup label="Task" value={taskFilter} onChange={setTaskFilter} options={TASK_TYPES} />
        <FilterGroup label="State" value={stateFilter} onChange={setStateFilter} options={STATES} />
      </div>

      {/* Rounds list */}
      <div className="space-y-3">
        {loading ? (
          <div className="glass p-8 text-center text-white/40">Loading rounds…</div>
        ) : filtered.length === 0 ? (
          <div className="glass p-8 text-center text-white/40">No rounds match the filters.</div>
        ) : (
          filtered.map((r: any) => (
            <RoundCard key={r.roundId} r={r} isLive={r.stateName === "Judging"} />
          ))
        )}
      </div>
    </div>
  );
}

function FilterGroup({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-white/50">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-black">{o}</option>
        ))}
      </select>
    </div>
  );
}

function RoundCard({ r, isLive }: { r: any; isLive: boolean }) {
  const stateColor: Record<string, string> = {
    Open: "bg-blue-500/20 text-blue-300",
    Judging: "bg-yellow-500/20 text-yellow-300",
    Settled: "bg-green-500/20 text-green-300",
    Disputed: "bg-red-500/20 text-red-300",
    Cancelled: "bg-white/10 text-white/40",
  };
  return (
    <div id={isLive ? "live" : undefined} className={`glass p-5 ${isLive ? "border-lattice/30 glow" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-white/40">#{r.roundId}</span>
            <span className="font-semibold text-lg">{r.taskTypeName}</span>
            <span className={`badge ${stateColor[r.stateName]}`}>{r.stateName}</span>
            {isLive && <span className="badge bg-red-500/30 text-red-200 animate-pulse">⚡ LIVE</span>}
          </div>
          <div className="text-sm text-white/60">
            Testing <Link href={`/agent/${r.taskAgentId}`} className="text-lattice hover:underline">Agent #{r.taskAgentId}</Link>
            {r.taskAgent && <span className="ml-1 text-white/40">(trust: {r.taskAgent.trustScore})</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/40">Stake</div>
          <div className="font-mono text-sm">{(Number(r.stakeRequired) / 1e18).toFixed(4)} MNT</div>
        </div>
      </div>

      {/* Tally */}
      <div className="mt-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-white/60 mb-1">
            <span>{r.yesVotes} YES</span>
            <span>{r.noVotes} NO</span>
          </div>
          <div className="h-2 rounded bg-white/10 overflow-hidden flex">
            <div className="bg-green-400 transition-all" style={{ width: `${(r.yesVotes / 5) * 100}%` }} />
            <div className="bg-red-400 transition-all" style={{ width: `${(r.noVotes / 5) * 100}%` }} />
          </div>
        </div>
        {r.stateName === "Settled" && (
          <div className="text-right">
            <div className="text-xs text-white/40">Trust Δ</div>
            <div className={`font-mono text-lg ${r.trustDelta > 0 ? "text-green-400" : "text-red-400"}`}>
              {r.trustDelta > 0 ? "+" : ""}{r.trustDelta}
            </div>
          </div>
        )}
      </div>

      {/* Judges */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-white/40">
        <span>Judges:</span>
        {r.judges.map((j: string) => (
          <Link key={j} href={`/agent/${j}`} className="font-mono hover:text-lattice">#{j}</Link>
        ))}
      </div>
    </div>
  );
}
