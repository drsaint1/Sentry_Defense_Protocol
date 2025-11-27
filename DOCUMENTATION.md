# 📚 Sentry Defense Protocol - Technical Documentation

Complete technical documentation for developers working on or integrating with the Sentry Defense Protocol game.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Smart Contract Integration](#smart-contract-integration)
3. [Game Engine](#game-engine)
4. [UI System](#ui-system)
5. [State Management](#state-management)
6. [Blockchain Interaction](#blockchain-interaction)
7. [API Reference](#api-reference)
8. [Deployment Guide](#deployment-guide)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React UI Layer                       │
│  (GameOverlay.tsx - Wallet, Stats, Menus, Modals)       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ gameBridge.ts
                      │ (State Bridge)
                      │
┌─────────────────────┴───────────────────────────────────┐
│                  Three.js Game Layer                     │
│  (main.ts - 3D Rendering, Physics, Game Logic)          │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────┴────────┐         ┌────────┴─────────┐
│  OneChain RPC  │         │  OneWallet API   │
│  (Read State)  │         │  (Transactions)  │
└────────────────┘         └──────────────────┘
```

### Technology Stack

**Frontend**:
- React 18 - UI components
- TypeScript 5 - Type safety
- Three.js - 3D graphics
- Vite 5 - Build tool

**Blockchain**:
- OneChain - Layer 1 blockchain
- OneLabs dApp Kit - Wallet & transactions
- Move Language - Smart contracts

**State Management**:
- React Hooks (useState, useEffect, useCallback)
- Custom bridge pattern (gameBridge.ts)
- Ref-based synchronization

---

## Smart Contract Integration

### Contract Structure

The game interacts with 3 main on-chain modules:

#### 1. DefenseMachine NFT
```move
struct DefenseMachine has key, store {
    id: UID,
    machine_type: u8,        // 0=Sentinel, 1=Bulwark, 2=Storm
    total_kills: u64,
    level: u8,
    is_staked: bool,
    owner: address,
}
```

#### 2. PlayerProfile
```move
struct PlayerProfile has key {
    id: UID,
    owner: address,
    total_kills: u64,
    total_tokens_earned: u64,
    games_played: u64,
    highest_wave: u64,
}
```

#### 3. StakingVault
```move
struct StakingVault has key {
    id: UID,
    staked_machines: vector<ID>,
    rewards_pool: Balance<OLP>,
}
```

### Contract Functions

#### Minting a Machine
```typescript
import { buildMintMachineTx } from './services/contractService';

const machineType = 0; // Sentinel
const tx = buildMintMachineTx(machineType);

await signAndExecuteTransaction({
  transaction: tx,
});
```

#### Recording Kills
```typescript
import { buildRecordKillsTx } from './services/contractService';

const tx = buildRecordKillsTx(
  machineObjectId,
  profileObjectId,
  killCount
);

await signAndExecuteTransaction({
  transaction: tx,
});
```

#### Staking
```typescript
import { buildStakeMachineTx } from './services/contractService';

const tx = buildStakeMachineTx(machineObjectId);

await signAndExecuteTransaction({
  transaction: tx,
});
```

---

## Game Engine

### Three.js Implementation

#### Scene Setup
```typescript
// main.ts
const scene = new Scene();
scene.background = new Color(0xb9dcff);
scene.fog = new FogExp2(0xd8ecff, 0.01);

const camera = new PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  400
);
camera.position.set(0, 32, 46);
```

#### Machine Variants
Three distinct machine types with unique geometries:

**Sentinel Mk I** - Dual-barrel turret:
```typescript
function createVariantSentinel(): MachineBuild {
  // Base platform
  const basePlate = new Mesh(
    new CylinderGeometry(7.2, 8, 1.4, 28),
    new MeshStandardMaterial({ color: 0x1a232f })
  );

  // Gun barrels
  const barrelGeometry = new CylinderGeometry(0.38, 0.38, 7.8, 18);
  // ... 2 barrels at offset

  return {
    root,
    gunPivot,
    muzzlePoints: [left, right],
    bulletGeometry,
    bulletMaterial
  };
}
```

**Bulwark Mk II** - Triple-barrel cannon:
```typescript
function createVariantBulwark(): MachineBuild {
  // Armored base
  const armoredCore = new Mesh(
    new CylinderGeometry(5.4, 6.4, 4.6, 26),
    new MeshStandardMaterial({ color: 0x364853, metalness: 0.25 })
  );

  // 3 barrels
  const barrelOffsets = [-0.9, 0, 0.9];
  // ... ion dart projectiles

  return { /* 3 muzzle points */ };
}
```

**Stormcaster Mk III** - Quad plasma projector:
```typescript
function createVariantStorm(): MachineBuild {
  // Energy core
  const coreSpine = new Mesh(
    new CylinderGeometry(1.8, 1.8, 3.6, 20),
    new MeshStandardMaterial({
      color: 0x4658c0,
      emissive: 0x1d2a7f,
      emissiveIntensity: 0.6
    })
  );

  // 4 energy nozzles
  const nozzleOffsets = [
    new Vector3(-1.2, 0.3, 0),
    new Vector3(1.2, 0.3, 0),
    new Vector3(-0.8, -0.8, 0.2),
    new Vector3(0.8, -0.8, 0.2)
  ];

  // Plasma sphere projectiles
  const bulletGeometry = new SphereGeometry(0.8, 18, 18);

  return { /* 4 muzzle points */ };
}
```

### Game Loop

```typescript
function gameLoop() {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(clock.getDelta(), 0.033);

  updateKeyboardAim(dt);

  if (gameState === "playing") {
    spawnWaveIfReady(dt);
    updateFire(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updatePowerUps(dt);
    updatePowerTimers(dt);
    updateScore(dt);
  }

  renderer.render(scene, camera);
}
```

### Enemy System

Humanoid enemies with detailed 3D models:

```typescript
function createHumanoidEnemy(): Group {
  const group = new Group();

  // Body parts with materials
  const palette = ENEMY_COLOR_PRESETS[random];

  // Lower body (hips, thighs, calves, boots)
  // Torso (chest, abdomen, armor plates)
  // Arms (shoulders, upper arms, forearms, hands)
  // Head (helmet, visor, comms)

  return group;
}
```

### Wave Tuning

Dynamic difficulty scaling:

```typescript
function getWaveTuning(currentWave: number): WaveTuning {
  return {
    count: Math.round(5 + currentWave * 2.1),
    baseHealth: 3 + Math.floor(currentWave / 2),
    baseSpeed: 7 + currentWave * 0.45,
    maxSimultaneous: Math.min(5 + Math.floor(currentWave * 0.6), 16),
    spawnInterval: {
      min: Math.max(0.95, 1.7 - progression * 0.65),
      max: Math.max(2.8 - progression * 0.5)
    }
  };
}
```

---

## UI System

### Component Hierarchy

```
OneLabsProvider
└── GameOverlay
    ├── Toast Stack
    ├── Progress Bar (4 steps)
    ├── Game HUD (when playing)
    │   ├── Stats Panel
    │   ├── Unsaved Indicator
    │   ├── Power-ups Display
    │   └── Action Buttons
    ├── Game Over Modal
    └── Main UI
        ├── Hero Panel
        ├── Flow Grid
        ├── Machine Cards
        ├── Staking Panel
        └── Metrics Grid
```

### State Flow

```typescript
// GameOverlay.tsx
const [state, setState] = useState<BridgeState>(() => getBridgeState());
const [processingMachine, setProcessingMachine] = useState<string | null>(null);
const [playerMachines, setPlayerMachines] = useState<ContractMachine[]>([]);
const [showGameOver, setShowGameOver] = useState(false);

// Subscribe to game updates
useEffect(() => subscribeToBridge(setState), []);

// Load blockchain data
useEffect(() => {
  if (account?.address) {
    loadPlayerData();
  }
}, [account?.address]);
```

### Machine Card Component

```typescript
{MACHINE_PROFILES.map((profile) => {
  const isThisProcessing = processingMachine === profile.id;
  const isMinted = machineState?.minted;

  return (
    <article className="machine-card">
      <button
        onClick={() => isMinted ? handleDeploy(profile.id) : handleMintAndPlay(profile.id)}
        disabled={!state.walletConnected || !!processingMachine}
      >
        {isThisProcessing
          ? "⏳ Processing..."
          : isMinted
            ? "🚀 Play"
            : "⚡ Mint & Play"}
      </button>
    </article>
  );
})}
```

---

## State Management

### gameBridge.ts

Central state bridge between Three.js game and React UI:

```typescript
export type BridgeState = {
  // Wallet
  walletConnected: boolean;

  // Game state
  gameReady: boolean;
  gameOver: boolean;
  activeMachineId?: string;

  // Stats
  wave: number;
  score: number;
  killCount: number;
  tokens: number;
  enemiesRemaining: number;

  // Power-ups
  powerUps: string[];

  // NFT machines
  mintedMachines: Record<string, MachineState>;

  // UI
  status: string;
};

let bridgeState: BridgeState = { /* initial */ };
let listener: ((state: BridgeState) => void) | null = null;

export function subscribeToBridge(callback: (state: BridgeState) => void) {
  listener = callback;
  callback(bridgeState);
  return () => { listener = null; };
}

export function updateBridgeFromGame(partial: Partial<BridgeState>) {
  Object.assign(bridgeState, partial);
  listener?.(bridgeState);
}
```

### Contract Actions Registration

```typescript
// In GameOverlay
useEffect(() => {
  registerContractActions({
    recordKills: gameContracts.recordKills,
    recordWaveCompletion: gameContracts.recordWaveCompletion,
    grantDeploymentBonus: gameContracts.grantDeploymentBonus,
    flushPendingKills: gameContracts.flushPendingKills,
  });
}, [gameContracts]);

// In main.ts
registerGameActions({
  selectMachine(machineId: string) {
    handleVariantSelection(index);
    return true;
  },
  startSession() {
    resetGame();
    grantTokenBonus(DEPLOYMENT_BONUS);
  }
});
```

---

## Blockchain Interaction

### useGameContracts Hook

Manages all blockchain operations:

```typescript
export function useGameContracts() {
  const [state, setState] = useState<GameContractsState>({
    isRecording: false,
    pendingKills: 0,
    lastRecordedWave: 0,
  });

  const pendingKillsRef = useRef(0);

  // Accumulate kills locally
  const recordKills = useCallback(async (machineId: string, killCount: number) => {
    pendingKillsRef.current += killCount;
    setState((s) => ({ ...s, pendingKills: pendingKillsRef.current }));
    return false; // No auto-submit
  }, []);

  // Manual submission
  const submitPendingKills = useCallback(async (machineId: string) => {
    if (pendingKillsRef.current === 0) return false;

    const tx = buildRecordKillsTx(
      machine.objectId,
      profile.objectId,
      pendingKillsRef.current
    );

    await signAndExecuteTransaction({ transaction: tx });

    pendingKillsRef.current = 0;
    setState((s) => ({ ...s, pendingKills: 0 }));
    return true;
  }, []);

  return {
    state,
    recordKills,
    submitPendingKills,
    recordWaveCompletion,
    grantDeploymentBonus,
    flushPendingKills,
  };
}
```

### Transaction Building

```typescript
// contractService.ts
export function buildMintMachineTx(machineType: number): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${ONELABS_CONFIG.PACKAGE_ID}::defense_machine::mint_machine`,
    arguments: [
      tx.pure.u8(machineType),
    ],
  });

  return tx;
}

export function buildRecordKillsTx(
  machineId: string,
  profileId: string,
  kills: number
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${ONELABS_CONFIG.PACKAGE_ID}::defense_machine::record_kills`,
    arguments: [
      tx.object(machineId),
      tx.object(profileId),
      tx.pure.u64(kills),
    ],
  });

  return tx;
}
```

### Fetching On-Chain Data

```typescript
export async function fetchPlayerMachines(
  client: SuiClient,
  address: string
): Promise<ContractMachine[]> {
  const { data } = await client.getOwnedObjects({
    owner: address,
    filter: {
      StructType: `${ONELABS_CONFIG.PACKAGE_ID}::defense_machine::DefenseMachine`,
    },
    options: {
      showContent: true,
      showType: true,
    },
  });

  return data
    .map(parseDefenseMachine)
    .filter((m): m is ContractMachine => m !== null);
}
```

---

## API Reference

### Exported Functions (main.ts)

#### `returnToMenu()`
Returns to main menu without disconnecting wallet.

```typescript
export function returnToMenu(): void
```

#### `restartGame()`
Restarts game from Wave 1 with fresh state.

```typescript
export function restartGame(): void
```

### Game Actions

#### `selectMachine(machineId: string)`
Selects and deploys a machine variant.

```typescript
selectMachine("sentinel" | "bulwark" | "storm"): boolean
```

#### `startSession()`
Initializes a new game session.

```typescript
startSession(): void
```

### Bridge Functions

#### `updateBridgeFromGame(partial)`
Updates game state from 3D engine.

```typescript
updateBridgeFromGame(partial: Partial<BridgeState>): void
```

#### `subscribeToBridge(callback)`
Subscribes to state changes.

```typescript
subscribeToBridge(callback: (state: BridgeState) => void): () => void
```

### Contract Service

#### `buildMintMachineTx(machineType)`
Builds NFT mint transaction.

```typescript
buildMintMachineTx(machineType: 0 | 1 | 2): Transaction
```

#### `buildStakeMachineTx(machineId)`
Builds staking transaction.

```typescript
buildStakeMachineTx(machineId: string): Transaction
```

#### `fetchPlayerMachines(client, address)`
Fetches user's NFTs.

```typescript
fetchPlayerMachines(
  client: SuiClient,
  address: string
): Promise<ContractMachine[]>
```

---

## Deployment Guide

### 1. Smart Contract Deployment

```bash
# Navigate to contracts directory
cd contracts

# Build Move package
onelabs move build

# Deploy to testnet
onelabs client publish --gas-budget 100000000

# Save package ID
export PACKAGE_ID="0x..."
```

### 2. Frontend Configuration

Update `src/config/contracts.ts`:

```typescript
export const ONELABS_CONFIG = {
  PACKAGE_ID: "0xYOUR_PACKAGE_ID",
  RPC_URL: "https://rpc.onechain.network",
  NETWORK: "testnet"
};
```

### 3. Build Frontend

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview build
npm run preview
```

### 4. Deploy to Hosting

**Vercel**:
```bash
vercel --prod
```

**Netlify**:
```bash
netlify deploy --prod --dir=dist
```

**IPFS** (Decentralized):
```bash
ipfs add -r dist/
```

### 5. Verify Deployment

- Connect OneWallet
- Mint test NFT
- Play one round
- Verify on-chain data

---

## Performance Optimization

### Batching Transactions
- Accumulate kills locally
- Submit in batches (manual save)
- Reduces gas costs 10x

### Asset Loading
- Lazy load 3D models
- Reuse geometries/materials
- Object pooling for bullets/enemies

### State Updates
- Debounced bridge updates
- RAF-based game loop
- Efficient React renders

---

## Testing

### Unit Tests
```bash
npm run test
```

### Integration Tests
```bash
npm run test:integration
```

### Contract Tests
```bash
cd contracts
onelabs move test
```

---

## Troubleshooting

### Common Issues

**Issue**: Wallet won't connect
**Solution**: Check OneWallet extension, refresh page

**Issue**: Transaction fails
**Solution**: Verify gas balance, check contract addresses

**Issue**: Game won't render
**Solution**: Check WebGL support, update graphics drivers

**Issue**: Kills not saving
**Solution**: Check pending kills > 0, wallet connected

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT License - see [LICENSE](LICENSE) file.

---

**Last Updated**: 2025
**Version**: 1.0.0
**OneChain Network**: Testnet
