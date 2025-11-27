import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@onelabs/dapp-kit';
import { Transaction } from '@onelabs/sui/transactions';
import { SENTRY_DEFENSE_CONTRACT, MACHINE_TYPES, TOKEN_AMOUNTS } from '../config/contracts';

export function useSentryContract() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const mintMachine = async (machineType: 1 | 2 | 3, paymentCoinId: string) => {
    if (!account) throw new Error('Wallet not connected');

    const tx = new Transaction();

    tx.moveCall({
      target: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::mint_machine`,
      arguments: [
        tx.object(SENTRY_DEFENSE_CONTRACT.REGISTRY_ID),
        tx.pure.u8(machineType),
        tx.object(paymentCoinId),
      ],
    });

    const result = await signAndExecuteTransaction({
      transaction: tx,
    });

    return result;
  };

  const initPlayerProfile = async () => {
    if (!account) throw new Error('Wallet not connected');

    const tx = new Transaction();

    tx.moveCall({
      target: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::init_player_profile`,
      arguments: [],
    });

    const result = await signAndExecuteTransaction({
      transaction: tx,
    });

    return result;
  };

  const recordKills = async (machineId: string, profileId: string, kills: number) => {
    if (!account) throw new Error('Wallet not connected');

    const tx = new Transaction();

    tx.moveCall({
      target: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::record_kills`,
      arguments: [
        tx.object(machineId),
        tx.object(SENTRY_DEFENSE_CONTRACT.REGISTRY_ID),
        tx.object(profileId),
        tx.pure.u64(kills),
      ],
    });

    const result = await signAndExecuteTransaction({
      transaction: tx,
    });

    return result;
  };

  const recordWaveCompletion = async (profileId: string, waveNumber: number, score: number) => {
    if (!account) throw new Error('Wallet not connected');

    const tx = new Transaction();

    tx.moveCall({
      target: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::record_wave_completion`,
      arguments: [
        tx.object(profileId),
        tx.object(SENTRY_DEFENSE_CONTRACT.REGISTRY_ID),
        tx.pure.u64(waveNumber),
        tx.pure.u64(score),
      ],
    });

    const result = await signAndExecuteTransaction({
      transaction: tx,
    });

    return result;
  };

  const grantDeploymentBonus = async (profileId: string) => {
    if (!account) throw new Error('Wallet not connected');

    const tx = new Transaction();

    tx.moveCall({
      target: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::grant_deployment_bonus`,
      arguments: [
        tx.object(SENTRY_DEFENSE_CONTRACT.REGISTRY_ID),
        tx.object(profileId),
      ],
    });

    const result = await signAndExecuteTransaction({
      transaction: tx,
    });

    return result;
  };

  const stakeMachine = async (machineId: string) => {
    if (!account) throw new Error('Wallet not connected');

    const tx = new Transaction();

    tx.moveCall({
      target: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::stake_machine`,
      arguments: [tx.object(machineId)],
    });

    const result = await signAndExecuteTransaction({
      transaction: tx,
    });

    return result;
  };

  const unstakeMachine = async (machineId: string, profileId: string) => {
    if (!account) throw new Error('Wallet not connected');

    const tx = new Transaction();

    tx.moveCall({
      target: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::unstake_machine`,
      arguments: [
        tx.object(machineId),
        tx.object(SENTRY_DEFENSE_CONTRACT.REGISTRY_ID),
        tx.object(profileId),
      ],
    });

    const result = await signAndExecuteTransaction({
      transaction: tx,
    });

    return result;
  };

  const getPlayerObjects = async (address?: string) => {
    const ownerAddress = address || account?.address;
    if (!ownerAddress) return null;

    const objects = await client.getOwnedObjects({
      owner: ownerAddress,
      filter: {
        MatchAny: [
          {
            StructType: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::Machine`,
          },
          {
            StructType: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::PlayerProfile`,
          },
        ],
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    return objects.data;
  };

  const getRegistryStats = async () => {
    const registry = await client.getObject({
      id: SENTRY_DEFENSE_CONTRACT.REGISTRY_ID,
      options: {
        showContent: true,
      },
    });

    return registry;
  };

  return {
    mintMachine,
    initPlayerProfile,
    recordKills,
    recordWaveCompletion,
    grantDeploymentBonus,
    stakeMachine,
    unstakeMachine,
    getPlayerObjects,
    getRegistryStats,
  };
}