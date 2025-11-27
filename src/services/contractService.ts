/**
 * Contract Service - Bridges game logic with blockchain
 * Handles all smart contract interactions for the Sentry Defense game
 */

import { SuiClient } from '@onelabs/sui/client';
import { Transaction } from '@onelabs/sui/transactions';
import { SENTRY_DEFENSE_CONTRACT } from '../config/contracts';

export type ContractMachine = {
  objectId: string;
  machineType: number;
  name: string;
  totalKills: number;
  level: number;
  isStaked: boolean;
  stakeStartEpoch: number;
  owner: string;
  tokensEarned: number;
};

export type PlayerProfileData = {
  objectId: string;
  player: string;
  totalTokensEarned: number;
  highestWave: number;
  totalKills: number;
  gamesPlayed: number;
};

/**
 * Parse a DefenseMachine object from blockchain data
 */
export function parseDefenseMachine(data: any): ContractMachine | null {
  try {
    const fields = data?.data?.content?.fields;
    if (!fields) return null;

    return {
      objectId: data.data.objectId,
      machineType: Number(fields.machine_type),
      name: fields.name,
      totalKills: Number(fields.total_kills),
      level: Number(fields.level),
      isStaked: fields.is_staked,
      stakeStartEpoch: Number(fields.stake_start_epoch),
      owner: fields.owner,
      tokensEarned: Number(fields.tokens_earned),
    };
  } catch (error) {
    console.error('Error parsing DefenseMachine:', error);
    return null;
  }
}

/**
 * Parse a PlayerProfile object from blockchain data
 */
export function parsePlayerProfile(data: any): PlayerProfileData | null {
  try {
    const fields = data?.data?.content?.fields;
    if (!fields) return null;

    return {
      objectId: data.data.objectId,
      player: fields.player,
      totalTokensEarned: Number(fields.total_tokens_earned),
      highestWave: Number(fields.highest_wave),
      totalKills: Number(fields.total_kills),
      gamesPlayed: Number(fields.games_played),
    };
  } catch (error) {
    console.error('Error parsing PlayerProfile:', error);
    return null;
  }
}

/**
 * Fetch all machines owned by a player
 */
export async function fetchPlayerMachines(
  client: SuiClient,
  address: string
): Promise<ContractMachine[]> {
  try {
    const objects = await client.getOwnedObjects({
      owner: address,
      filter: {
        StructType: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::DefenseMachine`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    const machines: ContractMachine[] = [];
    for (const obj of objects.data) {
      const machine = parseDefenseMachine(obj);
      if (machine) {
        machines.push(machine);
      }
    }

    return machines;
  } catch (error) {
    console.error('Error fetching player machines:', error);
    return [];
  }
}

/**
 * Fetch player profile
 */
export async function fetchPlayerProfile(
  client: SuiClient,
  address: string
): Promise<PlayerProfileData | null> {
  try {
    const objects = await client.getOwnedObjects({
      owner: address,
      filter: {
        StructType: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::PlayerProfile`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    if (objects.data.length === 0) {
      return null;
    }

    const profileObj = await client.getObject({
      id: objects.data[0].data?.objectId!,
      options: {
        showContent: true,
      },
    });

    return parsePlayerProfile(profileObj);
  } catch (error) {
    console.error('Error fetching player profile:', error);
    return null;
  }
}

/**
 * Build transaction for minting a machine
 */
export function buildMintMachineTx(machineType: number): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::mint_machine`,
    arguments: [
      tx.object(SENTRY_DEFENSE_CONTRACT.REGISTRY_ID),
      tx.pure.u8(machineType),
    ],
  });

  return tx;
}

/**
 * Build transaction for initializing player profile
 */
export function buildInitPlayerProfileTx(): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::init_player_profile`,
    arguments: [],
  });

  return tx;
}

/**
 * Build transaction for staking a machine
 */
export function buildStakeMachineTx(machineId: string): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::stake_machine`,
    arguments: [tx.object(machineId)],
  });

  return tx;
}

/**
 * Build transaction for unstaking a machine
 */
export function buildUnstakeMachineTx(
  machineId: string,
  profileId: string
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::unstake_machine`,
    arguments: [
      tx.object(machineId),
      tx.object(SENTRY_DEFENSE_CONTRACT.REGISTRY_ID),
      tx.object(profileId),
    ],
  });

  return tx;
}

/**
 * Build transaction for recording kills
 */
export function buildRecordKillsTx(
  machineId: string,
  profileId: string,
  kills: number
): Transaction {
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

  return tx;
}

/**
 * Build transaction for recording wave completion
 */
export function buildRecordWaveCompletionTx(
  profileId: string,
  waveNumber: number,
  score: number
): Transaction {
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

  return tx;
}

/**
 * Build transaction for granting deployment bonus
 */
export function buildGrantDeploymentBonusTx(profileId: string): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::grant_deployment_bonus`,
    arguments: [
      tx.object(SENTRY_DEFENSE_CONTRACT.REGISTRY_ID),
      tx.object(profileId),
    ],
  });

  return tx;
}

/**
 * Map machine type number to machine ID string
 */
export function machineTypeToId(machineType: number): string {
  switch (machineType) {
    case 1:
      return 'sentinel';
    case 2:
      return 'bulwark';
    case 3:
      return 'storm';
    default:
      return 'sentinel';
  }
}

/**
 * Map machine ID string to machine type number
 */
export function machineIdToType(machineId: string): number {
  switch (machineId.toLowerCase()) {
    case 'sentinel':
      return 1;
    case 'bulwark':
      return 2;
    case 'storm':
      return 3;
    default:
      return 1;
  }
}
