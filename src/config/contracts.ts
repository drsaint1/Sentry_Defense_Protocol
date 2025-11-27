export const ONELABS_CONFIG = {
  NETWORK: import.meta.env.VITE_ONELABS_NETWORK || 'testnet',
  RPC_URL: import.meta.env.VITE_ONELABS_RPC_URL || 'https://rpc-testnet.onelabs.cc:443',
} as const;

export const SENTRY_DEFENSE_CONTRACT = {
  PACKAGE_ID: import.meta.env.VITE_PACKAGE_ID || '',
  REGISTRY_ID: import.meta.env.VITE_REGISTRY_ID || '',
  TREASURY_CAP_ID: import.meta.env.VITE_TREASURY_CAP_ID || '',
  TOKEN_METADATA_ID: import.meta.env.VITE_TOKEN_METADATA_ID || '',
  ADMIN_ADDRESS: import.meta.env.VITE_ADMIN_ADDRESS || '',
} as const;

export const MACHINE_TYPES = {
  SENTINEL: 1,
  BULWARK: 2,
  STORM: 3,
} as const;

export const TOKEN_AMOUNTS = {
  MINT_PRICE: 100_000_000,
  TOKENS_PER_KILL: 5_000_000,
  WAVE_BONUS_BASE: 15_000_000,
  DEPLOYMENT_BONUS: 25_000_000,
  STAKE_REWARD_PER_EPOCH: 10_000_000,
} as const;

export function isContractConfigured(): boolean {
  return !!(
    SENTRY_DEFENSE_CONTRACT.PACKAGE_ID &&
    SENTRY_DEFENSE_CONTRACT.REGISTRY_ID
  );
}

export function getContractModule(functionName: string): string {
  return `${SENTRY_DEFENSE_CONTRACT.PACKAGE_ID}::sentry_defense::${functionName}`;
}