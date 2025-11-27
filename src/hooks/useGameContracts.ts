/**
 * Hook for managing on-chain game actions
 * Batches transactions and handles blockchain interactions during gameplay
 */

import { useCallback, useRef, useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@onelabs/dapp-kit";
import {
  buildRecordKillsTx,
  buildRecordWaveCompletionTx,
  buildGrantDeploymentBonusTx,
  fetchPlayerMachines,
  fetchPlayerProfile,
  machineIdToType,
} from "../services/contractService";

export type GameContractsState = {
  isRecording: boolean;
  pendingKills: number;
  lastRecordedWave: number;
};

export function useGameContracts() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [state, setState] = useState<GameContractsState>({
    isRecording: false,
    pendingKills: 0,
    lastRecordedWave: 0,
  });

  const pendingKillsRef = useRef(0);
  const killBatchTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Record kills on-chain (batched - manual save only, no auto-popup)
   */
  const recordKills = useCallback(
    async (machineId: string, killCount: number) => {
      if (!account?.address) return false;

      pendingKillsRef.current += killCount;
      setState((s) => ({ ...s, pendingKills: pendingKillsRef.current }));

      console.log(`Accumulated ${pendingKillsRef.current} kills (will save manually)`);
      return false;
    },
    [account?.address]
  );

  /**
   * Submit batched kills to blockchain
   */
  const submitPendingKills = useCallback(
    async (machineId: string): Promise<boolean> => {
      if (!account?.address || pendingKillsRef.current === 0) return false;

      setState((s) => ({ ...s, isRecording: true }));

      try {
        const [machines, profile] = await Promise.all([
          fetchPlayerMachines(client, account.address),
          fetchPlayerProfile(client, account.address),
        ]);

        if (!profile) {
          console.error("Player profile not found");
          return false;
        }

        const machineType = machineIdToType(machineId);
        const machine = machines.find((m) => m.machineType === machineType);

        if (!machine) {
          console.error("Machine not found");
          return false;
        }

        const killsToSubmit = pendingKillsRef.current;

        const tx = buildRecordKillsTx(
          machine.objectId,
          profile.objectId,
          killsToSubmit
        );

        await signAndExecuteTransaction({
          transaction: tx,
        });

        console.log(`✓ Recorded ${killsToSubmit} kills on-chain`);

        pendingKillsRef.current = 0;
        setState((s) => ({ ...s, pendingKills: 0, isRecording: false }));

        return true;
      } catch (error: any) {
        console.error("Error recording kills:", error);
        setState((s) => ({ ...s, isRecording: false }));
        return false;
      }
    },
    [account?.address, client, signAndExecuteTransaction]
  );

  /**
   * Record wave completion on-chain
   */
  const recordWaveCompletion = useCallback(
    async (waveNumber: number, score: number): Promise<boolean> => {
      if (!account?.address) return false;

      setState((s) => ({ ...s, isRecording: true }));

      try {
        const profile = await fetchPlayerProfile(client, account.address);

        if (!profile) {
          console.error("Player profile not found");
          setState((s) => ({ ...s, isRecording: false }));
          return false;
        }

        const tx = buildRecordWaveCompletionTx(profile.objectId, waveNumber, score);

        await signAndExecuteTransaction({
          transaction: tx,
        });

        console.log(`✓ Recorded wave ${waveNumber} completion on-chain`);

        setState((s) => ({
          ...s,
          lastRecordedWave: waveNumber,
          isRecording: false,
        }));

        return true;
      } catch (error: any) {
        console.error("Error recording wave completion:", error);
        setState((s) => ({ ...s, isRecording: false }));
        return false;
      }
    },
    [account?.address, client, signAndExecuteTransaction]
  );

  /**
   * Grant deployment bonus on first game start
   */
  const grantDeploymentBonus = useCallback(async (): Promise<boolean> => {
    if (!account?.address) return false;

    try {
      const profile = await fetchPlayerProfile(client, account.address);

      if (!profile) {
        console.error("Player profile not found");
        return false;
      }

      if (profile.gamesPlayed > 0) {
        return false;
      }

      const tx = buildGrantDeploymentBonusTx(profile.objectId);

      await signAndExecuteTransaction({
        transaction: tx,
      });

      console.log("✓ Granted deployment bonus");

      return true;
    } catch (error: any) {
      console.error("Error granting deployment bonus:", error);
      return false;
    }
  }, [account?.address, client, signAndExecuteTransaction]);

  /**
   * Force submit any pending kills (called on game end)
   */
  const flushPendingKills = useCallback(
    async (machineId: string) => {
      if (killBatchTimerRef.current) {
        clearTimeout(killBatchTimerRef.current);
        killBatchTimerRef.current = null;
      }

      if (pendingKillsRef.current > 0) {
        await submitPendingKills(machineId);
      }
    },
    [submitPendingKills]
  );

  return {
    state,
    recordKills,
    recordWaveCompletion,
    grantDeploymentBonus,
    flushPendingKills,
    submitPendingKills,
  };
}