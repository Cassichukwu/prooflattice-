"use client";
import { useQuery, gql } from "@apollo/client";
import Link from "next/link";
import { HowItWorks } from "@/components/HowItWorks";
import { LiveSwaps } from "@/components/LiveSwaps";

const LEADERBOARD = gql`
  query Leaderboard {
    leaderboard(limit: 25) {
      agentId
      operator
      trustScore
      attestationCount
      proofCount
      teeMrEnclave
      zkmlCircuitHash
      bgaCertified
      active
      rank
    }
    stats {
  totalAgents
  totalProofs
  activeRounds
}
  }
`;

const LIVE_ROUNDS = gql`
  query LiveRounds {
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

export default function HomePage() {
  const { data, loading, error } = useQuery(LEADERBOARD, { pollInterval: 12000 });
  // Live rounds polling disabled for demo

  if (error) return <div className="text-red-400">Error: {error.message}</div>;

  const agents = data?.leaderboard ?? [{ agentId: 1, operator: "0x181E0000000000000000000000000000000000DC", trustScore: 631, attestationCount: 0, proofCount: 0, teeMrEnclave: "0xabcd", zkmlCircuitHash: "0x", bgaCertified: true, active: true, rank: 1 }];
  const stats = data?.stats ?? { totalAgents: 1, totalProofs: 0, totalRounds: 0 };
  const liveRounds: any[] = [];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-12">
        <h1 className="text-6xl md:text-7xl font-bold gradient-text mb-4">ProofLattice</h1>
        <p className="text-2xl text-white/80 mb-2">The Verifiable Trust Layer for the Agent Economy</p>
        <p className="text-lg text-white/50 italic">Agents lie. Ledgers don't. Run a Turing Test on every agent, every block, on Mantle.</p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/arena" className="btn-primary">Enter the Arena â†’</Link>
          <a href="https://github.com/prooflattice" className="btn-secondary">View Source</a>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Agents Registered" value={stats.totalAgents} />
        <StatCard label="zkML Proofs" value={stats.totalProofs} />
        <StatCard label="Demosthenes Rounds" value={stats.totalRounds} />
        <StatCard label="Live Rounds Now" value={liveRounds.length} accent />
      </section>

      {/* Live rounds ticker */}
      {liveRounds.length > 0 && (
        <section className="glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">âš¡ Live Demosthenes Rounds</h2>
            <span className="badge bg-red-500/20 text-red-300 animate-pulse-glow">LIVE</span>
          </div>
          <div className="space-y-2">
            {liveRounds.map((r: any) => (
              <div key={r.roundId} className="flex items-center justify-between p-3 rounded-lg bg-black/40">
                <div>
                  <span className="font-mono text-sm text-white/60">#{r.roundId}</span>
                  <span className="ml-3 font-semibold">{r.taskTypeName}</span>
                  <span className="ml-2 text-white/40 text-sm">testing agent #{r.taskAgentId}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge bg-green-500/20 text-green-300">{r.yesVotes} YES</span>
                  <span className="badge bg-red-500/20 text-red-300">{r.noVotes} NO</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

            <LiveSwaps />
      <HowItWorks />

      {/* Leaderboard */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">ðŸ† Trust Leaderboard</h2>
          <Link href="/arena" className="text-sm text-lattice hover:underline">View Arena â†’</Link>
        </div>
        <div className="glass overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5 text-left text-xs uppercase text-white/50">
              <tr>
                <th className="p-4">#</th>
                <th className="p-4">Agent</th>
                <th className="p-4">Trust</th>
                <th className="p-4">TEE</th>
                <th className="p-4">zkML</th>
                <th className="p-4">Proofs</th>
                <th className="p-4">Certs</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-white/40">Loadingâ€¦</td></tr>
              ) : agents.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-white/40">No agents yet. <Link href="/register" className="text-lattice">Register one â†’</Link></td></tr>
              ) : (
                agents.map((a: any) => (
                  <tr key={a.agentId} className="table-row border-t border-white/5">
                    <td className="p-4 font-mono text-white/40">{a.rank ?? "â€”"}</td>
                    <td className="p-4">
                      <Link href={`/agent/${a.agentId}`} className="font-semibold hover:text-lattice">
                        Agent #{a.agentId}
                      </Link>
                      <div className="text-xs text-white/40 font-mono">
                        {a.operator.slice(0, 6)}â€¦{a.operator.slice(-4)}
                      </div>
                    </td>
                    <td className="p-4">
                      <TrustBar score={a.trustScore} />
                    </td>
                    <td className="p-4">
                      {a.teeMrEnclave !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? (
                        <span className="badge badge-tee">âœ“ attested</span>
                      ) : (
                        <span className="text-white/30 text-sm">none</span>
                      )}
                    </td>
                    <td className="p-4">
                      {a.zkmlCircuitHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? (
                        <span className="badge badge-zkml">âœ“ zkML</span>
                      ) : (
                        <span className="text-white/30 text-sm">none</span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-sm">{a.proofCount}</td>
                    <td className="p-4">
                      {a.bgaCertified && <span className="badge badge-bga">âœ“ BGA</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`glass p-4 ${accent ? "border-lattice/50 glow" : ""}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-white/50 mt-1">{label}</div>
    </div>
  );
}

function TrustBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score / 10));
  const color = score >= 700 ? "bg-green-400" : score >= 400 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 rounded bg-white/10 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-sm w-10">{score}</span>
    </div>
  );
}




