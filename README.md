# 🎮 Sentry Defense Protocol

A blockchain-integrated 3D tower defense game where players mint NFT defense turrets, eliminate waves of enemies to earn on-chain tokens, and stake machines for passive rewards on the OneChain network.

![Game Type](https://img.shields.io/badge/Game-Tower%20Defense-blue)
![Blockchain](https://img.shields.io/badge/Blockchain-OneChain-green)
![Wallet](https://img.shields.io/badge/Wallet-OneWallet-orange)
![Framework](https://img.shields.io/badge/Framework-React%20%2B%20Three.js-purple)

## 🌟 Features

### 🎯 Gameplay
- **3D Tower Defense** - Immersive Three.js-powered 3D graphics
- **Auto-Firing Turrets** - Strategic mouse/WASD aiming with automatic firing
- **Wave-Based Combat** - Survive increasingly difficult enemy waves
- **Power-Ups System** - Rapid Fire, Shield, and Explosive rounds
- **Progressive Difficulty** - Enemies get stronger with each wave

### ⛓️ Blockchain Integration
- **NFT Defense Machines** - 3 unique turret types as NFTs
- **On-Chain Progress** - Kills and achievements recorded on OneChain
- **Token Rewards** - Earn SGT tokens for eliminating enemies
- **Staking System** - Stake idle machines for passive income
- **OneWallet Integration** - Seamless wallet connection and transactions

### 🎨 User Experience
- **Smooth Flow** - Mint and play with automatic deployment
- **Wallet Persistence** - Stay connected across sessions
- **Manual Saves** - Full control over blockchain transactions
- **Professional HUD** - Real-time stats display during gameplay
- **Game Over Options** - Save progress, play again, or exit

## 🚀 Quick Start

### Prerequisites
- Node.js v16+
- OneWallet browser extension
- OneChain testnet account with test tokens

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd game1

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

## 🎮 How to Play

1. **Connect Wallet** - Click "Connect Wallet" and approve OneWallet connection
2. **Choose Machine** - Select one of 3 defense platforms:
   - 🔹 **Sentinel Mk I** - Balanced dual-barrel platform
   - 🔹 **Bulwark Mk II** - Armored triple-barrel cannon
   - 🔹 **Stormcaster Mk III** - Energy projector firing plasma
3. **Mint & Play** - Click "Mint & Play" to mint NFT and auto-deploy
4. **Eliminate Enemies** - Aim with mouse or WASD/Arrow keys
5. **Survive Waves** - Turret fires automatically, survive as long as possible
6. **Earn Tokens** - Accumulate SGT tokens for kills and wave completions
7. **Save Progress** - Click "Save Progress" in HUD to record on-chain

## 🏗️ Tech Stack

### Frontend
- **React** - UI framework
- **TypeScript** - Type-safe development
- **Three.js** - 3D graphics and game rendering
- **Vite** - Build tool and dev server

### Blockchain
- **OneChain** - Layer 1 blockchain network
- **OneLabs dApp Kit** - Wallet integration and blockchain interaction
- **Move Language** - Smart contract development

### Smart Contracts
- **Defense Machine NFTs** - ERC-721 compatible NFTs
- **Player Profiles** - On-chain player data storage
- **Kill Recording** - Batched transaction system
- **Staking Vault** - Passive reward mechanism

## 📁 Project Structure

```
game1/
├── src/
│   ├── main.ts                 # 3D game logic (Three.js)
│   ├── ui/
│   │   ├── GameOverlay.tsx     # Main React UI component
│   │   └── gameBridge.ts       # Bridge between game and UI
│   ├── hooks/
│   │   └── useGameContracts.ts # Blockchain interaction hooks
│   ├── services/
│   │   └── contractService.ts  # Smart contract functions
│   ├── config/
│   │   └── contracts.ts        # Contract addresses & config
│   ├── onelabs/
│   │   ├── OneLabsProvider.tsx # Wallet provider setup
│   │   └── ConnectWalletButton.tsx
│   └── style.css               # Game styling
├── contracts/                  # Move smart contracts
├── dist/                       # Production build
└── package.json
```

## 🎯 Game Mechanics

### Scoring System
- **10 points** per enemy kill
- **Bonus** for wave completion
- **25 tokens** deployment bonus
- **4+ tokens** per kill (scales with wave)
- **12+ tokens** per wave clear (scales with wave)

### Power-Ups
- **🔥 Rapid Fire** - 50% faster firing rate (8s duration)
- **🛡️ Shield** - Absorb 1 enemy hit (max 3 charges)
- **💥 Explosive** - Double damage + AoE blast (10s duration)

### Staking
- Stake unused NFT machines for passive OLP rewards
- Unstake anytime to deploy for combat
- Accumulate rewards while away

## 🔗 Blockchain Features

### NFT Minting
Each defense machine is a unique NFT with:
- Machine type (0-2)
- Total kills tracked
- Current level
- Staking status

### Transaction Batching
- Kills accumulated locally during gameplay
- Manual "Save Progress" to batch submit
- Reduces gas costs and wallet interruptions

### Wallet Persistence
- AutoConnect enabled
- Session maintained across page navigation
- Menu/restart doesn't disconnect wallet

## 🎨 UI Components

### Progress Indicator
4-step visual progress bar:
1. 🔗 Connect Wallet
2. ⚡ Mint NFT
3. 🚀 Deploy Machine
4. 🎮 Playing

### In-Game HUD
- Wave counter
- Score display
- Token balance
- Kill count
- Unsaved kills indicator
- Active power-ups
- Save Progress button
- Menu button

### Game Over Modal
Three options when game ends:
- **💾 Save Progress** - Submit kills to blockchain
- **🔄 Play Again** - Instant restart (no reload)
- **☰ Back to Menu** - Return to homepage

## 🔧 Configuration

### Contract Addresses
Edit `src/config/contracts.ts`:
```typescript
export const ONELABS_CONFIG = {
  PACKAGE_ID: "your_package_id",
  RPC_URL: "https://rpc.onechain.network",
  NETWORK: "testnet"
};
```

### Environment Variables
Create `.env` file:
```env
VITE_ONECHAIN_RPC_URL=https://rpc.onechain.network
VITE_PACKAGE_ID=your_package_id
```

## 🐛 Troubleshooting

### Wallet Won't Connect
- Ensure OneWallet extension is installed
- Check you're on OneChain testnet
- Refresh page and try again

### Transaction Failed
- Verify sufficient balance for gas
- Check contract addresses are correct
- Ensure NFT is minted before playing

### Game Won't Start
- Clear browser cache
- Check console for errors
- Verify wallet is connected

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- **OneChain Docs**: [Documentation](https://docs.onechain.network)
- **OneWallet**: [Extension Download](https://onewallet.network)
- **OneLabs dApp Kit**: [GitHub](https://github.com/onelabs/dapp-kit)

## 🎮 Game Controls

| Action | Controls |
|--------|----------|
| Aim | Mouse Movement or WASD/Arrow Keys |
| Fire | Automatic |
| Save Progress | Click "Save Progress" in HUD |
| Menu | Click "Menu" button or close (X) |

## 📊 Stats & Leaderboard

Track your progress:
- Total kills across all machines
- Highest wave reached
- Total tokens earned
- NFTs owned and staked

---

**Built with ❤️ on OneChain**

*Play to Earn • Stake to Grow • Defend to Survive*
