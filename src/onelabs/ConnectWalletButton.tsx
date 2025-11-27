"use client";

import {
  ConnectModal,
  useCurrentAccount,
  useDisconnectWallet,
} from "@onelabs/dapp-kit";
import {
  ButtonHTMLAttributes,
  MouseEvent,
  ReactNode,
  useEffect,
  useMemo,
} from "react";
import { setWalletStatus } from "../ui/gameBridge";

type HTMLButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export type WalletConnectButtonProps = HTMLButtonProps & {
  /**
   * Text to display when no wallet is connected and no children are provided.
   */
  labelWhenDisconnected?: ReactNode;
};

function formatAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function WalletConnectButton({
  labelWhenDisconnected = "Connect Wallet",
  children,
  type = "button",
  onClick,
  disabled,
  ...rest
}: WalletConnectButtonProps) {
  const currentAccount = useCurrentAccount();
  const { mutate: disconnectWallet, isPending: isDisconnecting } =
    useDisconnectWallet();
  useEffect(() => {
    setWalletStatus(!!currentAccount, currentAccount?.address);
  }, [currentAccount]);

  const connectedLabel = useMemo(() => {
    if (!currentAccount) return null;
    if (children !== undefined) {
      return children;
    }
    return formatAddress(currentAccount.address);
  }, [children, currentAccount]);

  if (currentAccount) {
    const handleDisconnect = (event: MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) {
        return;
      }
      disconnectWallet();
    };

    return (
      <button
        type={type}
        {...rest}
        onClick={handleDisconnect}
        disabled={disabled || isDisconnecting}
      >
        {isDisconnecting
          ? "Disconnecting..."
          : connectedLabel ?? formatAddress(currentAccount.address)}
      </button>
    );
  }

  return (
    <ConnectModal
      trigger={
        <button type={type} {...rest} onClick={onClick} disabled={disabled}>
          {children ?? labelWhenDisconnected}
        </button>
      }
    />
  );
}
