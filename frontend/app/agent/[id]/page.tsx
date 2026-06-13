"use client";
import { useQuery, gql } from "@apollo/client";
import Link from "next/link";

const AGENT = gql`
  query Agent($id: ID!) {
    agent(id: $id) {
      agentId
      operator
      trustScore
      attestationCount
      proofCount
      teeMrEnclave
      teeMrSigner
      zkmlCircuitHash
      bgaCertified
      active
      firstSeen
      lastAttested
    }
  }
`;

const ROUNDS = gql`
  query Rounds {
    rounds(limit: 50) {
      roundId
      taskAgentId
      taskTypeName
      stateName
      trustDelta
    }
  }
`;

export default function AgentPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const { data, loading } = useQuery(AGENT, { variables: { id } });
  const { data: roundsData } = useQuery(ROUNDS, { pollInterval: 10000 });

  if (loading) return <div className="text-white/40">Loading…</div>;
  if (!data?.agent) return <div className="text-red-400">Agent not found</div>;

  const a = data.agent;
  const agentRounds = (roundsData?.rounds ?? []).filter((r: any) => r.taskAgentId === a.agentId);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-white/50 hover:text-lattice">← Back to leaderboard</Link>
      </div>

      <div className="glass p-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold">Agent #{a.agentId}</h1>
            <div className="text-white/50 font-mono text-sm mt-1">{a.operator}</div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold gradient-text">{a.trustScore}</div>
            <div className="text-xs text-white/50">Trust Score / 1000</div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {a.active ? <span className="badge bg-green-500/20 text-green-300">Active</span> : <span className="badge bg-red-500/20 text-red-300">Inactive</span>}
          {a.teeMrEnclave !== "0x0000000000000000000000000000000000000000000000000000000000000000" && <span className="badge badge-tee">✓ TEE attested</span>}
          {a.zkmlCircuitHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && <span className="badge badge-zkml">✓ zkML bound</span>}
          {a.bgaCertified && <span className="badge badge-bga">✓ BGA certified</span>}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Proofs Submitted" value={a.proofCount} />
        <Card title="TEE Re-attestations" value={a.attestationCount} />
        <Card title="Demosthenes Rounds" value={agentRounds.length} />
      </div>

      <div className="glass p-6">
        <h2 className="text-lg font-semibold mb-3">Cryptographic Attestations</h2>
        <div className="space-y-2 text-sm font-mono">
          <Field label="TEE mr_enclave" value={a.teeMrEnclave} />
          <Field label="TEE mr_signer" value={a.teeMrSigner} />
          <Field label="zkML circuit hash" value={a.zkmlCircuitHash} />
          <Field label="First seen" value={new Date(a.firstSeen * 1000).toISOString()} />
          <Field label="Last attested" value={new Date(a.lastAttested * 1000).toISOString()} />
        </div>
      </div>

      {agentRounds.length > 0 && (
        <div className="glass p-6">
          <h2 className="text-lg font-semibold mb-3">Demosthenes History</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-white/40 uppercase">
              <tr>
                <th className="text-left p-2">Round</th>
                <th className="text-left p-2">Task</th>
                <th className="text-left p-2">State</th>
                <th className="text-right p-2">Trust Δ</th>
              </tr>
            </thead>
            <tbody>
              {agentRounds.map((r: any) => (
                <tr key={r.roundId} className="border-t border-white/5">
                  <td className="p-2 font-mono">#{r.roundId}</td>
                  <td className="p-2">{r.taskTypeName}</td>
                  <td className="p-2">{r.stateName}</td>
                  <td className={`p-2 text-right font-mono ${r.trustDelta > 0 ? "text-green-400" : r.trustDelta < 0 ? "text-red-400" : "text-white/30"}`}>
                    {r.trustDelta > 0 ? "+" : ""}{r.trustDelta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="glass p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-white/50 mt-1">{title}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-white/40 w-40">{label}</div>
      <div className="text-white/80 break-all">{value}</div>
    </div>
  );
}
