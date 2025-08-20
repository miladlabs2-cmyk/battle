const { v4: uuidv4 } = require('uuid');
const { BETTING_SECONDS, START_DELAY_MS, BATTLE_TICK_MS, COOLDOWN_SECONDS, TEAM_NAMES, CASES } = require('../config');
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
    game.casesOrder = Object.keys(CASES);
    game.caseIdx = 0;
    game.sequence = [];
    game.position = -1;
    game.targetIndex = null;
    game.currentCaseKey = null;
    game.currentCaseCounts = null;
    game.caseResults = [];
    game.lastWinner = null;
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
    startNextCase();
}

function endRound(winningSide) {
    if (![GamePhase.InProgress, GamePhase.Starting].includes(game.phase)) return;
    game.phase = GamePhase.Ended;

    const settlement = settleBets(winningSide);
    const roundResult = { game_id: game.id, winner: winningSide, totals: game.totals, settlement, sequence: game.sequence, target_index: game.targetIndex };
    recordBlock('round_result', roundResult);
    broadcast('round_result', roundResult);

    const finalPayload = { game_id: game.id, case_results: game.caseResults || [], final_winner: winningSide, finished_at: Date.now() };
    recordBlock('final_round_result', finalPayload);
    broadcast('final_round_result', finalPayload);

    // Stop the game here; do not auto-restart or start cooldown
    // Server remains idle after final_round_result
    return;
}

function settleBets(winningSide) {
    const perPlayerPayout = {};
    const counts = game.currentCaseCounts || {};
    const totalSlots = Object.values(counts).reduce((sum, v) => sum + v, 0);
    const teamSlots = counts[winningSide] || 1;
    const payoutMultiplier = totalSlots > 0 ? (totalSlots / teamSlots) : 1;
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

function shuffleInPlace(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function startNextCase() {
    const caseKeys = game.casesOrder || [];
    if (game.caseIdx >= caseKeys.length) {
        endRound(game.lastWinner);
        return;
    }
    const key = caseKeys[game.caseIdx];
    game.currentCaseKey = key;
    const teams = CASES[key] || [];
    const counts = Object.fromEntries(teams.map(t => [t.name, t.count]));
    game.currentCaseCounts = counts;

    const slots = [];
    for (const t of teams) {
        for (let i = 0; i < t.count; i++) slots.push(t.name);
    }
    shuffleInPlace(slots);
    game.sequence = slots;
    game.position = -1;
    game.targetIndex = Math.max(0, slots.length - 4);

    const totalTicks = game.targetIndex + 1;
    const intervalMs = Math.max(10, Math.floor(3000 / Math.max(1, totalTicks)));

    recordBlock('game_start', { game_id: game.id, started_at: Date.now(), sequence: game.sequence, target_index: game.targetIndex, case_key: key, case_index: game.caseIdx, total_cases: caseKeys.length });
    broadcast('game_start', { game_id: game.id, started_at: Date.now(), sequence: game.sequence, target_index: game.targetIndex, case_key: key, case_index: game.caseIdx, total_cases: caseKeys.length });

    if (game.tickTimer) {
        try { clearInterval(game.tickTimer); } catch { }
        game.tickTimer = null;
    }

    game.tickTimer = setInterval(() => {
        if (game.phase !== GamePhase.InProgress) {
            clearInterval(game.tickTimer);
            game.tickTimer = null;
            return;
        }

        if (game.position < game.targetIndex) {
            game.position += 1;
        }

        const tickPayload = {
            game_id: game.id,
            index: game.position,
            total: game.sequence.length,
            target_index: game.targetIndex,
            sequence: game.sequence,
            case_key: key,
            case_index: game.caseIdx,
            total_cases: caseKeys.length,
        };
        recordBlock('battle_tick', tickPayload);
        broadcast('battle_tick', tickPayload);

        if (game.position >= game.targetIndex) {
            clearInterval(game.tickTimer);
            game.tickTimer = null;
            const winner = game.sequence[game.targetIndex];
            game.lastWinner = winner;
            const caseResult = {
                game_id: game.id,
                winner,
                sequence: game.sequence,
                target_index: game.targetIndex,
                case_key: key,
                case_index: game.caseIdx,
                total_cases: caseKeys.length,
                ended_at: Date.now(),
            };
            recordBlock('case_result', caseResult);
            broadcast('case_result', caseResult);
            try { game.caseResults.push(caseResult); } catch { }
            game.caseIdx += 1;
            startNextCase();
        }
    }, intervalMs);
}


