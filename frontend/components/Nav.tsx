"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Leaderboard" },
  { href: "/arena", label: "Arena" },
  { href: "/trade", label: "Byreal Trade" },
  { href: "/agents", label: "All Agents" },
  { href: "/dashboard", label: "Operator" },
  { href: "/about", label: "About" },
];

export function Nav() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showConnect, setShowConnect] = useState(false);

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  return (
    <nav className="border-b border-white/10 bg-black/30 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded bg-lattice glow flex items-center justify-center font-bold text-black">P</div>
          <span className="text-lg font-bold">ProofLattice</span>
          <span className="hidden sm:inline text-xs text-white/40 ml-2">on Mantle</span>
        </Link>
        <div className="flex items-center gap-1 flex-1 justify-center">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                pathname === l.href ? "bg-lattice/20 text-lattice" : "text-white/70 hover:bg-white/5"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConnected ? (
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-xs font-mono text-white/60">{short}</span>
              <button
                onClick={() => disconnect()}
                className="px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 transition"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowConnect((s) => !s)}
                disabled={isPending}
                className="px-3 py-1.5 rounded-lg text-sm bg-lattice/20 text-lattice hover:bg-lattice/30 transition disabled:opacity-50"
              >
                {isPending ? "Connecting…" : "Connect Wallet"}
              </button>
              {showConnect && (
                <div className="absolute right-0 mt-2 w-64 glass p-2 rounded-lg z-50">
                  {connectors.length === 0 && (
                    <p className="text-xs text-white/50 p-2">No wallet detected. Install Rabby or MetaMask.</p>
                  )}
                  {connectors.map((c) => (
                    <button
                      key={c.uid}
                      onClick={() => {
                        connect({ connector: c });
                        setShowConnect(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-sm"
                    >
                      {c.name}
                      {c.id === "injected" && <span className="ml-2 text-xs text-white/40">(Rabby / MetaMask)</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <a
            href="https://github.com/Cassichukwu/prooflattice-"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/50 font-mono hidden md:inline"
          >
            v0.1.0 · testnet
          </a>
        </div>
      </div>
    </nav>
  );
}
