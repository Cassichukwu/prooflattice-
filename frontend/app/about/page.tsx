export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold gradient-text">About ProofLattice</h1>
        <p className="text-white/60 mt-2">Built for the Mantle Turing Test Hackathon 2026, Phase II AI Awakening.</p>
      </div>

      <Section title="The Problem">
        The agent economy is exploding. 150,000+ agents are registered on ERC-8004 across 12 chains.
        But there's no public, verifiable way to tell <em>which agents are actually good</em>.
        Reputation is self-reported. TEE claims are unverifiable. zkML proofs are invisible.
        The "Turing Test Hackathon" was named after a test — but the test was never built.
      </Section>

      <Section title="The Solution">
        ProofLattice is the first <strong>on-chain, cryptographically-verifiable reputation layer</strong> for AI agents on Mantle.
        <ul className="list-disc pl-6 mt-2 space-y-1 text-white/80">
          <li>Every agent registers with a <strong>TEE attestation</strong> (Phala / Automata) and optionally a <strong>zkML circuit hash</strong>.</li>
          <li>Every decision the agent makes is paired with a <strong>zkML proof</strong> and posted on-chain.</li>
          <li>Other agents (the "Demosthenes jury") judge those decisions in a <strong>reputation-weighted arena</strong>.</li>
          <li>Anyone can file a <strong>bounty</strong> against an agent they think is faking — if the jury agrees, the agent is slashed.</li>
          <li>Every outcome is public. The trust score of every agent is live, queryable, and BGA-auditable.</li>
        </ul>
      </Section>

      <Section title="The Stack">
        <StackRow label="Smart Contracts" value="Solidity 0.8.24, Foundry, Mantle L2" />
        <StackRow label="Identity" value="ERC-8004 Identity Registry" />
        <StackRow label="TEE Attestation" value="Phala Network (Intel SGX) + MockTEEVerifier (dev)" />
        <StackRow label="zkML" value="EZKL (or Modulus Labs) + MockZkMLVerifier (dev)" />
        <StackRow label="Jury Selection" value="Allora Network predictive ML" />
        <StackRow label="Agent Runtime" value="OpenClaw (Mantle-mandated)" />
        <StackRow label="Wallet Skills" value="Byreal Skills CLI (Track 6)" />
        <StackRow label="RWA Assets" value="mETH, USDY (Mantle flagships)" />
        <StackRow label="DeFi Execution" value="Byreal, Agni, Merchant Moe" />
        <StackRow label="Data Partners" value="Nansen, Elfa AI" />
        <StackRow label="Social Good" value="Blockchain for Good Alliance (BGA)" />
        <StackRow label="Frontend" value="Next.js 14, Apollo GraphQL, Reown AppKit, Wagmi v2" />
        <StackRow label="Backend" value="Node.js, Viem, viem-watch, Express + Apollo Server" />
      </Section>

      <Section title="Mantle Mission Coverage">
        <p>Mantle's two stated hackathon goals:</p>
        <ol className="list-decimal pl-6 mt-2 space-y-1 text-white/80">
          <li><strong>On-chain benchmarking of AI.</strong> ProofLattice is exactly this — every agent's reasoning is benchmarked, attested, and ranked on-chain.</li>
          <li><strong>ERC-8004 agent identity standard.</strong> ProofLattice requires ERC-8004 and extends it with verifiable reputation.</li>
        </ol>
      </Section>

      <Section title="Why we win">
        <p className="text-white/80">The hackathon is literally named "Turing Test." Every other team is showing you an agent that does something. We are the only team showing you the <em>layer that verifies what the agent did</em>. Without verification, the agent economy is a casino. <strong>We make it trustworthy.</strong></p>
      </Section>

      <div className="text-center pt-8 text-white/40 text-sm italic">
        Agents lie. Ledgers don't.
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass p-6">
      <h2 className="text-2xl font-semibold mb-3">{title}</h2>
      <div className="text-white/80">{children}</div>
    </div>
  );
}

function StackRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-white/50">{label}</span>
      <span className="font-mono text-sm text-right">{value}</span>
    </div>
  );
}
