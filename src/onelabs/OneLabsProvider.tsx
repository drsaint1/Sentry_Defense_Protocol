"use client";

import { ReactNode, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  SuiClientProvider,
  WalletProvider,
  createNetworkConfig,
} from "@onelabs/dapp-kit";
import "@onelabs/dapp-kit/dist/index.css";
import { ONELABS_CONFIG } from "../config/contracts";

const { networkConfig } = createNetworkConfig({
  testnet: {
    url: ONELABS_CONFIG.RPC_URL,
  },
});

interface OneLabsProviderProps {
  children: ReactNode;
  defaultNetwork?: keyof typeof networkConfig;
}

export default function OneLabsProvider({
  children,
  defaultNetwork = "testnet",
}: OneLabsProviderProps) {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={defaultNetwork}>
        <WalletProvider autoConnect enableUnsafeBurner>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
