"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Leaderboard" },
  { href: "/arena", label: "Arena" },
  { href: "/agents", label: "All Agents" },
  { href: "/dashboard", label: "Operator" },
  { href: "/about", label: "About" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-white/10 bg-black/30 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-lattice glow flex items-center justify-center font-bold text-black">P</div>
          <span className="text-lg font-bold">ProofLattice</span>
          <span className="hidden sm:inline text-xs text-white/40 ml-2">on Mantle</span>
        </Link>
        <div className="flex items-center gap-1">
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
        <a
          href="https://github.com/prooflattice"
          className="text-xs text-white/50 font-mono hidden md:inline"
        >
          v0.1.0 · testnet
        </a>
      </div>
    </nav>
  );
}
