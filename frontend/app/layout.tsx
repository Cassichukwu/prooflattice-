import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "ProofLattice — Trust Layer for the Agent Economy",
  description: "The first on-chain, cryptographically-verifiable reputation and benchmarking layer for AI agents on Mantle. ERC-8004 native. TEE-attested. zkML-proven.",
  openGraph: {
    title: "ProofLattice",
    description: "Agents lie. Ledgers don't.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
          <footer className="border-t border-white/10 mt-20 py-8 text-center text-sm text-white/40">
            <p>Built for the <span className="text-lattice">Mantle Turing Test Hackathon 2026</span> · Phase II AI Awakening</p>
            <p className="mt-2 font-mono text-xs">ERC-8004 · TEE · zkML · Allora · BGA</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
