const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORAGE_DIR = __dirname;
const GAMES_DIR = path.join(STORAGE_DIR, 'games');

const BLOCK_TIME_MS = 3000;
const MAX_TX_PER_BLOCK = 500;

let head = null; // kept for backwards-compat; not used in per-game logging
let minerTimer = null; // kept for backwards-compat; no mining needed now

function ensureDirSync(dirPath) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function sha256Hex(input) {
    return '0x' + crypto.createHash('sha256').update(input).digest('hex');
}

function hashObject(obj) {
    return sha256Hex(JSON.stringify(obj));
}

function computeMerkleRoot(txHashes) {
    if (!txHashes || txHashes.length === 0) return '0x' + '0'.repeat(64);
    let layer = txHashes.slice();
    while (layer.length > 1) {
        const next = [];
        for (let i = 0; i < layer.length; i += 2) {
            const left = layer[i];
            const right = layer[i + 1] || layer[i]; // duplicate last if odd
            next.push(sha256Hex(left + right));
        }
        layer = next;
    }
    return layer[0];
}

async function appendToGameLog(gameId, line) {
    try {
        ensureDirSync(GAMES_DIR);
        const filePath = path.join(GAMES_DIR, `${String(gameId)}.jsonl`);
        await fs.promises.appendFile(filePath, line + '\n', 'utf8');
    } catch (err) {
        console.error('[storage] game append error:', err?.message || err);
    }
}

function readLastBlockSync() {
    return null; // disabled in per-game logging mode
}

function writeBlock(block) {
    // no-op in per-game logging mode
}

function createGenesisIfNeeded() {
    ensureDirSync(GAMES_DIR);
}

function mineBlock() {
    // disabled in per-game logging mode
}

function startStorage() {
    ensureDirSync(STORAGE_DIR);
    createGenesisIfNeeded();
    if (minerTimer) clearInterval(minerTimer);
}

function recordBlock(type, data) {
    const payload = data || {};
    const gameId = payload && payload.game_id != null ? payload.game_id : 'unknown';
    const tx = { type, ts: Date.now(), data: payload };
    tx.tx_hash = hashObject(tx);
    appendToGameLog(gameId, JSON.stringify(tx));
}

module.exports = {
    recordBlock,
    startStorage,
};


