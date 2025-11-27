# Sentry Defense - Complete Smart Contract

A fully-featured Web3 tower defense game with NFT machines, staking, and token rewards on the OneLabs blockchain.

## 🎮 Features

### ✅ NFT System
- **3 Machine Types**: Sentinel, Bulwark, Stormcaster
- **Duplicate Prevention**: Each player can only mint one of each type
- **Ownership Tracking**: On-chain registry of player machines
- **Machine Stats**: Kills, level, tokens earned tracked per NFT

### 💰 Token Economy
- **Sentry Game Token (SGT)**: ERC20-compatible reward token
- **Kill Rewards**: 0.005 SGT per enemy killed
- **Wave Bonuses**: 0.015 SGT base + 0.002 SGT per wave level
- **Deployment Bonus**: 0.025 SGT for first-time players
- **Staking Rewards**: 0.01 SGT per epoch staked

### 🔒 Staking System
- **Passive Income**: Earn tokens while machines are staked
- **Play Restriction**: Cannot use staked machines in gameplay
- **Epoch-based**: Rewards calculated by epochs staked
- **Auto-unstake**: Claim rewards when unstaking

### 👤 Player Profiles
- **Total Stats**: Tokens earned, highest wave, total kills
- **Games Played**: Track player activity
- **Progression**: Level up system (every 100 kills)

### 🛡️ Security & Admin
- **Admin Controls**: Treasury withdrawal, token minting
- **Ownership Checks**: All functions verify ownership
- **Duplicate Prevention**: Can't mint same machine type twice
- **Anti-exploit**: Can't play while staked

## 📋 Smart Contract Functions

### Public Entry Functions

#### `mint_machine(registry, machine_type, payment, ctx)`
Mint a new defense machine NFT
- **Parameters**:
  - `machine_type`: 1 (Sentinel), 2 (Bulwark), or 3 (Storm)
  - `payment`: 0.1 ONE tokens
- **Checks**: Valid type, sufficient payment, not already owned

#### `init_player_profile(ctx)`
Create a player profile for tracking stats
- First-time players should call this before playing

#### `stake_machine(machine, ctx)`
Stake a machine to earn passive rewards
- **Checks**: Owner, not already staked

#### `unstake_machine(machine, registry, profile, ctx)`
Unstake and claim rewards
- **Rewards**: epochs_staked × 0.01 SGT
- **Checks**: Owner, currently staked

#### `record_kills(machine, registry, profile, kills, ctx)`
Record kills and distribute tokens
- **Rewards**: kills × 0.005 SGT
- **Checks**: Owner, not staked
- **Updates**: Total kills, level, profile stats

#### `record_wave_completion(profile, registry, wave_number, score, ctx)`
Record wave completion with bonus
- **Rewards**: 0.015 SGT + (wave - 1) × 0.002 SGT
- **Updates**: Highest wave, games played

#### `grant_deployment_bonus(registry, profile, ctx)`
One-time bonus for new players
- **Rewards**: 0.025 SGT
- **Check**: Only if games_played == 0

#### `withdraw_treasury(registry, amount, ctx)` [ADMIN]
Withdraw ONE tokens from minting fees
- **Admin only**

#### `fund_token_treasury(registry, amount, ctx)` [ADMIN]
Mint tokens to treasury reserve
- **Admin only**

### View Functions

```move
get_machine_type(machine): u8
get_total_kills(machine): u64
get_level(machine): u64
is_staked(machine): bool
get_owner(machine): address
get_tokens_earned(machine): u64
get_player_stats(profile): (u64, u64, u64, u64)
get_registry_stats(registry): (u64, u64)
player_owns_machine_type(registry, player, machine_type): bool
```

## 🎯 Game Flow

```
1. Connect Wallet
   ↓
2. Initialize Player Profile
   ↓
3. Mint Machine NFT (0.1 ONE)
   ↓
4. Grant Deployment Bonus (+0.025 SGT)
   ↓
5. Play Game & Record Kills (+0.005 SGT per kill)
   ↓
6. Complete Waves (+0.015+ SGT per wave)
   ↓
7. Optional: Stake Idle Machines (+0.01 SGT per epoch)
```

## 💎 Token Distribution

| Action | Reward |
|--------|--------|
| Kill Enemy | 0.005 SGT |
| Complete Wave 1 | 0.015 SGT |
| Complete Wave 5 | 0.023 SGT |
| Complete Wave 10 | 0.033 SGT |
| First Deployment | 0.025 SGT (one-time) |
| Staking (per epoch) | 0.01 SGT |

## 🔐 Security Features

1. **Ownership Verification**: All functions check msg.sender owns the object
2. **Duplicate Prevention**: Can't mint same machine type twice
3. **Staking Protection**: Can't play while machine is staked
4. **Admin Controls**: Only deployer can withdraw treasury
5. **Event Logging**: All actions emit events for transparency

## 📊 Events

- `MachineMinted`: When NFT is created
- `MachineStaked`: When machine is staked
- `MachineUnstaked`: When rewards are claimed
- `KillRecorded`: When kills are submitted
- `WaveCompleted`: When wave is finished
- `TreasuryWithdrawn`: When admin withdraws funds

## 🚀 Deployment

```bash
cd contracts/Sentry_Defense
~/onechain/target/release/sui-move build
~/onechain/target/release/sui-move publish --gas-budget 100000000
```

## 📝 Contract Constants

```move
MINT_PRICE: 100_000_000 (0.1 ONE)
STAKE_REWARD_PER_EPOCH: 10_000_000 (0.01 SGT)
TOKENS_PER_KILL: 5_000_000 (0.005 SGT)
WAVE_BONUS_BASE: 15_000_000 (0.015 SGT)
DEPLOYMENT_BONUS: 25_000_000 (0.025 SGT)
```

## ⚠️ Important Notes

1. **Player Profile**: Must call `init_player_profile()` before recording stats
2. **One Machine Per Type**: Can only own one Sentinel, one Bulwark, one Storm
3. **Staking Lock**: Staked machines cannot be used in gameplay
4. **Token Decimals**: All tokens use 9 decimals (like ONE token)
5. **Admin Address**: Set at deployment, only admin can withdraw treasury

## 🎨 Frontend Integration

The contract is fully integrated with the game's UI flow:
- Wallet connection
- NFT minting with visual feedback
- Smooth deploy → play transition
- Real-time token tracking
- Progress indicators
- Loading states

## 📜 License

Built for OneLabs blockchain ecosystem.
