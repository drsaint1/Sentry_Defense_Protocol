"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@onelabs/dapp-kit";
import WalletConnectButton from "../onelabs/ConnectWalletButton";
import {
  BridgeState,
  MACHINE_PROFILES,
  deployMachine,
  getBridgeState,
  subscribeToBridge,
  setActiveMachineFromGame,
  updateBridgeFromGame,
  registerContractActions,
} from "./gameBridge";
import { useGameContracts } from "../hooks/useGameContracts";
import { returnToMenu, restartGame } from "../main";
import {
  buildMintMachineTx,
  buildInitPlayerProfileTx,
  buildStakeMachineTx,
  buildUnstakeMachineTx,
  fetchPlayerMachines,
  fetchPlayerProfile,
  machineIdToType,
  machineTypeToId,
  type ContractMachine,
  type PlayerProfileData,
} from "../services/contractService";

type Toast = { id: number; message: string };

type FlowStep = "connect" | "mint" | "deploy" | "playing";

export default function GameOverlay() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const gameContracts = useGameContracts();

  const [state, setState] = useState<BridgeState>(() => getBridgeState());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [processingMachine, setProcessingMachine] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<FlowStep>("connect");
  const [playerMachines, setPlayerMachines] = useState<ContractMachine[]>([]);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfileData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);

  useEffect(() => subscribeToBridge(setState), []);

  useEffect(() => {
    setShowGameOver(state.gameOver);
  }, [state.gameOver]);

  useEffect(() => {
    registerContractActions({
      recordKills: gameContracts.recordKills,
      recordWaveCompletion: gameContracts.recordWaveCompletion,
      grantDeploymentBonus: gameContracts.grantDeploymentBonus,
      flushPendingKills: gameContracts.flushPendingKills,
    });
  }, [gameContracts]);

  useEffect(() => {
    if (!account?.address) {
      setPlayerMachines([]);
      setPlayerProfile(null);
      return;
    }

    const loadPlayerData = async () => {
      setIsLoadingData(true);
      try {
        const [machines, profile] = await Promise.all([
          fetchPlayerMachines(client, account.address),
          fetchPlayerProfile(client, account.address),
        ]);

        setPlayerMachines(machines);
        setPlayerProfile(profile);

        const mintedMachines: Record<string, any> = {};
        machines.forEach((machine) => {
          const machineId = machineTypeToId(machine.machineType);
          mintedMachines[machineId] = {
            minted: true,
            staked: machine.isStaked,
            totalKills: machine.totalKills,
            level: machine.level,
          };
        });

        updateBridgeFromGame({
          killCount: profile?.totalKills ?? 0,
          tokens: profile?.totalTokensEarned ?? 0,
        });

        Object.keys(mintedMachines).forEach((id) => {
          const machineState = state.mintedMachines[id];
          if (machineState) {
            Object.assign(machineState, mintedMachines[id]);
          }
        });
      } catch (error) {
        console.error("Error loading player data:", error);
        showToast("❌ Failed to load blockchain data");
      } finally {
        setIsLoadingData(false);
      }
    };

    loadPlayerData();
  }, [account?.address, client]);

  useEffect(() => {
    if (!state.walletConnected) {
      setCurrentStep("connect");
    } else if (!state.activeMachineId) {
      setCurrentStep("mint");
    } else if (!state.gameReady) {
      setCurrentStep("deploy");
    } else {
      setCurrentStep("playing");
    }
  }, [state.walletConnected, state.activeMachineId, state.gameReady]);

  const heroStats = useMemo(
    () => [
      { label: "Tokens", value: state.tokens.toLocaleString() },
      { label: "Kills", value: state.killCount.toLocaleString() },
      { label: "Wave", value: state.wave.toString() },
      { label: "Score", value: state.score.toLocaleString() }
    ],
    [state.killCount, state.score, state.tokens, state.wave]
  );

  const showToast = (message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev.slice(-2), { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  };

  const handleMintAndPlay = async (machineId: string) => {
    if (processingMachine || !account?.address) return;

    const machineType = machineIdToType(machineId);
    const alreadyMinted = playerMachines.some((m) => m.machineType === machineType);

    if (alreadyMinted) {
      showToast("Deploying your machine...");
      await handleDeploy(machineId);
      return;
    }

    setProcessingMachine(machineId);

    try {
      // Profile creation if needed
      if (!playerProfile) {
        const profileTx = buildInitPlayerProfileTx();
        showToast("Creating player profile...");
        await signAndExecuteTransaction({
          transaction: profileTx,
        });
      }

      // Mint transaction - build first, then show toast for instant popup
      const mintTx = buildMintMachineTx(machineType);
      showToast("Minting NFT on blockchain...");
      await signAndExecuteTransaction({
        transaction: mintTx,
      });

      showToast("✓ NFT minted! Loading machine...");

      const [machines, profile] = await Promise.all([
        fetchPlayerMachines(client, account.address),
        fetchPlayerProfile(client, account.address),
      ]);

      setPlayerMachines(machines);
      setPlayerProfile(profile);

      const machine = machines.find((m) => m.machineType === machineType);
      if (machine) {
        const mintedMachines: Record<string, any> = {
          [machineId]: {
            minted: true,
            staked: machine.isStaked,
            totalKills: machine.totalKills,
            level: machine.level,
          },
        };

        Object.keys(mintedMachines).forEach((id) => {
          const machineState = state.mintedMachines[id];
          if (machineState) {
            Object.assign(machineState, mintedMachines[id]);
          }
        });

        setActiveMachineFromGame(machineId);

        showToast("🚀 Deploying to arena...");
        setTimeout(() => {
          handleDeploy(machineId);
        }, 500);
      }
    } catch (error: any) {
      console.error("Error minting machine:", error);
      showToast(`❌ Transaction failed: ${error.message || "Unknown error"}`);
    } finally {
      setProcessingMachine(null);
    }
  };

  const handleDeploy = async (machineId: string) => {
    if (processingMachine) return;

    setProcessingMachine(machineId);
    showToast("Deploying to arena...");

    try {
      await new Promise(resolve => setTimeout(resolve, 400));

      const response = deployMachine(machineId);
      if (!response.success) {
        showToast(
          response.reason === "mint-required"
            ? "❌ Please mint this machine first."
            : "❌ Unable to deploy. Try again."
        );
        setProcessingMachine(null);
        return;
      }

      showToast("✓ Machine deployed! Game starting...");
      setTimeout(() => {
        showToast("🎮 Eliminate enemies to earn tokens!");
      }, 1500);
    } catch (error: any) {
      console.error("Error deploying machine:", error);
      showToast(`❌ Deployment failed: ${error.message || "Unknown error"}`);
    } finally {
      setProcessingMachine(null);
    }
  };

  const handleStake = async (machineId: string) => {
    if (processingMachine || !account?.address || !playerProfile) return;

    const machineType = machineIdToType(machineId);
    const machine = playerMachines.find((m) => m.machineType === machineType);

    if (!machine) {
      showToast("Mint this machine before staking.");
      return;
    }

    setProcessingMachine(machineId);
    const isCurrentlyStaked = machine.isStaked;

    try {
      // Build transaction first for instant wallet popup
      const tx = isCurrentlyStaked
        ? buildUnstakeMachineTx(machine.objectId, playerProfile.objectId)
        : buildStakeMachineTx(machine.objectId);

      showToast(isCurrentlyStaked ? "Unstaking machine..." : "Staking machine...");

      await signAndExecuteTransaction({
        transaction: tx,
      });

      showToast(isCurrentlyStaked ? "✓ Machine unstaked!" : "✓ Machine staked for yields!");

      const machines = await fetchPlayerMachines(client, account.address);
      setPlayerMachines(machines);

      const updatedMachine = machines.find((m) => m.machineType === machineType);
      if (updatedMachine) {
        const machineState = state.mintedMachines[machineId];
        if (machineState) {
          machineState.staked = updatedMachine.isStaked;
        }
      }
    } catch (error: any) {
      console.error("Error staking/unstaking machine:", error);
      showToast(`❌ Transaction failed: ${error.message || "Unknown error"}`);
    } finally {
      setProcessingMachine(null);
    }
  };

  const progressSteps = [
    { id: "connect" as FlowStep, label: "Connect", icon: "🔗", completed: state.walletConnected },
    { id: "mint" as FlowStep, label: "Mint NFT", icon: "⚡", completed: !!state.activeMachineId },
    { id: "deploy" as FlowStep, label: "Deploy", icon: "🚀", completed: state.gameReady },
    { id: "playing" as FlowStep, label: "Playing", icon: "🎮", completed: state.gameReady && state.wave > 1 }
  ];

  return (
    <div className={`ui-layer ${currentStep === "playing" ? "ui-minimized" : ""}`}>
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast toast-animate">
            {toast.message}
          </div>
        ))}
      </div>

      {currentStep !== "playing" && (
      <div className="progress-bar">
        <div className="progress-steps">
          {progressSteps.map((step, index) => (
            <div
              key={step.id}
              className={`progress-step ${step.completed ? "completed" : ""} ${currentStep === step.id ? "active" : ""}`}
            >
              <div className="step-icon">{step.icon}</div>
              <div className="step-label">{step.label}</div>
              {index < progressSteps.length - 1 && (
                <div className={`step-connector ${step.completed ? "completed" : ""}`} />
              )}
            </div>
          ))}
        </div>
      </div>
      )}

      {currentStep === "playing" && (
        <div className="game-hud">
          <div className="hud-container">
            <div className="hud-top-bar">
              <div className="hud-stats-row">
                <div className="hud-stat">
                  <span className="stat-label">WAVE</span>
                  <span className="stat-value">{state.wave}</span>
                </div>
                <div className="hud-stat">
                  <span className="stat-label">SCORE</span>
                  <span className="stat-value">{state.score.toLocaleString()}</span>
                </div>
                <div className="hud-stat">
                  <span className="stat-label">TOKENS</span>
                  <span className="stat-value">{state.tokens}</span>
                </div>
                <div className="hud-stat">
                  <span className="stat-label">KILLS</span>
                  <span className="stat-value">{state.killCount}</span>
                </div>
              </div>
              {gameContracts.state.pendingKills > 0 && (
                <div className="unsaved-indicator">
                  <span className="unsaved-dot"></span>
                  {gameContracts.state.pendingKills} unsaved kills
                </div>
              )}
            </div>
            {state.powerUps.length > 0 && (
              <div className="hud-powerups">
                {state.powerUps.map((powerUp, i) => (
                  <span key={i} className="powerup-badge">{powerUp}</span>
                ))}
              </div>
            )}
          </div>
          <div className="hud-actions">
            <button
              className="hud-btn hud-save-btn"
              onClick={async () => {
                if (state.activeMachineId && gameContracts.state.pendingKills > 0) {
                  showToast("💾 Saving progress to blockchain...");
                  await gameContracts.submitPendingKills(state.activeMachineId);
                  showToast("✅ Progress saved!");
                }
              }}
              disabled={gameContracts.state.pendingKills === 0}
            >
              💾 Save Progress
            </button>
            <button
              className="hud-btn hud-menu-btn"
              onClick={() => {
                returnToMenu();
                setShowGameOver(false);
              }}
            >
              ☰ Menu
            </button>
          </div>
        </div>
      )}

      {showGameOver && (
        <div className="game-over-modal">
          <div className="game-over-content">
            <h2 className="game-over-title">🎮 Game Over</h2>
            <div className="game-over-stats">
              <div className="stat-item">
                <span className="stat-label">Final Score</span>
                <span className="stat-value">{state.score.toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Wave Reached</span>
                <span className="stat-value">{state.wave}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Kills</span>
                <span className="stat-value">{state.killCount}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Tokens Earned</span>
                <span className="stat-value">{state.tokens}</span>
              </div>
            </div>

            {gameContracts.state.pendingKills > 0 && (
              <div className="unsaved-warning">
                ⚠️ You have {gameContracts.state.pendingKills} unsaved kills
              </div>
            )}

            <div className="game-over-actions">
              <button
                className="game-over-btn save-btn"
                onClick={async () => {
                  if (state.activeMachineId && gameContracts.state.pendingKills > 0) {
                    setProcessingMachine("save");
                    showToast("💾 Saving progress to blockchain...");
                    await gameContracts.submitPendingKills(state.activeMachineId);
                    showToast("✅ Progress saved on-chain!");
                    setProcessingMachine(null);
                  }
                }}
                disabled={!!processingMachine || gameContracts.state.pendingKills === 0}
              >
                {processingMachine === "save" ? "⏳ Saving..." : "💾 Save Progress"}
              </button>
              <button
                className="game-over-btn play-again-btn"
                onClick={() => {
                  setShowGameOver(false);
                  restartGame();
                }}
                disabled={!!processingMachine}
              >
                🔄 Play Again
              </button>
              <button
                className="game-over-btn secondary"
                onClick={() => {
                  setShowGameOver(false);
                  returnToMenu();
                }}
                disabled={!!processingMachine}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  color: "rgba(227, 242, 255, 0.7)"
                }}
              >
                ☰ Back to Menu
              </button>
            </div>

            <button
              className="game-over-close"
              onClick={() => {
                setShowGameOver(false);
                returnToMenu();
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {currentStep !== "playing" && (
      <>
      <header className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Sentry Defense Protocol</p>
          <h1>Deploy, Mint &amp; Earn</h1>
          {account?.address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div className="wallet-badge">
                <span className="wallet-icon">🔗</span>
                <span className="wallet-text">{account.address.slice(0, 8)}...{account.address.slice(-6)}</span>
              </div>
              <WalletConnectButton
                className="cta ghost"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                🚪 Disconnect
              </WalletConnectButton>
            </div>
          )}
          <p className="lead">
            {currentStep === "connect" && "Connect your wallet to begin your defense mission."}
            {currentStep === "mint" && "Choose your defense platform and start playing!"}
            {currentStep === "deploy" && "Deploy your machine to the arena and start the battle!"}
            {currentStep === "playing" && "Eliminate enemies, earn tokens, and climb the leaderboard!"}
          </p>
          <div className="hero-actions">
            {currentStep === "connect" && (
              <WalletConnectButton
                className="cta primary pulse"
                labelWhenDisconnected="🔗 Connect Wallet to Start"
                disabled={false}
              />
            )}
            {currentStep === "mint" && state.walletConnected && (
              <div className="cta-hint">
                ⬇️ Choose your machine below to start playing
              </div>
            )}
            {(currentStep === "deploy" || currentStep === "playing") && (
              <button
                className={`cta ${currentStep === "deploy" ? "primary pulse" : "ghost"}`}
                onClick={() => state.activeMachineId && handleDeploy(state.activeMachineId)}
                disabled={!state.activeMachineId || !!processingMachine}
              >
                {processingMachine ? "⏳ Processing..." : currentStep === "deploy" ? "🚀 Enter Arena Now" : "🎮 Playing"}
              </button>
            )}
          </div>
          <div className="hero-stats">
            {heroStats.map((stat) => (
              <div key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="status-card">
          <p className="status-label">Control Status</p>
          <h2>{state.status}</h2>
          <div className="status-meta">
            <div>
              <span>Enemies Tracking</span>
              <strong>{state.enemiesRemaining}</strong>
            </div>
            <div>
              <span>Power-Ups</span>
              <strong>{state.powerUps.length ? state.powerUps.join(", ") : "None"}</strong>
            </div>
          </div>
          <div className="status-footer">
            <span>Active Platform</span>
            <strong>{state.activeMachineId ? state.activeMachineId.toUpperCase() : "None"}</strong>
          </div>
        </div>
      </header>

      <section className="flow-grid">
        {[
          { step: 1, title: "Connect Wallet", body: "Link your OneLabs wallet to sync all progress on-chain." },
          { step: 2, title: "Choose & Play", body: "Pick your defense platform - mints NFT and deploys automatically!" },
          { step: 3, title: "Earn Tokens", body: "Eliminate enemies to earn SGT tokens recorded on blockchain." },
          { step: 4, title: "Stake for Passive Income", body: "Stake idle machines to farm rewards while you're away." }
        ].map((item) => (
          <article key={item.step}>
            <div className="step">{item.step}</div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section className={`mint-grid ${currentStep === "mint" ? "highlight-section" : ""}`}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {currentStep === "mint" ? "⭐ Step 2: Choose Your Machine" : "Available Platforms"}
            </p>
            <h2>Choose Your Arsenal</h2>
          </div>
          <p className="helper">
            {currentStep === "mint"
              ? "Select a defense platform to mint and automatically deploy to the arena."
              : "Each platform is a unique NFT with staking rights. Choose wisely!"}
          </p>
        </div>
        <div className="card-grid">
          {MACHINE_PROFILES.map((profile) => {
            const machineState = state.mintedMachines[profile.id];
            const isActive = state.activeMachineId === profile.id;
            const isMinted = machineState?.minted;
            const canPlay = state.walletConnected && currentStep === "mint";
            const isPlaying = isActive && state.gameReady;
            const isThisProcessing = processingMachine === profile.id;

            return (
              <article
                className={`machine-card ${isActive ? "active-machine" : ""} ${canPlay && !isMinted ? "pulse-border" : ""}`}
                key={profile.id}
              >
                <div className="machine-glow" style={{ backgroundImage: profile.glow }} />
                {isPlaying && <div className="active-badge">🎮 Playing</div>}
                {isMinted && !isPlaying && <div className="active-badge">✓ Owned</div>}
                <div className="machine-header">
                  <span className="rarity" style={{ color: profile.accent }}>
                    {profile.rarity}
                  </span>
                  <h3>{profile.name}</h3>
                  <p>{profile.codename}</p>
                </div>
                <p className="description">{profile.description}</p>
                <ul>
                  {profile.perks.map((perk) => (
                    <li key={perk}>{perk}</li>
                  ))}
                </ul>
                <div className="machine-actions">
                  <button
                    className={`cta ${!isMinted && canPlay ? "primary pulse" : isPlaying ? "ghost" : "primary"}`}
                    onClick={() => isMinted ? handleDeploy(profile.id) : handleMintAndPlay(profile.id)}
                    disabled={!state.walletConnected || !!processingMachine}
                  >
                    {isThisProcessing
                      ? "⏳ Processing..."
                      : isPlaying
                        ? "🎮 Playing"
                        : isMinted
                          ? "🚀 Play"
                          : "⚡ Mint & Play"}
                  </button>
                </div>
                <div className="machine-meta">
                  <div>
                    <span>Total Kills</span>
                    <strong>{machineState?.totalKills ?? 0}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong className={machineState?.staked ? "status-staked" : isMinted ? "status-ready" : "status-locked"}>
                      {machineState?.staked ? "🔒 Staked" : isMinted ? "✓ Ready" : "🔒 Not Owned"}
                    </strong>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="staking-panel">
        <div>
          <p className="eyebrow">Yield Bay</p>
          <h2>Stake Your Platforms</h2>
          <p className="helper">
            Park unused machines in the staking vault to accumulate passive OLP (OneLabs Plasma) tokens.
          </p>
        </div>
        <div className="staking-list">
          {MACHINE_PROFILES.map((profile) => {
            const machine = state.mintedMachines[profile.id];
            const disabled = !machine?.minted;
            return (
              <div className="staking-row" key={`stake-${profile.id}`}>
                <div>
                  <strong>{profile.name}</strong>
                  <span>{profile.codename}</span>
                </div>
                <div className="staking-stats">
                  <span>Kills: {machine?.totalKills ?? 0}</span>
                  <span>Status: {machine?.staked ? "Staked" : "Ready"}</span>
                </div>
                <button className="cta ghost" onClick={() => handleStake(profile.id)} disabled={disabled}>
                  {disabled ? "Not Ready" : machine?.staked ? "Unstake" : "Stake"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="metrics-grid">
        <article>
          <p className="eyebrow">Live Combat Feed</p>
          <h3>Combat Telemetry</h3>
          <ul className="telemetry">
            <li>
              <span>Wave</span>
              <strong>{state.wave}</strong>
            </li>
            <li>
              <span>Enemies Remaining</span>
              <strong>{state.enemiesRemaining}</strong>
            </li>
            <li>
              <span>Tokens Earned</span>
              <strong>{state.tokens}</strong>
            </li>
            <li>
              <span>New Power-Ups</span>
              <strong>{state.powerUps.length ? state.powerUps.join(" • ") : "None yet"}</strong>
            </li>
          </ul>
        </article>
        <article>
          <p className="eyebrow">Engagement Tips</p>
          <h3>How to Play</h3>
          <ol>
            <li>Click "Play Now" on any machine - it mints and deploys automatically!</li>
            <li>Aim with mouse or WASD/Arrows - your turret fires automatically.</li>
            <li>Survive waves to earn bonus tokens - progress saved on blockchain.</li>
            <li>Mint multiple machines and stake the ones you're not using.</li>
          </ol>
        </article>
      </section>
      </>
      )}
    </div>
  );
}