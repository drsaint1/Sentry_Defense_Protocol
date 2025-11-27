#!/bin/bash

# Sentry Defense Deployment Script for OneLabs Blockchain
# This script builds and deploys the smart contract, then updates .env with addresses

set -e  # Exit on error

echo "🚀 Starting Sentry Defense deployment to OneLabs testnet..."
echo ""

# Check if sui CLI is available
if ! command -v sui &> /dev/null; then
    echo "❌ Error: sui CLI not found"
    echo "Please install sui CLI from onechain repository"
    exit 1
fi

# Navigate to contract directory
cd "$(dirname "$0")/../contracts/Sentry_Defense"

echo "📦 Building contract..."
~/onechain/target/release/sui-move build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"
echo ""

echo "🔐 Checking wallet and network..."
ACTIVE_ADDRESS=$(sui client active-address 2>/dev/null || echo "")

if [ -z "$ACTIVE_ADDRESS" ]; then
    echo "❌ No active wallet address found"
    echo "Please set up your wallet with: sui client"
    exit 1
fi

echo "Active Address: $ACTIVE_ADDRESS"
echo ""

echo "💰 Checking gas balance..."
sui client gas --json > /dev/null 2>&1 || {
    echo "⚠️  Warning: Could not fetch gas balance"
}
echo ""

echo "📤 Publishing contract to testnet..."
echo "Gas budget: 100000000 MIST (0.1 ONE)"
echo ""

# Deploy the contract and capture output
DEPLOY_OUTPUT=$(sui client publish --gas-budget 100000000 --json 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed:"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo "✅ Deployment successful!"
echo ""

# Parse deployment output
PACKAGE_ID=$(echo "$DEPLOY_OUTPUT" | jq -r '.objectChanges[] | select(.type == "published") | .packageId')
REGISTRY_ID=$(echo "$DEPLOY_OUTPUT" | jq -r '.objectChanges[] | select(.objectType | contains("GameRegistry")) | .objectId')
TREASURY_CAP_ID=$(echo "$DEPLOY_OUTPUT" | jq -r '.objectChanges[] | select(.objectType | contains("TreasuryCap")) | .objectId')
TOKEN_METADATA_ID=$(echo "$DEPLOY_OUTPUT" | jq -r '.objectChanges[] | select(.objectType | contains("CoinMetadata")) | .objectId')

echo "📝 Deployment Information:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Package ID:        $PACKAGE_ID"
echo "Registry ID:       $REGISTRY_ID"
echo "Treasury Cap ID:   $TREASURY_CAP_ID"
echo "Token Metadata ID: $TOKEN_METADATA_ID"
echo "Admin Address:     $ACTIVE_ADDRESS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."

# Update .env file
echo "📝 Updating .env file..."

cat > .env << EOF
# OneLabs Blockchain Configuration
VITE_ONELABS_NETWORK=testnet
VITE_ONELABS_RPC_URL=https://rpc-testnet.onelabs.cc:443

# Sentry Defense Smart Contract Addresses
VITE_PACKAGE_ID=${PACKAGE_ID}
VITE_REGISTRY_ID=${REGISTRY_ID}
VITE_TREASURY_CAP_ID=${TREASURY_CAP_ID}
VITE_TOKEN_METADATA_ID=${TOKEN_METADATA_ID}

# Admin Configuration
VITE_ADMIN_ADDRESS=${ACTIVE_ADDRESS}

# Deployment Info
# Deployed on: $(date)
# Network: OneLabs Testnet
# RPC: https://rpc-testnet.onelabs.cc:443
EOF

echo "✅ .env file updated"
echo ""

# Save deployment info to a separate file for reference
cat > deployment-info.json << EOF
{
  "network": "testnet",
  "deployedAt": "$(date -Iseconds)",
  "packageId": "${PACKAGE_ID}",
  "registryId": "${REGISTRY_ID}",
  "treasuryCapId": "${TREASURY_CAP_ID}",
  "tokenMetadataId": "${TOKEN_METADATA_ID}",
  "adminAddress": "${ACTIVE_ADDRESS}",
  "rpcUrl": "https://rpc-testnet.onelabs.cc:443"
}
EOF

echo "✅ deployment-info.json created"
echo ""

echo "🎉 Deployment Complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run dev' to start the frontend"
echo "2. Connect your wallet in the UI"
echo "3. Mint a machine NFT to start playing"
echo ""
echo "📚 Contract Functions:"
echo "  - mint_machine: Mint defense machine NFT (0.1 ONE)"
echo "  - init_player_profile: Create player profile"
echo "  - record_kills: Record kills and earn tokens"
echo "  - record_wave_completion: Complete wave and earn bonus"
echo "  - stake_machine: Stake for passive rewards"
echo "  - unstake_machine: Unstake and claim rewards"
echo ""
