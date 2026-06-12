"use client";
import { useQuery, gql } from "@apollo/client";
import Link from "next/link";

const ALL = gql`
  query All {
    leaderboard(limit: 200) {
      agentId
      operator
      trustScore
      attestationCount
      proofCount
      teeMrEnclave
      zkmlCircuitHash
      bgaCertified
    }
  }
`;

export default function AllAgentsPage() {
  const { data, loading } = useQuery(ALL, { pollInterval: 15000 });
  const agents = data?.leaderboard ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">All Registered Agents ({agents.length})</h1>
      <div className="glass overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase text-white/50">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Operator</th>
              <th className="p-3 text-right">Trust</th>
              <th className="p-3 text-right">Proofs</th>
              <th className="p-3 text-left">TEE</th>
              <th className="p-3 text-left">zkML</th>
              <th className="p-3 text-left">Certs</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-white/40">Loading…</td></tr>
            ) : (
              agents.map((a: any) => (
                <tr key={a.agentId} className="border-t border-white/5 table-row">
                  <td className="p-3 font-mono">
                    <Link href={`/agent/${a.agentId}`} className="hover:text-lattice">#{a.agentId}</Link>
                  </td>
                  <td className="p-3 font-mono text-xs text-white/50">
                    {a.operator.slice(0, 6)}…{a.operator.slice(-4)}
                  </td>
                  <td className="p-3 text-right font-mono">{a.trustScore}</td>
                  <td className="p-3 text-right font-mono">{a.proofCount}</td>
                  <td className="p-3">{a.teeMrEnclave !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? "✓" : "—"}</td>
                  <td className="p-3">{a.zkmlCircuitHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? "✓" : "—"}</td>
                  <td className="p-3">{a.bgaCertified ? <span className="badge badge-bga">BGA</span> : ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
