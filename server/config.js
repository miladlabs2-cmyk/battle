// Configuration
const TEAMS = [
    { name: "red", count: 1 },
    { name: "blue", count: 1 },
    { name: "green", count: 1 },
    { name: "davood", count: 1 },
];

const TEAM_NAMES = TEAMS.map(t => t.name);

module.exports = {
    SERVER_PORT: 8087,
    BETTING_SECONDS: 30,
    START_DELAY_MS: 1000,
    BATTLE_TICK_MS: 1000,
    COOLDOWN_SECONDS: 5,
    TEAMS,
    TEAM_NAMES,
    STARTING_HP: 100,
    STARTING_BALANCE: 1000,
};


