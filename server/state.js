const { STARTING_HP, TEAM_NAMES } = require('./config');

const GamePhase = {
    Idle: 'idle',
    Betting: 'betting',
    Starting: 'starting',
    InProgress: 'in_progress',
    Ended: 'ended',
    Cooldown: 'cooldown',
};

const playersById = new Map();
const sockets = new Set();

const game = {
    id: null,
    phase: GamePhase.Idle,
    createdAt: null,
    endsAt: null,
    countdown: null,
    bets: new Map(),
    totals: Object.fromEntries((TEAM_NAMES || []).map((t) => [t, 0])),
    hp: Object.fromEntries((TEAM_NAMES || []).map((t) => [t, STARTING_HP])),
    tickTimer: null,
};

module.exports = {
    GamePhase,
    playersById,
    sockets,
    game,
};


