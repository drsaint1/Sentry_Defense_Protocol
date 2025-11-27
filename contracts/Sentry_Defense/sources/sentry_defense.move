/// Module: sentry_defense
/// Sentry Defense NFT and Game System with Complete Token Economy
module sentry_defense::sentry_defense;

use one::object::UID;
use one::tx_context::TxContext;
use one::coin::{Self, TreasuryCap};
use one::balance::{Self, Balance};
use one::event;
use one::transfer;
use std::string::{Self, String};
use std::option;
use one::table::{Self, Table};

const EInsufficientPayment: u64 = 1;
const EAlreadyMinted: u64 = 2;
const ENotOwner: u64 = 3;
const EInvalidMachineType: u64 = 4;
const EMachineNotStaked: u64 = 5;
const EMachineAlreadyStaked: u64 = 6;
const ECannotPlayWhileStaked: u64 = 7;
const ENotAdmin: u64 = 8;
const EAlreadyOwnsMachineType: u64 = 9;
const EInsufficientRewards: u64 = 10;

const MINT_PRICE: u64 = 20_000_000;
const STAKE_REWARD_PER_EPOCH: u64 = 10_000_000;
const TOKENS_PER_KILL: u64 = 5_000_000;
const WAVE_BONUS_BASE: u64 = 15_000_000;
const DEPLOYMENT_BONUS: u64 = 25_000_000;

const MACHINE_SENTINEL: u8 = 1;
const MACHINE_BULWARK: u8 = 2;
const MACHINE_STORM: u8 = 3;

public struct SENTRY_DEFENSE has drop {}

/// The main defense machine NFT
public struct DefenseMachine has key, store {
    id: UID,
    /// Machine type: 1=Sentinel, 2=Bulwark, 3=Storm
    machine_type: u8,
    /// Machine name
    name: String,
    /// Total kills accumulated
    total_kills: u64,
    /// Current level
    level: u64,
    /// Is currently staked
    is_staked: bool,
    /// Epoch when staking started
    stake_start_epoch: u64,
    /// Owner address
    owner: address,
    /// Total tokens earned with this machine
    tokens_earned: u64,
}

/// Shared game registry
public struct GameRegistry has key {
    id: UID,
    /// Total machines minted
    total_minted: u64,
    /// Total kills across all machines
    total_kills: u64,
    /// Token treasury for distributing rewards
    token_treasury: Balance<SENTRY_DEFENSE>,
    /// Track which machine types each player owns (address -> machine_type -> bool)
    player_machines: Table<address, vector<u8>>,
    /// Admin/deployer address
    admin: address,
    /// Treasury cap for minting reward tokens
    treasury_cap: TreasuryCap<SENTRY_DEFENSE>,
}

/// Player profile
public struct PlayerProfile has key {
    id: UID,
    player: address,
    total_tokens_earned: u64,
    highest_wave: u64,
    total_kills: u64,
    games_played: u64,
}

public struct MachineMinted has copy, drop {
    machine_id: address,
    machine_type: u8,
    owner: address,
    name: String,
}

public struct MachineStaked has copy, drop {
    machine_id: address,
    owner: address,
    epoch: u64,
}

public struct MachineUnstaked has copy, drop {
    machine_id: address,
    owner: address,
    rewards_earned: u64,
}

public struct KillRecorded has copy, drop {
    machine_id: address,
    player: address,
    kills: u64,
    tokens_earned: u64,
    new_total_kills: u64,
}

public struct WaveCompleted has copy, drop {
    player: address,
    wave_number: u64,
    score: u64,
    tokens_earned: u64,
}

public struct TokensWithdrawn has copy, drop {
    player: address,
    amount: u64,
}

/// Initialize the game registry and token
fun init(witness: SENTRY_DEFENSE, ctx: &mut TxContext) {
    let (treasury_cap, metadata) = coin::create_currency(
        witness,
        9, 
        b"SGT", 
        b"Sentry Game Token", 
        b"Reward token for Sentry Defense game", 
        option::none(), 
        ctx
    );

    transfer::public_freeze_object(metadata);

    let admin = tx_context::sender(ctx);

    let registry = GameRegistry {
        id: one::object::new(ctx),
        total_minted: 0,
        total_kills: 0,
        token_treasury: balance::zero(),
        player_machines: table::new(ctx),
        admin,
        treasury_cap,
    };

    transfer::share_object(registry);
}

/// Mint a new defense machine NFT (Free for now - add payment integration later)
public entry fun mint_machine(
    registry: &mut GameRegistry,
    machine_type: u8,
    ctx: &mut TxContext
) {
    assert!(
        machine_type == MACHINE_SENTINEL ||
        machine_type == MACHINE_BULWARK ||
        machine_type == MACHINE_STORM,
        EInvalidMachineType
    );

    let sender = tx_context::sender(ctx);

    if (table::contains(&registry.player_machines, sender)) {
        let owned = table::borrow(&registry.player_machines, sender);
        let mut i = 0;
        let len = std::vector::length(owned);
        while (i < len) {
            assert!(*std::vector::borrow(owned, i) != machine_type, EAlreadyOwnsMachineType);
            i = i + 1;
        };
    };

    let name = if (machine_type == MACHINE_SENTINEL) {
        string::utf8(b"Sentinel Prime")
    } else if (machine_type == MACHINE_BULWARK) {
        string::utf8(b"Bulwark MK-II")
    } else {
        string::utf8(b"Stormcaster")
    };

    let machine = DefenseMachine {
        id: one::object::new(ctx),
        machine_type,
        name,
        total_kills: 0,
        level: 1,
        is_staked: false,
        stake_start_epoch: 0,
        owner: sender,
        tokens_earned: 0,
    };

    let machine_address = one::object::uid_to_address(&machine.id);

    registry.total_minted = registry.total_minted + 1;

    if (!table::contains(&registry.player_machines, sender)) {
        table::add(&mut registry.player_machines, sender, std::vector::empty());
    };
    let owned = table::borrow_mut(&mut registry.player_machines, sender);
    std::vector::push_back(owned, machine_type);

    event::emit(MachineMinted {
        machine_id: machine_address,
        machine_type,
        owner: sender,
        name,
    });

    transfer::transfer(machine, sender);
}

/// Initialize or get player profile
public entry fun init_player_profile(ctx: &mut TxContext) {
    let sender = tx_context::sender(ctx);

    let profile = PlayerProfile {
        id: one::object::new(ctx),
        player: sender,
        total_tokens_earned: 0,
        highest_wave: 0,
        total_kills: 0,
        games_played: 0,
    };

    transfer::transfer(profile, sender);
}

/// Stake a machine to earn passive rewards
public entry fun stake_machine(
    machine: &mut DefenseMachine,
    ctx: &mut TxContext
) {
    let sender = tx_context::sender(ctx);
    assert!(machine.owner == sender, ENotOwner);
    assert!(!machine.is_staked, EMachineAlreadyStaked);

    machine.is_staked = true;
    machine.stake_start_epoch = tx_context::epoch(ctx);

    event::emit(MachineStaked {
        machine_id: one::object::uid_to_address(&machine.id),
        owner: sender,
        epoch: tx_context::epoch(ctx),
    });
}

/// Unstake a machine and claim rewards
public entry fun unstake_machine(
    machine: &mut DefenseMachine,
    registry: &mut GameRegistry,
    profile: &mut PlayerProfile,
    ctx: &mut TxContext
) {
    let sender = tx_context::sender(ctx);
    assert!(machine.owner == sender, ENotOwner);
    assert!(machine.is_staked, EMachineNotStaked);

    let current_epoch = tx_context::epoch(ctx);
    let epochs_staked = current_epoch - machine.stake_start_epoch;
    let rewards = epochs_staked * STAKE_REWARD_PER_EPOCH;

    machine.is_staked = false;
    machine.stake_start_epoch = 0;

    if (rewards > 0) {
        let reward_balance = coin::mint_balance(&mut registry.treasury_cap, rewards);
        let reward_coin = coin::from_balance(reward_balance, ctx);
        transfer::public_transfer(reward_coin, sender);

        machine.tokens_earned = machine.tokens_earned + rewards;
        profile.total_tokens_earned = profile.total_tokens_earned + rewards;
    };

    event::emit(MachineUnstaked {
        machine_id: one::object::uid_to_address(&machine.id),
        owner: sender,
        rewards_earned: rewards,
    });
}

/// Record kills and distribute tokens (called after game session)
public entry fun record_kills(
    machine: &mut DefenseMachine,
    registry: &mut GameRegistry,
    profile: &mut PlayerProfile,
    kills: u64,
    ctx: &mut TxContext
) {
    let sender = tx_context::sender(ctx);
    assert!(machine.owner == sender, ENotOwner);
    assert!(!machine.is_staked, ECannotPlayWhileStaked);

    machine.total_kills = machine.total_kills + kills;
    registry.total_kills = registry.total_kills + kills;
    profile.total_kills = profile.total_kills + kills;

    let new_level = (machine.total_kills / 100) + 1;
    if (new_level > machine.level) {
        machine.level = new_level;
    };

    let tokens_earned = kills * TOKENS_PER_KILL;

    if (tokens_earned > 0) {
        let reward_balance = coin::mint_balance(&mut registry.treasury_cap, tokens_earned);
        let reward_coin = coin::from_balance(reward_balance, ctx);
        transfer::public_transfer(reward_coin, sender);

        machine.tokens_earned = machine.tokens_earned + tokens_earned;
        profile.total_tokens_earned = profile.total_tokens_earned + tokens_earned;
    };

    event::emit(KillRecorded {
        machine_id: one::object::uid_to_address(&machine.id),
        player: sender,
        kills,
        tokens_earned,
        new_total_kills: machine.total_kills,
    });
}

/// Record wave completion with bonus rewards
public entry fun record_wave_completion(
    profile: &mut PlayerProfile,
    registry: &mut GameRegistry,
    wave_number: u64,
    score: u64,
    ctx: &mut TxContext
) {
    let sender = tx_context::sender(ctx);
    assert!(profile.player == sender, ENotOwner);

    if (wave_number > profile.highest_wave) {
        profile.highest_wave = wave_number;
    };
    profile.games_played = profile.games_played + 1;

    let wave_bonus = WAVE_BONUS_BASE + ((wave_number - 1) * 2_000_000); 

    if (wave_bonus > 0) {
        let bonus_balance = coin::mint_balance(&mut registry.treasury_cap, wave_bonus);
        let bonus_coin = coin::from_balance(bonus_balance, ctx);
        transfer::public_transfer(bonus_coin, sender);

        profile.total_tokens_earned = profile.total_tokens_earned + wave_bonus;
    };

    event::emit(WaveCompleted {
        player: sender,
        wave_number,
        score,
        tokens_earned: wave_bonus,
    });
}

/// Grant deployment bonus (first time deploying a machine)
public entry fun grant_deployment_bonus(
    registry: &mut GameRegistry,
    profile: &mut PlayerProfile,
    ctx: &mut TxContext
) {
    let sender = tx_context::sender(ctx);
    assert!(profile.player == sender, ENotOwner);

    if (profile.games_played == 0) {
        let bonus_balance = coin::mint_balance(&mut registry.treasury_cap, DEPLOYMENT_BONUS);
        let bonus_coin = coin::from_balance(bonus_balance, ctx);
        transfer::public_transfer(bonus_coin, sender);

        profile.total_tokens_earned = profile.total_tokens_earned + DEPLOYMENT_BONUS;
    };
}

/// Admin function to fund token treasury for rewards
public entry fun fund_token_treasury(
    registry: &mut GameRegistry,
    amount: u64,
    ctx: &mut TxContext
) {
    let sender = tx_context::sender(ctx);
    assert!(sender == registry.admin, ENotAdmin);

    let tokens = coin::mint_balance(&mut registry.treasury_cap, amount);
    balance::join(&mut registry.token_treasury, tokens);
}

public fun get_machine_type(machine: &DefenseMachine): u8 {
    machine.machine_type
}

public fun get_total_kills(machine: &DefenseMachine): u64 {
    machine.total_kills
}

public fun get_level(machine: &DefenseMachine): u64 {
    machine.level
}

public fun is_staked(machine: &DefenseMachine): bool {
    machine.is_staked
}

public fun get_owner(machine: &DefenseMachine): address {
    machine.owner
}

public fun get_tokens_earned(machine: &DefenseMachine): u64 {
    machine.tokens_earned
}

public fun get_player_stats(profile: &PlayerProfile): (u64, u64, u64, u64) {
    (
        profile.total_tokens_earned,
        profile.highest_wave,
        profile.total_kills,
        profile.games_played
    )
}

public fun get_registry_stats(registry: &GameRegistry): (u64, u64) {
    (registry.total_minted, registry.total_kills)
}

public fun player_owns_machine_type(registry: &GameRegistry, player: address, machine_type: u8): bool {
    if (!table::contains(&registry.player_machines, player)) {
        return false
    };

    let owned = table::borrow(&registry.player_machines, player);
    let mut i = 0;
    let len = std::vector::length(owned);
    while (i < len) {
        if (*std::vector::borrow(owned, i) == machine_type) {
            return true
        };
        i = i + 1;
    };
    false
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    let witness = SENTRY_DEFENSE {};
    init(witness, ctx);
}