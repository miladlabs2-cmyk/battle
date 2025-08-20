const { v4: uuidv4 } = require('uuid');
const { BETTING_SECONDS, START_DELAY_MS, BATTLE_TICK_MS, COOLDOWN_SECONDS, TEAM_NAMES, STARTING_HP, TEAMS } = require('../config');
const { game, GamePhase, playersById } = require('../state');
const { broadcast } = require('../messaging');
const { recordBlock } = require('../storage');
const { getRandomInt } = require('../utils');

function resetGame(roundId = uuidv4()) {
    game.id = roundId;
    game.phase = GamePhase.Idle;
    game.createdAt = Date.now();
    game.endsAt = null;
    game.countdown = null;
    game.bets = new Map();
    game.totals = Object.fromEntries(TEAM_NAMES.map((team) => [team, 0]));
    game.initialHp = Object.fromEntries(TEAMS.map((t) => [t.name, STARTING_HP * t.count]));
    game.hp = { ...game.initialHp };
    if (game.tickTimer) clearInterval(game.tickTimer);
    game.tickTimer = null;
}

function startBetting() {
    resetGame();
    game.phase = GamePhase.Betting;
    game.countdown = BETTING_SECONDS;
    game.endsAt = Date.now() + BETTING_SECONDS * 1000;
    broadcast('game_created', { game_id: game.id, start_time: game.createdAt });
    broadcast('betting_open', { game_id: game.id, countdown: game.countdown });
    // Ensure clients immediately see a cleared bets list and zeroed totals at the start of each round
    broadcast('bets_update', serializeBets());

    const countdownTimer = setInterval(() => {
        if (game.phase !== GamePhase.Betting) {
            clearInterval(countdownTimer);
            return;
        }
        game.countdown -= 1;
        if (game.countdown <= 0) {
            clearInterval(countdownTimer);
            closeBetting();
        } else {
            broadcast('betting_tick', { seconds_left: game.countdown, seconds: BETTING_SECONDS });
        }
    }, 1000);
}

function closeBetting() {
    if (game.phase !== GamePhase.Betting) return;
    game.phase = GamePhase.Starting;
    broadcast('betting_closed', { game_id: game.id });
    setTimeout(startBattle, START_DELAY_MS);
}

function startBattle() {
    if (game.phase !== GamePhase.Starting) return;
    game.phase = GamePhase.InProgress;
    recordBlock('game_start', { game_id: game.id, hp: game.hp });
    broadcast('game_start', { game_id: game.id, started_at: Date.now(), hp: game.hp });

    game.tickTimer = setInterval(() => {
        if (game.phase !== GamePhase.InProgress) {
            clearInterval(game.tickTimer);
            game.tickTimer = null;
            return;
        }

        const aliveTeams = TEAM_NAMES.filter((team) => game.hp[team] > 0);
        if (aliveTeams.length <= 1) {
            clearInterval(game.tickTimer);
            game.tickTimer = null;
            endRound(aliveTeams[0]);
            return;
        }
        const attacker = pickWeightedTeam(aliveTeams, (team) => game.hp[team]);
        const potentialDefenders = aliveTeams.filter((team) => team !== attacker);
        const defender = pickWeightedTeam(potentialDefenders, (team) => game.hp[team]);
        const damage = getRandomInt(8, 20);
        game.hp[defender] = Math.max(0, game.hp[defender] - damage);

        const tickPayload = {
            game_id: game.id,
            attacker,
            defender,
            damage,
            hp: game.hp,
        };
        recordBlock('battle_tick', tickPayload);
        broadcast('battle_tick', tickPayload);

        const aliveAfter = TEAM_NAMES.filter((team) => game.hp[team] > 0);
        if (aliveAfter.length <= 1) {
            clearInterval(game.tickTimer);
            game.tickTimer = null;
            endRound(aliveAfter[0] || attacker);
        }
    }, BATTLE_TICK_MS);
}

function endRound(winningSide) {
    if (![GamePhase.InProgress, GamePhase.Starting].includes(game.phase)) return;
    game.phase = GamePhase.Ended;

    const settlement = settleBets(winningSide);
    recordBlock('round_result', { game_id: game.id, winner: winningSide, totals: game.totals, settlement });
    broadcast('round_result', {
        game_id: game.id,
        winner: winningSide,
        totals: game.totals,
        settlement,
        ended_at: Date.now(),
    });

    // Stop the game here; do not auto-restart or start cooldown
    // Server remains idle after round_result
    return;
}

function settleBets(winningSide) {
    const perPlayerPayout = {};
    const totalInitialHp = Object.values(game.initialHp || {}).reduce((sum, v) => sum + v, 0);
    const teamInitialHp = (game.initialHp || {})[winningSide] || 1;
    const payoutMultiplier = totalInitialHp > 0 ? (totalInitialHp / teamInitialHp) : 1;
    for (const [playerId, bet] of game.bets.entries()) {
        const player = playersById.get(playerId);
        if (!player) continue;
        const won = bet.side === winningSide;
        if (won) {
            const payout = bet.amount * payoutMultiplier;
            player.balance += payout;
            perPlayerPayout[playerId] = { change: +payout, balance: player.balance };
        } else {
            perPlayerPayout[playerId] = { change: 0, balance: player.balance };
        }
    }
    return perPlayerPayout;
}

function placeBet(player, data) {
    if (game.phase !== GamePhase.Betting) {
        return { ok: false, error: 'Betting is closed' };
    }
    const side = typeof data?.side === 'string' ? data.side.toLowerCase() : '';
    const amount = Number(data?.amount);
    if (!TEAM_NAMES.includes(side)) {
        return { ok: false, error: 'Invalid side' };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, error: 'Invalid amount' };
    }
    if (player.balance < amount) {
        return { ok: false, error: 'Insufficient balance' };
    }
    player.balance -= amount;
    game.bets.set(player.id, { side, amount });
    game.totals[side] += amount;
    return { ok: true, bet: { side, amount }, totals: game.totals };
}

function serializeBets() {
    const bets = [];
    for (const [playerId, bet] of game.bets.entries()) {
        const name = playersById.get(playerId)?.name;
        if (!name) continue;
        bets.push({ player_id: playerId, name, side: bet.side, amount: bet.amount });
    }
    return { game_id: game.id, totals: game.totals, bets };
}

function serializeGameState() {
    return {
        game_id: game.id,
        phase: game.phase,
        created_at: game.createdAt,
        ends_at: game.endsAt,
        countdown: game.countdown,
        totals: game.totals,
        hp: game.hp,
    };
}

module.exports = {
    startBetting,
    closeBetting,
    startBattle,
    endRound,
    placeBet,
    serializeBets,
    serializeGameState,
};

function pickWeightedTeam(teams, weightFn) {
    let total = 0;
    for (const t of teams) total += Math.max(0, Number(weightFn(t)) || 0);
    if (total <= 0) return teams[Math.floor(Math.random() * teams.length)];
    let r = Math.random() * total;
    for (const t of teams) {
        const w = Math.max(0, Number(weightFn(t)) || 0);
        if (r < w) return t;
        r -= w;
    }
    return teams[teams.length - 1];
}


