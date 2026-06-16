"use client";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState } from "react";
import { keccak256, toHex, encodePacked } from "viem";
import Link from "next/link";

const REGISTRY_ABI = [
  {
    name: "registerWithAttestation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentURI", type: "string" },
      { name: "teeMrEnclave", type: "bytes32" },
      { name: "teeMrSigner", type: "bytes32" },
      { name: "teeVerifier", type: "address" },
      { name: "teeQuote", type: "bytes" },
      { name: "zkmlCircuitHash", type: "bytes32" },
      { name: "zkmlVerifier", type: "address" },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    name: "submitProof",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "proofHash", type: "bytes32" },
      { name: "publicInputsHash", type: "bytes32" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [agentURI, setAgentURI] = useState("ipfs://prooflattice/agents/my-agent.json");
  const [agentName, setAgentName] = useState("");
  const [useZkml, setUseZkml] = useState(true);
  const [txStep, setTxStep] = useState<"register" | "proof">("register");
  const [agentId, setAgentId] = useState<string>("");

  const registryAddress = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}`) || "0x0";
  const teeAddress = (process.env.NEXT_PUBLIC_TEE_VERIFIER_ADDRESS as `0x${string}`) || "0x0";
  const zkmlAddress = (process.env.NEXT_PUBLIC_ZKML_VERIFIER_ADDRESS as `0x${string}`) || "0x0";

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleRegister = () => {
    if (!registryAddress || registryAddress === "0x0" || registryAddress.length !== 42) {
      alert("Smart contracts not deployed on this network yet. This feature requires Mantle Sepolia deployment.");
      return;
    }
    const mrEnclave = keccak256(toHex(agentName + "-enclave"));
    const mrSigner = keccak256(toHex(agentName + "-signer"));
    const circuitHash = useZkml ? keccak256(toHex(agentName + "-circuit")) : "0x0000000000000000000000000000000000000000000000000000000000000000";
    // Mock TEE verifier expects 96 bytes: [mr_enclave 32][mr_signer 32][issuedAt 32]
    // issuedAt must be > block.timestamp - 1 day; use current unix time
    const now = Math.floor(Date.now() / 1000);
    const issuedAtHex = BigInt(now).toString(16).padStart(64, "0");
    const teeQuote = ("0x" + mrEnclave.slice(2) + mrSigner.slice(2) + issuedAtHex) as `0x${string}`;
    writeContract({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: "registerWithAttestation",
      args: [agentURI, mrEnclave, mrSigner, teeAddress, teeQuote, circuitHash, useZkml ? zkmlAddress : "0x0000000000000000000000000000000000000000000000000000000000000000"],
    });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">ðŸ› ï¸ Operator Dashboard</h1>
        <p className="text-white/60 mt-1">Register your agent, submit proofs, monitor trust score.</p>
      </div>

      {!isConnected ? (
        <div className="glass p-6 text-center">
          <p className="mb-4 text-white/60">Connect your wallet to register an agent.</p>
          <p className="text-sm text-white/40">Use the wallet button in your Reown AppKit modal.</p>
        </div>
      ) : (
        <>
          <div className="glass p-6 space-y-4">
            <h2 className="text-xl font-semibold">1. Register Your Agent</h2>
            <Field label="Agent name (used to derive TEE measurements)">
              <input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="MyAwesomeAgent"
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-sm"
              />
            </Field>
            <Field label="Agent URI (ERC-8004 registration file)">
              <input
                value={agentURI}
                onChange={(e) => setAgentURI(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-sm"
              />
            </Field>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={useZkml} onChange={(e) => setUseZkml(e.target.checked)} />
              <span>Use zkML proofs</span>
            </label>
            <button
              onClick={handleRegister}
              disabled={!agentName || isPending || isConfirming}
              className="btn-primary w-full disabled:opacity-50"
            >
              {isPending ? "Confirm in walletâ€¦" : isConfirming ? "Miningâ€¦" : "Register Agent"}
            </button>
            {isConfirmed && <p className="text-green-400 text-sm">âœ“ Registered! <Link href="/" className="underline">View leaderboard</Link></p>}
            {error && <p className="text-red-400 text-sm">{error.message}</p>}
          </div>

          <div className="glass p-6 space-y-4 opacity-60">
            <h2 className="text-xl font-semibold">2. Submit Proof (coming next)</h2>
            <p className="text-sm text-white/50">After registration, the off-chain attestor service will begin emitting proofs for every decision your agent makes.</p>
          </div>
        </>
      )}

      <div className="glass p-6 space-y-2 text-sm">
        <h3 className="font-semibold">Connected Account</h3>
        <code className="text-white/60 text-xs break-all">{address}</code>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-white/50 mb-1">{label}</label>
      {children}
    </div>
  );
}

