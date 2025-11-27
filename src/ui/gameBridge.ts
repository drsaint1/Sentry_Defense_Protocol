export type MachineProfile = {
  id: string;
  name: string;
  codename: string;
  rarity: "Rare" | "Epic" | "Legendary";
  description: string;
  perks: string[];
  accent: string;
  glow: string;
};

export type MintedMachineState = {
  minted: boolean;
  staked: boolean;
  totalKills: number;
  level: number;
};

export type BridgeState = {
  walletConnected: boolean;
  walletAddress?: string;
  wave: number;
  score: number;
  status: string;
  powerUps: string[];
  killCount: 0;
  tokens: number;
  activeMachineId?: string;
  enemiesRemaining: number;
  gameReady: boolean;
  gameOver: boolean;
  mintedMachines: Record<string, MintedMachineState>;
};

export type GameActions = {
  selectMachine: (machineId: string) => boolean;
  startSession: () => void;
};

export type ContractActions = {
  recordKills: (machineId: string, killCount: number) => Promise<boolean>;
  recordWaveCompletion: (waveNumber: number, score: number) => Promise<boolean>;
  grantDeploymentBonus: () => Promise<boolean>;
  flushPendingKills: (machineId: string) => Promise<void>;
};

export const MACHINE_PROFILES: MachineProfile[] = [
  {
    id: "sentinel",
    name: "Sentinel Prime",
    codename: "Precision Rail Battery",
    rarity: "Rare",
    description: "Twin-linked plasma cannons with stabilized recoil dampeners.",
    perks: ["+10% accuracy bonus", "Balanced fire rate", "Adaptive cooling"],
    accent: "#76c5ff",
    glow: "radial-gradient(circle at 30% 20%, rgba(118,197,255,0.45), rgba(8,20,45,0.9))"
  },
  {
    id: "bulwark",
    name: "Bulwark MK-II",
    codename: "Siegeline Triple Cannon",
    rarity: "Epic",
    description: "Armored artillery platform firing ionized darts and shattering pulses.",
    perks: ["+20% durability", "Ion burst rounds", "Arc shield integration"],
    accent: "#f6ad55",
    glow: "radial-gradient(circle at 50% 0%, rgba(246,173,85,0.35), rgba(14,10,4,0.95))"
  },
  {
    id: "storm",
    name: "Stormcaster",
    codename: "Arc Plasma Projector",
    rarity: "Legendary",
    description: "High-frequency plasma spheres that chain between clustered targets.",
    perks: ["Chain lightning hits", "Highest fire rate", "EMP overcharge"],
    accent: "#9b6bff",
    glow: "radial-gradient(circle at 70% 20%, rgba(155,107,255,0.4), rgba(14,6,24,0.95))"
  }
] as const;

const defaultMintedState = (): MintedMachineState => ({
  minted: false,
  staked: false,
  totalKills: 0,
  level: 1
});

const initialMinted = MACHINE_PROFILES.reduce<Record<string, MintedMachineState>>((acc, profile) => {
  acc[profile.id] = defaultMintedState();
  return acc;
}, {});

let bridgeState: BridgeState = {
  walletConnected: false,
  wave: 1,
  score: 0,
  status: "Connect a wallet to deploy a defense platform.",
  powerUps: [],
  killCount: 0,
  tokens: 0,
  enemiesRemaining: 0,
  gameReady: false,
  gameOver: false,
  mintedMachines: initialMinted
};

type BridgeListener = (state: BridgeState) => void;
const listeners = new Set<BridgeListener>();
let gameActions: GameActions | null = null;
let contractActions: ContractActions | null = null;

function cloneMintedPatch(patch?: Record<string, Partial<MintedMachineState>>) {
  if (!patch) return undefined;
  const result: Record<string, MintedMachineState> = {};
  for (const [id, data] of Object.entries(patch)) {
    const current = bridgeState.mintedMachines[id] ?? defaultMintedState();
    result[id] = { ...current, ...data };
  }
  return result;
}

function mergeState(patch: Partial<BridgeState> & { mintedMachines?: Record<string, Partial<MintedMachineState>> }) {
  let mintedMachines = bridgeState.mintedMachines;
  if (patch.mintedMachines) {
    const cloned = cloneMintedPatch(patch.mintedMachines);
    mintedMachines = { ...bridgeState.mintedMachines, ...cloned };
  }
  bridgeState = { ...bridgeState, ...patch, mintedMachines };
  listeners.forEach((listener) => listener(bridgeState));
}

export function getBridgeState() {
  return bridgeState;
}

export function subscribeToBridge(listener: BridgeListener) {
  listeners.add(listener);
  listener(bridgeState);
  return () => listeners.delete(listener);
}

export function registerGameActions(actions: GameActions) {
  gameActions = actions;
}

export function registerContractActions(actions: ContractActions) {
  contractActions = actions;
}

export function updateBridgeFromGame(patch: Partial<Omit<BridgeState, "mintedMachines">>) {
  mergeState(patch);
}

export function setWalletStatus(connected: boolean, address?: string) {
  mergeState({ walletConnected: connected, walletAddress: address });
}

export function mintMachineNFT(machineId: string) {
  const entry = bridgeState.mintedMachines[machineId];
  if (!entry) {
    return { success: false, reason: "unknown-machine" };
  }
  if (entry.minted) {
    return { success: false, reason: "already-minted" };
  }
  mergeState({
    mintedMachines: {
      [machineId]: { minted: true }
    },
    status: `${MACHINE_PROFILES.find((m) => m.id === machineId)?.name ?? "Machine"} minted and ready.`,
    activeMachineId: machineId
  });
  return { success: true };
}

export function deployMachine(machineId: string) {
  const entry = bridgeState.mintedMachines[machineId];
  if (!entry?.minted) {
    return { success: false, reason: "mint-required" };
  }
  if (!gameActions) {
    return { success: false, reason: "unregistered" };
  }
  const didSelect = gameActions.selectMachine(machineId);
  if (!didSelect) {
    return { success: false, reason: "select-failed" };
  }
  mergeState({
    activeMachineId: machineId,
    gameReady: true,
    status: `${MACHINE_PROFILES.find((m) => m.id === machineId)?.name ?? "Machine"} deployed to the arena.`
  });
  gameActions.startSession();
  return { success: true };
}

export function toggleStakeMachine(machineId: string) {
  const entry = bridgeState.mintedMachines[machineId];
  if (!entry?.minted) {
    return { success: false, reason: "mint-required" };
  }
  const staked = !entry.staked;
  mergeState({
    mintedMachines: {
      [machineId]: { staked }
    },
    status: staked ? "Machine staked for passive yields." : "Machine unstaked and combat-ready."
  });
  if (staked) {
    mergeState({ tokens: bridgeState.tokens + 25 });
  }
  return { success: true, staked };
}

export function recordKillReward(tokenReward: number) {
  const activeId = bridgeState.activeMachineId;
  const mintedMachines: Record<string, Partial<MintedMachineState>> = {};
  if (activeId) {
    const entry = bridgeState.mintedMachines[activeId] ?? defaultMintedState();
    mintedMachines[activeId] = {
      minted: true,
      totalKills: entry.totalKills + 1
    };

    if (contractActions) {
      contractActions.recordKills(activeId, 1).catch((error) => {
        console.error("Failed to record kill on-chain:", error);
      });
    }
  }
  mergeState({
    killCount: bridgeState.killCount + 1,
    tokens: bridgeState.tokens + tokenReward,
    mintedMachines: Object.keys(mintedMachines).length ? mintedMachines : undefined
  });
}

export function grantTokenBonus(amount: number) {
  if (amount <= 0) return;
  mergeState({ tokens: bridgeState.tokens + amount });


}

export function setActiveMachineFromGame(machineId?: string) {
  mergeState({ activeMachineId: machineId });
}

export function setGameReadiness(ready: boolean) {
  mergeState({ gameReady: ready });
}