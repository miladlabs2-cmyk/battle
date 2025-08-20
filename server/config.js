// Configuration
// Define multiple cases; each case is an array of { name, count }
const CASES = {
    case1: [
        { name: "gold", count: 2 },
        { name: "silver", count: 4 },
        { name: "bronze", count: 5 },
        { name: "noting", count: 9 },
    ],
    case2: [
        { name: "gold", count: 3 },
        { name: "silver", count: 8 },
        { name: "bronze", count: 3 },
        { name: "noting", count: 1 },
    ],
    case3: [
        { name: "gold", count: 4 },
        { name: "silver", count: 10 },
        { name: "bronze", count: 2 },
        { name: "noting", count: 0 },
    ],
};

// Unique team names across all cases
const TEAM_NAMES = Array.from(new Set(Object.values(CASES).flat().map(t => t.name)));

module.exports = {
    SERVER_PORT: 8087,
    BETTING_SECONDS: 3,
    START_DELAY_MS: 1000,
    BATTLE_TICK_MS: 1000,
    COOLDOWN_SECONDS: 5,
    CASES,
    TEAM_NAMES,
    STARTING_HP: 100,
    STARTING_BALANCE: 1000,
};


