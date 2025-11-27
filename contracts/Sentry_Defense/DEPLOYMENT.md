# Sentry Defense - Deployment Guide

Complete guide to build and deploy the Sentry Defense smart contract to OneLabs blockchain.

## Prerequisites

- ✅ OneChain Sui Move CLI installed at `~/onechain/target/release/sui-move`
- ✅ OneLabs wallet configured
- ✅ Sufficient ONE tokens for gas (recommend 1+ ONE)

## 🔧 Step 1: Build the Contract

Navigate to the contract directory and build:

```bash
cd /mnt/c/Users/USER/Desktop/FASTPROJECT/Games/game1/contracts/Sentry_Defense

# Build the contract
~/onechain/target/release/sui-move build
```

**Expected Output:**
```
BUILDING sentry_defense
```

If successful, you'll see compiled bytecode in the `build/` directory.

## 🚀 Step 2: Deploy to Testnet

### Option A: Deploy with Default Settings

```bash
~/onechain/target/release/sui-move publish --gas-budget 100000000
```

### Option B: Deploy with Specific Network

```bash
# For testnet
~/onechain/target/release/sui-move publish \
  --gas-budget 100000000 \
  --network testnet

# For mainnet (be careful!)
~/onechain/target/release/sui-move publish \
  --gas-budget 100000000 \
  --network mainnet
```

### Understanding Gas Budget

- `100000000` = 0.1 ONE tokens (in MIST units)
- Typical deployment costs 0.05-0.08 ONE
- Increase if deployment fails due to insufficient gas

## 📝 Step 3: Save Deployment Info

After successful deployment, you'll see output like:

```
Transaction Digest: 0x1234567890abcdef...
Package ID: 0xabcdef1234567890...
```

**IMPORTANT**: Save these values:

1. **Package ID** - Your contract address
2. **GameRegistry Object ID** - Shared object created during init
3. **TreasuryCap Object ID** - For minting tokens (admin only)

### Find Object IDs

```bash
# List all objects owned by your address
~/onechain/target/release/sui client objects

# Or query specific package
~/onechain/target/release/sui client object <PACKAGE_ID>
```

## 🔍 Step 4: Verify Deployment

### Check Registry

```bash
~/onechain/target/release/sui client object <REGISTRY_OBJECT_ID>
```

You should see:
- `total_minted: 0`
- `total_kills: 0`
- `admin: <YOUR_ADDRESS>`

### Check Token

```bash
# View token metadata
~/onechain/target/release/sui client object <TOKEN_METADATA_ID>
```

Token details:
- Symbol: `SGT`
- Name: `Sentry Game Token`
- Decimals: `9`

## 📋 Step 5: Update Frontend Config

Update your frontend configuration with deployed addresses:

```typescript
// src/config/contracts.ts
export const CONTRACTS = {
  PACKAGE_ID: '0xYOUR_PACKAGE_ID',
  REGISTRY_ID: '0xYOUR_REGISTRY_ID',
  NETWORK: 'testnet', // or 'mainnet'
};
```

## 🧪 Step 6: Test Functions

### Test Minting

```bash
~/onechain/target/release/sui client call \
  --package <PACKAGE_ID> \
  --module sentry_defense \
  --function mint_machine \
  --args <REGISTRY_ID> 1 <PAYMENT_COIN_ID> \
  --gas-budget 10000000
```

### Test Player Profile

```bash
~/onechain/target/release/sui client call \
  --package <PACKAGE_ID> \
  --module sentry_defense \
  --function init_player_profile \
  --gas-budget 5000000
```

## ⚙️ Common Commands

### Check Your Balance

```bash
~/onechain/target/release/sui client gas
```

### View Active Address

```bash
~/onechain/target/release/sui client active-address
```

### Switch Network

```bash
# Switch to testnet
~/onechain/target/release/sui client switch --env testnet

# Switch to mainnet
~/onechain/target/release/sui client switch --env mainnet
```

## 🐛 Troubleshooting

### Error: "Insufficient gas"
```bash
# Increase gas budget
--gas-budget 200000000
```

### Error: "Module not found"
```bash
# Rebuild from scratch
rm -rf build/
~/onechain/target/release/sui-move build
```

### Error: "One-time witness error"
```bash
# Make sure struct name matches module name
# SENTRY_DEFENSE struct must be in sentry_defense module
```

### Error: "Invalid package"
```bash
# Check Move.toml has correct dependencies
# Verify One framework version
```

## 📊 Deployment Checklist

- [ ] Contract builds without errors
- [ ] Testnet has sufficient ONE for gas
- [ ] Wallet is unlocked and active
- [ ] Network is set correctly (testnet/mainnet)
- [ ] Gas budget is adequate (100000000 MIST)
- [ ] Package ID saved
- [ ] Registry Object ID saved
- [ ] Treasury Cap ID saved (admin)
- [ ] Token Metadata ID saved
- [ ] Frontend config updated
- [ ] Test mint function works
- [ ] Test profile creation works

## 🎯 Post-Deployment

1. **Fund Token Treasury** (Admin):
```bash
~/onechain/target/release/sui client call \
  --package <PACKAGE_ID> \
  --module sentry_defense \
  --function fund_token_treasury \
  --args <REGISTRY_ID> 1000000000000 \
  --gas-budget 10000000
```

2. **Verify Token Supply**:
- Check token treasury balance in registry

3. **Test Game Flow**:
- Mint machine
- Create profile
- Record kills
- Complete wave
- Claim rewards

## 🔐 Security Notes

1. **Admin Private Key**: Keep secure - controls treasury
2. **Package ID**: Public - share with users
3. **Registry ID**: Public - needed for all transactions
4. **Treasury Cap**: Admin only - never share

## 📞 Support

If deployment fails:
1. Check gas balance
2. Verify network connection
3. Review build errors
4. Check Move.toml dependencies
5. Ensure onechain CLI is updated

## 🌐 Network Endpoints

### Testnet
- RPC: `https://rpc-testnet.onelabs.cc:443`
- Explorer: Check OneLabs testnet explorer

### Mainnet
- RPC: `https://rpc-mainnet.onelabs.cc:443`
- Explorer: Check OneLabs mainnet explorer

---

**Ready to deploy?** Run the build command and let's go! 🚀
