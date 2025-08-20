const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORAGE_DIR = __dirname;
const BLOCKS_FILE = path.join(STORAGE_DIR, 'blocks.jsonl');

const BLOCK_TIME_MS = 3000;
const MAX_TX_PER_BLOCK = 500;

const writeQueue = [];
let isWriting = false;
let head = null; // { number, hash }
let mempool = []; // queued txs waiting to be included
let minerTimer = null;

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

function enqueueWrite(line) {
    writeQueue.push(line);
    if (!isWriting) processQueue();
}

async function processQueue() {
    isWriting = true;
    ensureDirSync(STORAGE_DIR);
    while (writeQueue.length) {
        const line = writeQueue.shift();
        try {
            await fs.promises.appendFile(BLOCKS_FILE, line + '\n', 'utf8');
        } catch (err) {
            console.error('[storage] append error:', err?.message || err);
        }
    }
    isWriting = false;
}

function readLastBlockSync() {
    if (!fs.existsSync(BLOCKS_FILE)) return null;
    const content = fs.readFileSync(BLOCKS_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;
    try { return JSON.parse(lines[lines.length - 1]); } catch { return null; }
}

function writeBlock(block) {
    enqueueWrite(JSON.stringify(block));
    head = { number: block.header.number, hash: block.hash };
}

function createGenesisIfNeeded() {
    const last = readLastBlockSync();
    if (last && last.header && typeof last.header.number === 'number') {
        head = { number: last.header.number, hash: last.hash };
        return;
    }
    const header = {
        number: 0,
        parent_hash: '0x' + '0'.repeat(64),
        timestamp: Date.now(),
        merkle_root: '0x' + '0'.repeat(64),
        nonce: 0,
    };
    const block = { header, hash: hashObject(header), txs: [] };
    writeBlock(block);
}

function mineBlock() {
    if (mempool.length === 0) return;
    const txs = mempool.splice(0, MAX_TX_PER_BLOCK);
    const txHashes = txs.map(tx => tx.tx_hash);
    const header = {
        number: head ? head.number + 1 : 1,
        parent_hash: head ? head.hash : ('0x' + '0'.repeat(64)),
        timestamp: Date.now(),
        merkle_root: computeMerkleRoot(txHashes),
        nonce: Math.floor(Math.random() * 1e6),
    };
    const block = { header, hash: hashObject(header), txs };
    writeBlock(block);
}

function startStorage() {
    ensureDirSync(STORAGE_DIR);
    createGenesisIfNeeded();
    if (minerTimer) clearInterval(minerTimer);
    minerTimer = setInterval(mineBlock, BLOCK_TIME_MS);
}

function recordBlock(type, data) {
    // Treat as a transaction queued for inclusion in the next mined block
    const tx = {
        type,
        ts: Date.now(),
        data: data || {},
    };
    tx.tx_hash = hashObject(tx);
    mempool.push(tx);
}

module.exports = {
    recordBlock,
    startStorage,
};


