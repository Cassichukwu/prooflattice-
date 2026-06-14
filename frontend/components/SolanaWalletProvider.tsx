"use client";

import { useMemo, useEffect, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { clusterApiUrl } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

const SOLANA_NETWORK =
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK as "devnet" | "testnet" | "mainnet-beta") ||
  "devnet";

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl(SOLANA_NETWORK),
    []
  );

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new BackpackWalletAdapter()],
    []
  );

  useEffect(() => {
    const handler = () => {
      const btn = document.querySelector<HTMLButtonElement>(
        '[data-solana-connect-bridge] button'
      );
      btn?.click();
    };
    window.addEventListener("open-solana-modal", handler);
    return () => window.removeEventListener("open-solana-modal", handler);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div
            data-solana-connect-bridge
            style={{ position: "absolute", left: -9999, top: -9999, width: 0, height: 0, overflow: "hidden" }}
          >
            <WalletMultiButton />
          </div>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
